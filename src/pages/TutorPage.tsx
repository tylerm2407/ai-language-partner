import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import PlanGate from '@/components/PlanGate'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User, Lightbulb, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserPlan } from '@/hooks/useUserPlan'

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
      .then(({ data }) => { if (data?.state) setTutorState(data.state) })
    supabase.from('conversation_sessions').insert({ user_id: user.id, language_id: language.id, mode: 'text' })
      .select('id').single().then(({ data }) => { if (data) setSessionId(data.id) })
    startConversation()
  }, [user, language])

  const startConversation = async () => {
    if (!user || !language || !profile) return
    setLoading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tutor-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          user_id: user.id, language_id: language.id, language_name: language.name,
          native_language: profile.native_language || 'English',
          user_level: profile.level || 'A1',
          message: 'Hello, please start our conversation session.',
          history: [], tutor_state: tutorState, mode: 'text',
        }),
      })
      const data = await res.json()
      if (data.error === 'upgrade_required') { return }
      if (data.reply) {
        setMessages([{ role: 'assistant', content: data.reply, corrections: data.corrections, vocab: data.vocab_highlight, timestamp: new Date() }])
        if (data.updated_state) setTutorState(data.updated_state)
      }
    } catch (e) { toast.error('Failed to start session') }
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
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tutor-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
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
    } catch (e) { toast.error('Failed to send message') }
    finally { setLoading(false) }
  }

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  if (!isPaid) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-2xl mx-auto">
          <PlanGate feature="the personalized AI tutor"><div /></PlanGate>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-64px)] lg:h-screen max-w-3xl mx-auto">
        <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-pink-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-sm">{language?.flag} {language?.name} Tutor</div>
              <div className="text-xs text-muted-foreground">Session {tutorState.session_count + 1} · Level {tutorState.cefr_estimate}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-cyan-400 flex items-center gap-1">
              <Zap className="w-3 h-3" /> {tutorState.mastered_vocab.length} vocab mastered
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : '')}>
                <div className={cn('w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center',
                  msg.role === 'assistant' ? 'bg-gradient-to-br from-cyan-400 to-pink-500' : 'bg-gradient-to-br from-purple-400 to-pink-500')}>
                  {msg.role === 'assistant' ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-white" />}
                </div>
                <div className={cn('max-w-[80%] space-y-2', msg.role === 'user' ? 'items-end flex flex-col' : '')}>
                  <div className={cn('px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                    msg.role === 'assistant' ? 'bg-white/5 border border-white/10 rounded-tl-none' : 'bg-cyan-500/20 border border-cyan-500/30 rounded-tr-none')}>
                    {msg.content}
                  </div>
                  {msg.role === 'assistant' && msg.corrections && msg.corrections.length > 0 && (
                    <div className="space-y-1">
                      {msg.corrections.map((c, j) => (
                        <div key={j} className="flex items-start gap-2 text-xs bg-orange-400/10 border border-orange-400/20 rounded-lg px-3 py-2">
                          <Lightbulb className="w-3 h-3 text-orange-400 flex-shrink-0 mt-0.5" />
                          <span className="text-orange-300">{c}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-pink-500 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex gap-1">
                {[0,1,2].map(i => <motion.div key={i} className="w-2 h-2 bg-cyan-400 rounded-full"
                  animate={{ y: [0,-6,0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />)}
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-white/10 flex-shrink-0">
          <div className="flex gap-3">
            <Textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder={`Type in ${language?.name || 'the target language'}...`}
              className="resize-none min-h-[48px] max-h-32 bg-white/5 border-white/10" rows={1} />
            <Button onClick={sendMessage} disabled={!input.trim() || loading}
              className="bg-gradient-to-r from-cyan-500 to-pink-500 text-white self-end">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-center">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
