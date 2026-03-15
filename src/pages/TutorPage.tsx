import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import PlanGate from '@/components/PlanGate'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Lightbulb, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserPlan } from '@/hooks/useUserPlan'
import { useAiTimeLimit } from '@/hooks/useAiTimeLimit'
import AiTimerBanner from '@/components/AiTimerBanner'

type TutorMsg = {
  role: 'user' | 'assistant'
  content: string
  corrections?: string[]
  vocab?: string[]
  timestamp: Date
}

const DEFAULT_TUTOR_STATE = {
  common_errors: [], mastered_vocab: [], preferred_topics: [],
  cefr_estimate: 'A1', session_count: 0,
}

export default function TutorPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user, profile } = useAuth()
  const { language } = useLanguage(slug!)
  const { isPaid } = useUserPlan()

  const [messages, setMessages] = useState<TutorMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tutorState, setTutorState] = useState(DEFAULT_TUTOR_STATE)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (!user || !language) return
    supabase.from('tutor_profiles').select('state').eq('user_id', user.id).eq('language_id', language.id).single()
      .then(({ data }) => { if (data?.state) setTutorState(data.state as any) })
    supabase.from('conversation_sessions').insert({ user_id: user.id, language_id: language.id, mode: 'text' })
      .select('id').single().then(({ data }) => { if (data) setSessionId(data.id) })
    startConversation()
  }, [user, language])

  const startConversation = async () => {
    if (!user || !language || !profile) return
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tutor-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          user_id: user.id, language_id: language.id, language_name: language.name,
          native_language: profile.native_language || 'English',
          user_level: profile.level || 'A1',
          message: 'Hello, please start our conversation session.',
          history: [], tutor_state: tutorState, mode: 'text',
        }),
      })
      const data = await res.json()
      if (data.error === 'upgrade_required') return
      if (data.reply) {
        setMessages([{ role: 'assistant', content: data.reply, corrections: data.corrections, vocab: data.vocab_highlight, timestamp: new Date() }])
        if (data.updated_state) setTutorState(data.updated_state)
      }
    } catch { toast.error('Failed to start session') }
    finally { setLoading(false) }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || !user || !language || !profile) return
    const userMsg: TutorMsg = { role: 'user', content: input, timestamp: new Date() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const token = authSession?.access_token
      if (!token) { toast.error('Not authenticated'); return }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tutor-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          user_id: user.id, language_id: language.id, language_name: language.name,
          native_language: profile.native_language || 'English',
          user_level: profile.level || 'A1',
          message: input,
          history: newMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          tutor_state: tutorState, session_id: sessionId, mode: 'text',
        }),
      })
      const data = await res.json()
      if (data.error === 'upgrade_required') { toast.error('Pro subscription required'); return }
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply, corrections: data.corrections, vocab: data.vocab_highlight, timestamp: new Date() }])
        if (data.updated_state) setTutorState(data.updated_state)
        if (data.corrections?.length) toast.success(`+${data.corrections.length} correction${data.corrections.length > 1 ? 's' : ''} noted`, { duration: 1500 })
      }
    } catch { toast.error('Failed to send message') }
    finally { setLoading(false) }
  }

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  if (!isPaid) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
          <PlanGate feature="the personalized AI Teacher"><div /></PlanGate>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[calc(100dvh-64px)] p-2 sm:p-4">
        {/* Outer wrapper with animated border */}
        <div className="relative w-full max-w-3xl h-[calc(100dvh-80px)] rounded-3xl p-[2px] overflow-hidden">
          {/* Animated outer border */}
          <motion.div
            className="absolute inset-0 rounded-3xl z-0"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))',
              backgroundSize: '200% 200%',
            }}
            animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Inner card */}
          <div className="relative z-10 flex flex-col h-full rounded-[22px] bg-card/95 backdrop-blur-xl border border-border/50 overflow-hidden">
            {/* Inner animated background */}
            <div className="absolute inset-0 opacity-5 pointer-events-none">
              <motion.div
                className="absolute w-[500px] h-[500px] rounded-full bg-primary/40 blur-[120px]"
                animate={{ x: ['-20%', '60%', '-20%'], y: ['-20%', '40%', '-20%'] }}
                transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            {/* Floating particles */}
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-primary/20 rounded-full pointer-events-none"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -30, 0],
                  opacity: [0, 0.6, 0],
                }}
                transition={{
                  duration: 3 + Math.random() * 4,
                  repeat: Infinity,
                  delay: Math.random() * 3,
                }}
              />
            ))}

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between p-4 sm:p-5 border-b border-border/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <motion.div
                  className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 shadow-lg"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <span className="text-xl">🤖</span>
                  <motion.div
                    className="absolute inset-0 rounded-2xl border-2 border-primary/30"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </motion.div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-foreground flex items-center gap-2">
                    {language?.flag} AI Teacher
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {language?.name}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Session {tutorState.session_count + 1} · Level {tutorState.cefr_estimate}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-xs text-primary flex items-center gap-1 bg-primary/5 px-2 py-1 rounded-full border border-primary/10">
                  <Zap className="w-3 h-3" /> {tutorState.mastered_vocab.length} vocab
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="relative z-10 flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={cn('flex gap-2 sm:gap-3', msg.role === 'user' ? 'flex-row-reverse' : '')}
                  >
                    <div className={cn(
                      'max-w-[85%] sm:max-w-[80%] space-y-2',
                      msg.role === 'user' ? 'items-end flex flex-col' : ''
                    )}>
                      <div className={cn(
                        'px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm',
                        msg.role === 'assistant'
                          ? 'bg-secondary/80 border border-border/60 rounded-tl-sm text-foreground'
                          : 'bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-tr-sm'
                      )}>
                        {msg.content}
                      </div>
                      {msg.role === 'assistant' && msg.corrections && msg.corrections.length > 0 && (
                        <div className="space-y-1">
                          {msg.corrections.map((c, j) => (
                            <div key={j} className="flex items-start gap-2 text-xs bg-orange-400/10 border border-orange-400/20 rounded-lg px-3 py-2">
                              <Lightbulb className="w-3 h-3 text-orange-400 flex-shrink-0 mt-0.5" />
                              <span className="text-orange-400">{c}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* AI Typing Indicator */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3 items-end"
                >
                  <div className="bg-secondary/80 border border-border/60 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5">
                    <motion.div className="w-2 h-2 bg-primary/60 rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0 }} />
                    <motion.div className="w-2 h-2 bg-primary/60 rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.15 }} />
                    <motion.div className="w-2 h-2 bg-primary/60 rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.3 }} />
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="relative z-10 p-3 sm:p-4 border-t border-border/50 flex-shrink-0 ios-keyboard-safe">
              <div className="flex gap-2 sm:gap-3 items-end">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={`Type in ${language?.name || 'the target language'}...`}
                  className="flex-1 bg-secondary/60 border border-border/60 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
                />
                <motion.button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'min-h-[46px] min-w-[46px] rounded-xl flex items-center justify-center transition-all shadow-md',
                    input.trim() && !loading
                      ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground cursor-pointer'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 text-center hidden sm:block opacity-60">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
