import { useState, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { createPracticeSession, updatePracticeSession } from '../lib/supabase-queries';
import { sendChatMessage } from '../lib/ai';
import type { ConversationMessage, LanguageCode, ProficiencyLevel } from '../types';

export function usePracticeSession() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [sending, setSending] = useState(false);
  const startTimeRef = useRef<number>(0);

  const startSession = useCallback(async (
    topic: string,
    targetLanguage: LanguageCode,
    level: ProficiencyLevel
  ) => {
    if (!user) return;
    const session = await createPracticeSession(user.id, topic, targetLanguage, level);
    setSessionId(session.id);
    startTimeRef.current = Date.now();

    const greeting: ConversationMessage = {
      id: '0',
      role: 'assistant',
      content: `Let's practice "${topic}"! Start by saying something in your target language.`,
      audioUrl: null,
      correction: null,
      timestamp: new Date().toISOString(),
    };
    setMessages([greeting]);
    return session;
  }, [user]);

  const sendMessage = useCallback(async (
    content: string,
    targetLanguage: LanguageCode,
    level: ProficiencyLevel,
    topic?: string
  ) => {
    if (sending) return;
    setSending(true);

    const userMsg: ConversationMessage = {
      id: Date.now().toString(),
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

      const assistantMsg: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.reply,
        audioUrl: response.audioUrl,
        correction: response.correction,
        timestamp: new Date().toISOString(),
      };

      const withReply = [...updated, assistantMsg];
      setMessages(withReply);

      if (sessionId) {
        await updatePracticeSession(sessionId, { messages: withReply });
      }
    } catch {
      const errorMsg: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I had trouble responding. Please try again.',
        audioUrl: null,
        correction: null,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }, [messages, sending, sessionId]);

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
