// Tiered AI model configuration for cost optimization
// Haiku: ~$0.25/M input - translations, simple tasks
// Sonnet: ~$3/M input - conversations, feedback
// Opus: ~$15/M input - not used (Sonnet quality sufficient for our use cases)

export const AI_MODELS = {
  fast: 'claude-haiku-4-5-20251001',
  standard: 'claude-sonnet-4-6',
} as const

export type ModelTier = keyof typeof AI_MODELS

export const MODEL_CONFIG = {
  chat: {
    model: AI_MODELS.standard,
    maxTokens: 512,
    description: 'Conversational chat responses (2-4 sentences)',
  },
  tutor: {
    model: AI_MODELS.standard,
    maxTokens: 768,
    description: 'Personalized tutor with corrections and vocab',
  },
  writingFeedback: {
    model: AI_MODELS.standard,
    maxTokens: 1024,
    description: 'Detailed writing analysis and corrections',
  },
  translation: {
    model: AI_MODELS.fast,
    maxTokens: 200,
    description: 'Quick translations and word lookups',
  },
  readingHelp: {
    model: AI_MODELS.fast,
    maxTokens: 300,
    description: 'Reading comprehension assistance',
  },
  pronunciation: {
    model: AI_MODELS.fast,
    maxTokens: 200,
    description: 'Pronunciation scoring feedback',
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
