import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import PlanGate from '@/components/PlanGate'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { CheckCircle, Lightbulb, BookOpen, PenTool, Loader2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserPlan } from '@/hooks/useUserPlan'

export default function LessonPage() {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>()
  const { user, profile } = useAuth()
  const { isPaid } = useUserPlan()
  const navigate = useNavigate()

  const [lesson, setLesson] = useState<any>(null)
  const [contents, setContents] = useState<any[]>([])
  const [language, setLanguage] = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [writing, setWriting] = useState('')
  const [writingPrompt, setWritingPrompt] = useState('')
  const [writingFeedback, setWritingFeedback] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)

  const [translating, setTranslating] = useState<Record<string, boolean>>({})
  const [translations, setTranslations] = useState<Record<string, string>>({})

  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    if (!lessonId || !user) return
    Promise.all([
      supabase.from('lessons').select('*, courses(*, languages(*))').eq('id', lessonId).single(),
      supabase.from('lesson_contents').select('*').eq('lesson_id', lessonId).order('order_index'),
      supabase.from('user_lesson_progress').select('*').eq('user_id', user.id).eq('lesson_id', lessonId).single(),
    ]).then(([{ data: l }, { data: c }, { data: p }]) => {
      if (l) {
        setLesson(l)
        setLanguage(l.courses?.languages)
        const writingContent = c?.find((x: any) => x.content_type === 'exercise' && x.metadata?.type === 'writing')
        if (writingContent) setWritingPrompt(writingContent.metadata?.prompt || '')
      }
      if (c) setContents(c)
      if (p) { setProgress(p); if (p.status === 'completed') setCompleted(true) }
      setLoading(false)
    })
  }, [lessonId, user])

  const translate = async (contentId: string, text: string) => {
    setTranslating(p => ({ ...p, [contentId]: true }))
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reading-help`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          word_or_phrase: text, sentence_context: text,
          language_name: language?.name || 'Spanish',
          native_language: profile?.native_language || 'English',
          user_level: profile?.level || 'A1',
          request_type: 'translate'
        }),
      })
      const data = await res.json()
      setTranslations(p => ({ ...p, [contentId]: data.result || '' }))
    } catch { toast.error('Translation failed') }
    finally { setTranslating(p => ({ ...p, [contentId]: false })) }
  }

  const submitWriting = async () => {
    if (!writing.trim() || !user || !language || !lesson) return
    if (!isPaid) { toast.error('Writing feedback requires Pro'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/writing-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          user_id: user.id, lesson_id: lesson.id, language_id: language.id,
          language_name: language.name, user_level: profile?.level || 'A1',
          prompt: writingPrompt, submission: writing,
        }),
      })
      const data = await res.json()
      if (data.error === 'upgrade_required') { toast.error('Pro required'); return }
      setWritingFeedback(data.feedback)
      setCompleted(true)
      toast.success('Feedback received!')
    } catch { toast.error('Submission failed') }
    finally { setSubmitting(false) }
  }

  const markComplete = async () => {
    if (!user || !lesson) return
    await supabase.from('user_lesson_progress').upsert(
      { user_id: user.id, lesson_id: lesson.id, status: 'completed', last_submitted_at: new Date().toISOString() },
      { onConflict: 'user_id,lesson_id' }
    )
    setCompleted(true)
    toast.success('Lesson complete! +10 XP')
    await supabase.rpc('add_xp', { user_id: user.id, xp_amount: 10 })
  }

  if (loading) return <DashboardLayout><div className="p-8 animate-pulse text-muted-foreground">Loading lesson...</div></DashboardLayout>
  if (!lesson) return <DashboardLayout><div className="p-8 text-muted-foreground">Lesson not found.</div></DashboardLayout>

  const isWriting = lesson.kind === 'writing'

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link to={`/learn/${slug}`} className="hover:text-foreground">{language?.name}</Link>
            <span>/</span>
            <span>{lesson.courses?.title}</span>
          </div>
          <div className="flex items-center gap-3">
            {isWriting ? <PenTool className="w-6 h-6 text-pink-400" /> : <BookOpen className="w-6 h-6 text-cyan-400" />}
            <h1 className="text-2xl font-bold">{lesson.title}</h1>
            {completed && <CheckCircle className="w-5 h-5 text-green-400" />}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="bg-cyan-400/10 text-cyan-400 px-2 py-0.5 rounded-full capitalize">{lesson.kind}</span>
            <span>{lesson.level}</span>
            <span>~{lesson.estimated_minutes} min</span>
          </div>
        </div>

        {contents.map((content) => (
          <motion.div key={content.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/10 bg-white/5 p-5">
            {(content.content_type === 'text' || content.content_type === 'public_domain_text') && (
              <div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3">{content.body}</p>
                {content.source_url && (
                  <p className="text-xs text-muted-foreground">Source: {content.license_info || 'Public domain'}</p>
                )}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => translate(content.id, content.body)}
                    disabled={translating[content.id]} className="gap-1">
                    {translating[content.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
                    Translate
                  </Button>
                </div>
                {translations[content.id] && (
                  <div className="mt-3 bg-cyan-400/5 border border-cyan-400/20 rounded-lg p-3 text-sm text-muted-foreground">
                    {translations[content.id]}
                  </div>
                )}
              </div>
            )}

            {content.content_type === 'vocab_list' && (
              <div>
                <h3 className="font-semibold text-sm mb-3">Vocabulary</h3>
                <div className="grid grid-cols-2 gap-2">
                  {(content.metadata?.vocab || []).map((item: { word: string; meaning: string }, i: number) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3">
                      <div className="font-medium text-sm">{item.word}</div>
                      <div className="text-xs text-muted-foreground">{item.meaning}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {content.content_type === 'exercise' && content.metadata?.type !== 'writing' && (
              <div>
                <h3 className="font-semibold text-sm mb-3">{content.metadata?.question || 'Exercise'}</h3>
                <p className="text-sm text-muted-foreground">{content.body}</p>
                {content.metadata?.hint && (
                  <p className="text-xs text-cyan-400 mt-2">💡 {content.metadata.hint}</p>
                )}
              </div>
            )}
          </motion.div>
        ))}

        {isWriting && (
          <div className="rounded-xl border border-pink-400/30 bg-pink-400/5 p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <PenTool className="w-4 h-4 text-pink-400" /> Writing Exercise
            </h3>
            {writingPrompt && <p className="text-sm text-muted-foreground italic">"{writingPrompt}"</p>}
            <Textarea value={writing} onChange={e => setWriting(e.target.value)}
              placeholder={`Write in ${language?.name}...`}
              className="min-h-[120px] bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground" />
            {isPaid ? (
              <Button onClick={submitWriting} disabled={!writing.trim() || submitting} className="gap-1">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                Submit for AI Feedback
              </Button>
            ) : (
              <PlanGate feature="AI writing feedback">
                <></>
              </PlanGate>
            )}
          </div>
        )}

        {writingFeedback && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-xl border border-green-400/30 bg-green-400/5 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">AI Feedback</h3>
              <div className="text-2xl font-bold text-green-400">{writingFeedback.score}/100</div>
            </div>
            <p className="text-sm">{writingFeedback.summary}</p>
            {writingFeedback.corrections?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Corrections</h4>
                <div className="space-y-2">
                  {writingFeedback.corrections.map((c: any, i: number) => (
                    <div key={i} className="text-xs bg-orange-400/10 rounded-lg p-3">
                      <span className="line-through text-red-400">{c.original}</span>
                      <span className="mx-2">→</span>
                      <span className="text-green-400">{c.corrected}</span>
                      <p className="text-muted-foreground mt-1">{c.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {writingFeedback.suggestions?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Suggestions</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {writingFeedback.suggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {!completed && !isWriting && (
          <Button onClick={markComplete} className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white">
            <CheckCircle className="w-4 h-4 mr-2" /> Mark as Complete (+10 XP)
          </Button>
        )}
        {completed && (
          <div className="rounded-xl border border-green-400/30 bg-green-400/5 p-4 text-center text-green-400 font-semibold">
            ✅ Lesson Complete!
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
