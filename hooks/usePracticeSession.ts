import { useState, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { createPracticeSession, updatePracticeSession } from '../lib/supabase-queries';
import { sendChatMessage, getTextToSpeech } from '../lib/ai';
import type { ConversationMessage, LanguageCode, ProficiencyLevel } from '../types';

export function usePracticeSession() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [sending, setSending] = useState(false);
  const startTimeRef = useRef<number>(0);

  // Fire-and-forget: generate ElevenLabs TTS in the background, then patch the
  // assistant message with a data URI. Failures are logged but non-fatal — chat
  // still works text-only if ELEVENLABS_KEY is missing or voice quota is hit.
  const attachAudio = useCallback(
    (messageId: string, text: string, targetLanguage: LanguageCode) => {
      void (async () => {
        try {
          const base64 = await getTextToSpeech(text, targetLanguage, user?.id ?? '');
          const audioUrl = `data:audio/mpeg;base64,${base64}`;
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, audioUrl } : m))
          );
        } catch (ttsErr) {
          console.warn('[practice] TTS failed (continuing without audio):', ttsErr);
        }
      })();
    },
    [user]
  );

  const startSession = useCallback(
    async (topic: string, targetLanguage: LanguageCode, level: ProficiencyLevel) => {
      if (!user) return;
      const session = await createPracticeSession(user.id, topic, targetLanguage, level);
      setSessionId(session.id);
      startTimeRef.current = Date.now();

      const greetingId = `g-${Date.now()}`;
      try {
        // Ask the AI to open in the target language. The system prompt inside
        // supabase/functions/ai-chat already enforces target-language output,
        // so the priming turn can be in English without leaking.
        const response = await sendChatMessage({
          userId: user.id,
          messages: [
            {
              role: 'user',
              content: `Please begin a natural practice conversation about "${topic}". Greet me warmly in ${targetLanguage} and ask an opening question appropriate for my level.`,
            },
          ],
          targetLanguage,
          level,
          topic,
        });

        const greeting: ConversationMessage = {
          id: greetingId,
          role: 'assistant',
          content: response.reply,
          audioUrl: null,
          correction: response.correction ?? null,
          timestamp: new Date().toISOString(),
        };
        setMessages([greeting]);
        attachAudio(greetingId, response.reply, targetLanguage);
      } catch (err) {
        console.error('[practice] startSession failed:', err);
        const detail = err instanceof Error ? err.message : String(err);
        setMessages([
          {
            id: greetingId,
            role: 'assistant',
            content: `Couldn't start the conversation. (${detail})`,
            audioUrl: null,
            correction: null,
            timestamp: new Date().toISOString(),
          },
        ]);
      }

      return session;
    },
    [user, attachAudio]
  );

  const sendMessage = useCallback(
    async (
      content: string,
      targetLanguage: LanguageCode,
      level: ProficiencyLevel,
      topic?: string
    ) => {
      if (sending) return;
      setSending(true);

      const userMsg: ConversationMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content,
        audioUrl: null,
        correction: null,
        timestamp: new Date().toISOString(),
      };

      const updated = [...messages, userMsg];
      setMessages(updated);

      try {
        const response = await sendChatMessage({
          userId: user?.id ?? '',
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
          targetLanguage,
          level,
          topic,
        });

        const assistantId = `a-${Date.now()}`;
        const assistantMsg: ConversationMessage = {
          id: assistantId,
          role: 'assistant',
          content: response.reply,
          audioUrl: null,
          correction: response.correction ?? null,
          timestamp: new Date().toISOString(),
        };

        const withReply = [...updated, assistantMsg];
        setMessages(withReply);
        attachAudio(assistantId, response.reply, targetLanguage);

        if (sessionId) {
          // Persist without the base64 data URI — regeneration on reload is fine
          // and keeps the row small.
          await updatePracticeSession(sessionId, { messages: withReply });
        }
      } catch (err) {
        console.error('[practice] sendMessage failed:', err);
        const detail = err instanceof Error ? err.message : String(err);
        const errorMsg: ConversationMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I had trouble responding. (${detail})`,
          audioUrl: null,
          correction: null,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setSending(false);
      }
    },
    [messages, sending, sessionId, user, attachAudio]
  );

  const endSession = useCallback(async () => {
    if (!sessionId) return;
    const durationMinutes = (Date.now() - startTimeRef.current) / 60000;
    await updatePracticeSession(sessionId, {
      durationMinutes,
      endedAt: new Date().toISOString(),
    });
    setSessionId(null);
    setMessages([]);
  }, [sessionId]);

  return { sessionId, messages, sending, startSession, sendMessage, endSession };
}
