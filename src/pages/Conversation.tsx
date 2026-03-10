import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { LANGUAGE_FLAGS, CONVERSATION_TOPICS, buildSystemPrompt, sendMessage, parseAIResponse, calculateXPForMessage } from '@/lib/claude'
import DashboardLayout from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Send, Bot, User, Lightbulb, MessageSquare } from 'lucide-react'

type ChatMsg = {
  role: 'user' | 'assistant'
  content: string
  corrections?: string[]
}

export default function Conversation() {
  const { user, profile, refreshProfile } = useAuth()
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [topic, setTopic] = useState(CONVERSATION_TOPICS[0])
  const [started, setStarted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const lang = profile?.target_language || 'Spanish'
  const level = profile?.level || 'beginner'
  const nativeLang = profile?.native_language || 'English'

  const startConversation = async () => {
    setStarted(true)
    setLoading(true)
    const systemPrompt = buildSystemPrompt(lang, level, topic, nativeLang)
    const { content, error } = await sendMessage([], systemPrompt)
    if (error) { toast.error('Failed to start'); setLoading(false); return }
    const parsed = parseAIResponse(content)
    setMessages([{ role: 'assistant', content, corrections: parsed.corrections }])
    setLoading(false)
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg: ChatMsg = { role: 'user', content: input }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    setInput('')
    setLoading(true)

    const systemPrompt = buildSystemPrompt(lang, level, topic, nativeLang)
    const history = newMsgs.slice(-10).map(m => ({ role: m.role, content: m.content }))
    const { content, error } = await sendMessage(history, systemPrompt)
    if (error) { toast.error('Failed to get response'); setLoading(false); return }
    const parsed = parseAIResponse(content)
    setMessages(prev => [...prev, { role: 'assistant', content, corrections: parsed.corrections }])

    // Award XP
    if (user) {
      const xp = calculateXPForMessage(input.length, parsed.corrections.length, profile?.streak_days || 0)
      try { await supabase.rpc('add_xp', { p_user_id: user.id, p_xp: xp }) } catch {}
      refreshProfile()
    }
    setLoading(false)
  }

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }

  if (!started) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto p-6 space-y-6 mt-10">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-primary" /> Conversation Practice
            </h1>
            <p className="text-muted-foreground text-sm mt-2">
              {LANGUAGE_FLAGS[lang]} Practice {lang} with an AI conversation partner.
            </p>
          </motion.div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Choose a topic</label>
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONVERSATION_TOPICS.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={startConversation} disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground gap-2">
            {loading ? 'Starting...' : 'Start Conversation'}
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-64px)] lg:h-screen max-w-3xl mx-auto">
        <div className="p-4 border-b border-border flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold">{LANGUAGE_FLAGS[lang]} {lang} · {topic}</div>
            <div className="text-xs text-muted-foreground capitalize">{level}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : '')}>
                <div className={cn('w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center',
                  msg.role === 'assistant' ? 'bg-gradient-to-br from-primary to-accent' : 'bg-secondary')}>
                  {msg.role === 'assistant' ? <Bot className="w-4 h-4 text-primary-foreground" /> : <User className="w-4 h-4" />}
                </div>
                <div className={cn('max-w-[80%] space-y-2', msg.role === 'user' ? 'items-end flex flex-col' : '')}>
                  <div className={cn('px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                    msg.role === 'assistant' ? 'bg-card border border-border rounded-tl-none' : 'bg-primary/10 border border-primary/20 rounded-tr-none')}>
                    {msg.content}
                  </div>
                  {msg.corrections && msg.corrections.length > 0 && (
                    <div className="space-y-1">
                      {msg.corrections.map((c, j) => (
                        <div key={j} className="flex items-start gap-2 text-xs bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
                          <Lightbulb className="w-3 h-3 text-accent flex-shrink-0 mt-0.5" />
                          <span className="text-accent">{c}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="bg-card border border-border rounded-2xl px-4 py-3 flex gap-1">
                {[0,1,2].map(i => <motion.div key={i} className="w-2 h-2 bg-primary rounded-full"
                  animate={{ y: [0,-6,0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-border flex-shrink-0">
          <div className="flex gap-3">
            <Textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder={`Type in ${lang}...`}
              className="resize-none min-h-[48px] max-h-32 bg-secondary border-border" rows={1} />
            <Button onClick={handleSend} disabled={!input.trim() || loading}
              className="bg-gradient-to-r from-primary to-accent text-primary-foreground self-end">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-center">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
