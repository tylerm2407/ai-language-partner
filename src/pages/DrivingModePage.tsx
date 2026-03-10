import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { useUserPlan } from '@/hooks/useUserPlan'
import { supabase } from '@/lib/supabase'
import PlanGate from '@/components/PlanGate'
import DashboardLayout from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Mic, MicOff, Square, Volume2, Car, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking'

export default function DrivingModePage() {
  const { slug } = useParams<{ slug: string }>()
  const { user, profile } = useAuth()
  const { language } = useLanguage(slug!)
  const { isPaid } = useUserPlan()

  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [lastReply, setLastReply] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [tutorState, setTutorState] = useState({ common_errors: [], mastered_vocab: [], preferred_topics: [], cefr_estimate: 'A1', session_count: 0 })

  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)

  useEffect(() => {
    synthRef.current = window.speechSynthesis
    return () => { stopAll() }
  }, [])

  useEffect(() => {
    if (!user || !language) return
    supabase.from('tutor_profiles').select('state').eq('user_id', user.id).eq('language_id', language.id).single()
      .then(({ data }) => { if (data?.state) setTutorState(data.state) })
    supabase.from('conversation_sessions').insert({ user_id: user.id, language_id: language.id, mode: 'voice' })
      .select('id').single().then(({ data }) => { if (data) setSessionId(data.id) })
  }, [user, language])

  const stopAll = () => {
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch {} }
    if (synthRef.current) synthRef.current.cancel()
    setVoiceState('idle')
  }

  const speak = (text: string, lang: string) => {
    if (!synthRef.current) return
    synthRef.current.cancel()
    const spokenText = text.split('[Tutor Notes]')[0].trim()
    const utterance = new SpeechSynthesisUtterance(spokenText)
    const voices = synthRef.current.getVoices()
    const matchVoice = voices.find(v => v.lang.startsWith(lang)) || voices[0]
    if (matchVoice) utterance.voice = matchVoice
    utterance.rate = 0.9
    utterance.onend = () => {
      setVoiceState('idle')
      setTimeout(startListening, 800)
    }
    setVoiceState('speaking')
    synthRef.current.speak(utterance)
  }

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { toast.error('Speech recognition not supported in this browser'); return }

    const recognition = new SpeechRecognition()
    recognition.lang = language?.slug === 'spanish' ? 'es-ES' : language?.slug === 'french' ? 'fr-FR' : language?.slug === 'german' ? 'de-DE' : language?.slug === 'italian' ? 'it-IT' : language?.slug === 'portuguese' ? 'pt-BR' : language?.slug === 'japanese' ? 'ja-JP' : language?.slug === 'korean' ? 'ko-KR' : language?.slug === 'mandarin' ? 'zh-CN' : language?.slug || 'en-US'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => setVoiceState('listening')
    recognition.onresult = async (event: any) => {
      const userText = event.results[0][0].transcript
      setVoiceState('processing')
      setTranscript(prev => [...prev, { role: 'user', text: userText }])
      await sendToTutor(userText)
    }
    recognition.onerror = (e: any) => { toast.error(`Speech error: ${e.error}`); setVoiceState('idle') }
    recognition.onend = () => { if (voiceState === 'listening') setVoiceState('idle') }

    recognitionRef.current = recognition
    recognition.start()
  }

  const sendToTutor = async (userText: string) => {
    if (!user || !language || !profile) return
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tutor-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          user_id: user.id, language_id: language.id, language_name: language.name,
          native_language: profile.native_language || 'English',
          user_level: profile.level || 'A1',
          message: userText,
          history: transcript.slice(-6).map(t => ({ role: t.role, content: t.text })),
          tutor_state: tutorState, session_id: sessionId, mode: 'voice',
        }),
      })
      const data = await res.json()
      if (data.error) { toast.error('Could not get tutor response'); setVoiceState('idle'); return }
      const reply = data.reply || ''
      setTranscript(prev => [...prev, { role: 'assistant', text: reply }])
      setLastReply(reply)
      if (data.updated_state) setTutorState(data.updated_state)
      speak(reply, language.slug)
    } catch { toast.error('Network error'); setVoiceState('idle') }
  }

  if (!isPaid) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-2xl mx-auto">
          <PlanGate feature="hands-free Driving Mode"><div /></PlanGate>
        </div>
      </DashboardLayout>
    )
  }

  const STATE_LABELS: Record<VoiceState, string> = {
    idle: 'Tap to speak',
    listening: 'Listening...',
    processing: 'Thinking...',
    speaking: 'Tutor speaking...',
  }

  const STATE_COLORS: Record<VoiceState, string> = {
    idle: 'from-cyan-500 to-pink-500',
    listening: 'from-green-400 to-emerald-500',
    processing: 'from-yellow-400 to-orange-400',
    speaking: 'from-purple-400 to-pink-500',
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
      <Link to={`/learn/${slug}/tutor`} className="absolute top-6 left-6">
        <Button variant="ghost" size="sm" className="gap-1">
          <ChevronLeft className="w-4 h-4" /> Exit Driving Mode
        </Button>
      </Link>

      <div className="flex items-center gap-2 mb-2 text-muted-foreground">
        <Car className="w-5 h-5" />
        <span className="text-sm font-medium">Hands-Free Mode</span>
      </div>

      <div className="text-5xl mb-4">{language?.flag}</div>
      <h1 className="text-2xl font-bold mb-2">{language?.name} Practice</h1>
      <p className="text-muted-foreground text-sm mb-10">Speak naturally. Your AI tutor listens and responds.</p>

      {lastReply && (
        <div className="max-w-lg bg-white/5 border border-white/10 rounded-2xl px-6 py-4 mb-10 text-sm text-left leading-relaxed">
          {lastReply.split('[Tutor Notes]')[0].trim()}
        </div>
      )}

      <motion.button
        onClick={voiceState === 'idle' ? startListening : stopAll}
        disabled={voiceState === 'processing'}
        className={cn(
          'w-32 h-32 rounded-full flex items-center justify-center text-white shadow-2xl transition-all',
          `bg-gradient-to-br ${STATE_COLORS[voiceState]}`,
          voiceState === 'processing' && 'opacity-60 cursor-not-allowed'
        )}
        animate={voiceState === 'listening' ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {voiceState === 'speaking' ? <Volume2 className="w-12 h-12" /> :
         voiceState === 'idle' ? <Mic className="w-12 h-12" /> :
         voiceState === 'processing' ? <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" /> :
         <MicOff className="w-12 h-12" />}
      </motion.button>

      <p className="mt-6 text-lg font-medium text-muted-foreground">{STATE_LABELS[voiceState]}</p>

      {voiceState !== 'idle' && (
        <Button variant="ghost" onClick={stopAll} className="mt-4 text-red-400 hover:text-red-300">
          <Square className="w-4 h-4 mr-1" /> Stop
        </Button>
      )}

      <p className="text-xs text-muted-foreground mt-10 max-w-sm">
        Uses your browser's built-in speech recognition. Works best in Chrome. Keep your device unlocked while driving.
      </p>
    </div>
  )
}
