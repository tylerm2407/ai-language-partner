// Dual-model AI configuration:
// - Google Gemini: Live AI Teacher chat (conversational, real-time)
// - Claude Haiku/Sonnet: Text AI features (writing feedback, reading help, translations)

export const AI_MODELS = {
  // Claude models for text-based AI features
  fast: 'claude-haiku-4-5-20251001',
  standard: 'claude-sonnet-4-6',
  // Gemini model for live AI Teacher chat
  liveChat: 'gemini-2.5-flash',
} as const

export type ModelTier = keyof typeof AI_MODELS

export const MODEL_CONFIG = {
  // Live AI Teacher chat - uses Gemini
  tutor: {
    model: AI_MODELS.liveChat,
    maxTokens: 768,
    provider: 'gemini' as const,
    description: 'Live AI Teacher chat with corrections and vocab (Gemini)',
  },
  // Text AI features - use Claude
  chat: {
    model: AI_MODELS.standard,
    maxTokens: 512,
    provider: 'anthropic' as const,
    description: 'Conversational chat responses (Claude)',
  },
  writingFeedback: {
    model: AI_MODELS.standard,
    maxTokens: 1024,
    provider: 'anthropic' as const,
    description: 'Detailed writing analysis and corrections (Claude)',
  },
  translation: {
    model: AI_MODELS.fast,
    maxTokens: 200,
    provider: 'anthropic' as const,
    description: 'Quick translations and word lookups (Claude)',
  },
  readingHelp: {
    model: AI_MODELS.fast,
    maxTokens: 300,
    provider: 'anthropic' as const,
    description: 'Reading comprehension assistance (Claude)',
  },
  pronunciation: {
    model: AI_MODELS.fast,
    maxTokens: 200,
    provider: 'anthropic' as const,
    description: 'Pronunciation scoring feedback (Claude)',
  },
} as const

export type RequestType = keyof typeof MODEL_CONFIG

export function getModelConfig(requestType: RequestType) {
  return MODEL_CONFIG[requestType]
}

// Conversation summarization: when history exceeds this threshold,
// summarize older messages to reduce token usage
export const SUMMARIZATION_THRESHOLD = 10
export const MESSAGES_TO_KEEP_FULL = 6

export function shouldSummarize(messageCount: number): boolean {
  return messageCount > SUMMARIZATION_THRESHOLD
}

export function buildSummarizationPrompt(messages: Array<{ role: string; content: string }>): string {
  const olderMessages = messages.slice(0, messages.length - MESSAGES_TO_KEEP_FULL)
  const text = olderMessages.map(m => `${m.role}: ${m.content}`).join('\n')
  return `Summarize this conversation so far in 2-3 sentences, preserving key vocabulary and topics discussed:\n\n${text}`
}
