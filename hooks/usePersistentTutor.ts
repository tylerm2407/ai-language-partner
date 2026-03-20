import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  createConversationSession,
  fetchRecentConversationSessions,
} from '../lib/supabase-queries';
import { useAuth } from './useAuth';
import type {
  ConversationMessage,
  ConversationSession,
  LanguageCode,
  ProficiencyLevel,
  AIPersonalityId,
} from '../types';

interface UsePersistentTutorReturn {
  messages: ConversationMessage[];
  isSending: boolean;
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
  sessions: ConversationSession[];
  startSession: (
    personalityId: AIPersonalityId,
    language: LanguageCode,
    level: ProficiencyLevel,
    scenarioId?: string
  ) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  resumeSession: (sessionId: string) => Promise<void>;
  endSession: () => void;
}

export function usePersistentTutor(): UsePersistentTutorReturn {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const sessionConfigRef = useRef<{
    personalityId: AIPersonalityId;
    language: LanguageCode;
    level: ProficiencyLevel;
  } | null>(null);

  const loadRecentSessions = useCallback(async () => {
    if (!user) return;
    try {
      const recent = await fetchRecentConversationSessions(user.id);
      setSessions(recent);
    } catch {
      // Non-critical
    }
  }, [user]);

  const startSession = useCallback(
    async (
      personalityId: AIPersonalityId,
      language: LanguageCode,
      level: ProficiencyLevel,
      scenarioId?: string
    ) => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        setMessages([]);

        const session = await createConversationSession({
          userId: user.id,
          tutorPersonality: personalityId,
          scenarioId: scenarioId ?? null,
          language,
          level,
        });

        setSessionId(session.id);
        sessionConfigRef.current = { personalityId, language, level };

        await loadRecentSessions();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to start session');
      } finally {
        setIsLoading(false);
      }
    },
    [user, loadRecentSessions]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!user || !sessionId || isSending) return;

      const userMessage: ConversationMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        audioUrl: null,
        correction: null,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsSending(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('tutor-message', {
          body: {
            sessionId,
            message: text,
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
          },
        });

        if (fnError) throw new Error(fnError.message);

        const aiMessage: ConversationMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          audioUrl: data.audioUrl ?? null,
          correction: data.correction ?? null,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, aiMessage]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send message');

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

  const resumeSession = useCallback(
    async (existingSessionId: string) => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);

        // Find the session in the recent list or fetch it
        const target = sessions.find((s) => s.id === existingSessionId);

        if (target) {
          setSessionId(target.id);
          setMessages(target.messages);
          sessionConfigRef.current = {
            personalityId: target.tutorPersonality,
            language: target.language,
            level: target.level,
          };
        } else {
          setError('Session not found');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to resume session');
      } finally {
        setIsLoading(false);
      }
    },
    [user, sessions]
  );

  const endSession = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    sessionConfigRef.current = null;
  }, []);

  return {
    messages,
    isSending,
    isLoading,
    error,
    sessionId,
    sessions,
    startSession,
    sendMessage,
    resumeSession,
    endSession,
  };
}
