import { useState, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { sendChatMessage } from '../lib/ai';
import {
  createPracticeSession,
  updatePracticeSession,
  upsertDailyStats,
} from '../lib/supabase-queries';
import type { ConversationMessage, LanguageCode, ProficiencyLevel } from '../types';

interface UsePracticeSessionReturn {
  messages: ConversationMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  sessionId: string | null;
  startSession: (topic: string, targetLanguage: LanguageCode, level: ProficiencyLevel) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  endSession: () => Promise<void>;
}

export function usePracticeSession(): UsePracticeSessionReturn {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionConfigRef = useRef<{
    targetLanguage: LanguageCode;
    level: ProficiencyLevel;
    topic: string;
  } | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const startSession = useCallback(
    async (topic: string, targetLanguage: LanguageCode, level: ProficiencyLevel) => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);

        const session = await createPracticeSession(user.id, topic, targetLanguage, level);
        setSessionId(session.id);
        sessionConfigRef.current = { targetLanguage, level, topic };
        startTimeRef.current = Date.now();

        // Add system greeting
        const greeting: ConversationMessage = {
          id: `system-${Date.now()}`,
          role: 'assistant',
          content: getGreeting(topic, targetLanguage, level),
          audioUrl: null,
          correction: null,
          timestamp: new Date().toISOString(),
        };

        setMessages([greeting]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to start session');
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!user || !sessionId || !sessionConfigRef.current || isSending) return;

      const userMessage: ConversationMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        audioUrl: null,
        correction: null,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsSending(true);
      setError(null);

      try {
        const { targetLanguage, level, topic } = sessionConfigRef.current;

        const response = await sendChatMessage({
          userId: user!.id,
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          targetLanguage,
          level,
          topic,
        });

        const aiMessage: ConversationMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: response.reply,
          audioUrl: response.audioUrl,
          correction: response.correction,
          timestamp: new Date().toISOString(),
        };

        const updatedMessages = [...messages, userMessage, aiMessage];
        setMessages(updatedMessages);

        // Persist to DB
        await updatePracticeSession(sessionId, {
          messages: updatedMessages,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send message');

        // Add error indicator but keep the UI flowing
        const errorMessage: ConversationMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I had trouble responding. Please try again.',
          audioUrl: null,
          correction: null,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsSending(false);
      }
    },
    [user, sessionId, messages, isSending]
  );

  const endSession = useCallback(async () => {
    if (!user || !sessionId) return;

    const durationMinutes = (Date.now() - startTimeRef.current) / 60000;

    try {
      await updatePracticeSession(sessionId, {
        endedAt: new Date().toISOString(),
        durationMinutes,
        messages,
      });

      // Update daily stats
      await upsertDailyStats(user.id, {
        speakingMinutes: durationMinutes,
        minutesPracticed: durationMinutes,
        xpEarned: Math.round(durationMinutes * 5),
      });

      setSessionId(null);
      setMessages([]);
      sessionConfigRef.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to end session');
    }
  }, [user, sessionId, messages]);

  return {
    messages,
    isLoading,
    isSending,
    error,
    sessionId,
    startSession,
    sendMessage,
    endSession,
  };
}

function getGreeting(topic: string, targetLanguage: LanguageCode, level: ProficiencyLevel): string {
  const greetings: Record<string, string> = {
    es: 'Hola! Vamos a practicar juntos.',
    fr: 'Bonjour! Pratiquons ensemble.',
    de: 'Hallo! Lass uns zusammen uben.',
    it: 'Ciao! Pratichiamo insieme.',
    pt: 'Ola! Vamos praticar juntos.',
    ja: 'こんにちは！一緒に練習しましょう。',
    ko: '안녕하세요! 같이 연습해요.',
    zh: '你好！我们一起练习吧。',
  };

  const greeting = greetings[targetLanguage] ?? "Hello! Let's practice together.";
  const topicIntro = topic ? ` Today's topic: ${topic}.` : '';

  return `${greeting}${topicIntro}`;
}
