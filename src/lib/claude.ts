import type { Message } from './supabase'

export const SUPPORTED_LANGUAGES = [
  'Spanish', 'French', 'German', 'Mandarin Chinese', 'Japanese', 'Portuguese',
  'Russian', 'Italian', 'Korean', 'Arabic', 'Hindi', 'Vietnamese', 'Turkish',
  'Polish', 'Dutch', 'Greek', 'Thai', 'Swedish', 'Norwegian', 'Danish',
  'Finnish', 'Romanian', 'Czech', 'Hungarian', 'Hebrew', 'Indonesian',
  'Malay', 'Filipino', 'Ukrainian', 'Catalan', 'Croatian', 'Serbian',
  'Slovak', 'Slovenian', 'Bulgarian', 'Lithuanian', 'Latvian', 'Estonian',
  'Swahili', 'Persian', 'Bengali', 'Punjabi', 'Tamil', 'Telugu', 'Urdu',
  'Kannada', 'Gujarati', 'Marathi', 'Nepali', 'Sinhala'
]

export const LANGUAGE_FLAGS: Record<string, string> = {
  'Spanish': '🇪🇸', 'French': '🇫🇷', 'German': '🇩🇪', 'Mandarin Chinese': '🇨🇳',
  'Japanese': '🇯🇵', 'Portuguese': '🇧🇷', 'Russian': '🇷🇺', 'Italian': '🇮🇹',
  'Korean': '🇰🇷', 'Arabic': '🇸🇦', 'Hindi': '🇮🇳', 'Vietnamese': '🇻🇳',
  'Turkish': '🇹🇷', 'Polish': '🇵🇱', 'Dutch': '🇳🇱', 'Greek': '🇬🇷',
  'Thai': '🇹🇭', 'Swedish': '🇸🇪', 'Norwegian': '🇳🇴', 'Danish': '🇩🇰',
  'Finnish': '🇫🇮', 'Romanian': '🇷🇴', 'Czech': '🇨🇿', 'Hungarian': '🇭🇺',
  'Hebrew': '🇮🇱', 'Indonesian': '🇮🇩', 'Malay': '🇲🇾', 'Filipino': '🇵🇭',
  'Ukrainian': '🇺🇦', 'Swahili': '🇰🇪', 'Persian': '🇮🇷', 'Bengali': '🇧🇩',
}

export const CONVERSATION_TOPICS = [
  'Free conversation', 'Introducing yourself', 'Ordering food & drinks',
  'Shopping & prices', 'Asking for directions', 'Travel & transportation',
  'Weather & seasons', 'Family & relationships', 'Work & career',
  'Hobbies & interests', 'Health & fitness', 'Current events & news',
  'Culture & traditions', 'Technology & social media', 'Movies & entertainment',
  'Sports & games', 'Education & learning', 'Business & finance',
  'Dating & friendships', 'Emergency situations'
]

export type TutorPersonality = 'encouraging' | 'strict' | 'casual' | 'formal'

export function buildSystemPrompt(
  language: string,
  level: string,
  topic: string,
  nativeLanguage: string,
  personality: TutorPersonality = 'encouraging'
): string {
  const levelGuides: Record<string, string> = {
    beginner: 'Use very simple vocabulary and short sentences. Translate key words in parentheses. Speak slowly and clearly.',
    elementary: 'Use simple vocabulary and common phrases. Occasionally provide translations for harder words.',
    intermediate: 'Use natural conversational language. Introduce idioms and expressions occasionally.',
    advanced: 'Use natural, nuanced language including idioms, slang, and cultural references.'
  }

  const personalityGuides: Record<string, string> = {
    encouraging: 'Be warm, enthusiastic and encouraging. Celebrate small wins. Make the learner feel confident.',
    strict: 'Be precise and thorough. Correct every mistake. Push the learner to improve.',
    casual: 'Be relaxed and friendly, like a friend who happens to speak the language fluently.',
    formal: 'Be professional and structured, like a classroom teacher.'
  }

  return `You are an expert ${language} language tutor and conversation partner.

LANGUAGE LEVEL: ${level}
${levelGuides[level] || levelGuides.beginner}

PERSONALITY: ${personality}
${personalityGuides[personality]}

TOPIC: ${topic === 'Free conversation' ? 'Open conversation on any topic' : topic}

RULES:
1. ALWAYS respond primarily in ${language}.
2. After your ${language} response, add an "[English]" section with:
   - Translation of what you said
   - Corrections prefixed with "💡 Correction:" for any mistakes in the user's message
3. Keep responses conversational: 2-4 sentences max.
4. Ask follow-up questions to keep conversation flowing.
5. If user writes in English, encourage them to try in ${language} and give a starter phrase.
6. Sound like a real person, not a textbook.

FORMAT:
[Your response in ${language}]

[English]
Translation: "..."
💡 Correction: (if any)

Start the conversation naturally. Introduce yourself with a culturally appropriate name.`
}

export async function sendMessage(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string
): Promise<{ content: string; error?: string }> {
  const { supabase } = await import('./supabase')
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return { content: '', error: 'Not authenticated' }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ messages, systemPrompt }),
    })

    if (!response.ok) {
      const err = await response.text()
      return { content: '', error: `API error: ${err}` }
    }

    const data = await response.json()
    return { content: data.content }
  } catch (e) {
    return { content: '', error: String(e) }
  }
}

export function parseAIResponse(raw: string): { targetLanguage: string; english: string; corrections: string[] } {
  const englishMatch = raw.match(/\[English\]([\s\S]*?)(?:\[|$)/)
  const english = englishMatch ? englishMatch[1].trim() : ''
  const targetLanguage = raw.replace(/\[English\][\s\S]*/, '').trim()
  const correctionMatches = [...(english.matchAll(/💡 Correction: ([^\n]+)/g))]
  const corrections = correctionMatches.map((m: RegExpMatchArray) => m[1])
  return { targetLanguage, english, corrections }
}

export function calculateXPForMessage(messageLength: number, corrections: number, streak: number): number {
  const base = Math.min(Math.floor(messageLength / 20), 15)
  const correctionBonus = corrections === 0 ? 5 : 0
  const streakMultiplier = streak >= 7 ? 1.5 : streak >= 3 ? 1.2 : 1
  return Math.round((base + correctionBonus) * streakMultiplier)
}

// Suppress unused import warning
export type { Message }
