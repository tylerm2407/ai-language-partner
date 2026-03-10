import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/hooks/useLanguage'
import { getStaticLessonById } from '@/lib/staticCourses'
import DashboardLayout from '@/components/DashboardLayout'
import PlanGate from '@/components/PlanGate'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  CheckCircle, BookOpen, PenTool, Loader2,
  ChevronRight, ChevronLeft, Languages
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserPlan } from '@/hooks/useUserPlan'

export default function LessonPage() {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>()
  const { user, profile } = useAuth()
  const { language } = useLanguage(slug!)
  const { isPaid } = useUserPlan()
  const navigate = useNavigate()

  const [lesson, setLesson] = useState<any>(null)
  const [contents, setContents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)
  const [isStatic, setIsStatic] = useState(false)

  const [writing, setWriting] = useState('')
  const [writingFeedback, setWritingFeedback] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)

  const [translating, setTranslating] = useState<Record<string, boolean>>({})
  const [translations, setTranslations] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!lessonId || !language) return

    const staticLesson = getStaticLessonById(lessonId, language.name, slug!)
    if (staticLesson) {
      setLesson(staticLesson)
      setContents(staticLesson.contents)
      setIsStatic(true)
      setLoading(false)
      return
    }

    Promise.all([
      supabase.from('lessons').select('*, courses(*, languages(*))').eq('id', lessonId).single(),
      supabase.from('lesson_contents').select('*').eq('lesson_id', lessonId).order('sort_order'),
      user ? supabase.from('user_lesson_progress').select('*').eq('user_id', user.id).eq('lesson_id', lessonId).single() : Promise.resolve({ data: null }),
    ]).then(([{ data: l, error: le }, { data: c }, { data: p }]) => {
      if (le || !l) {
        toast.error('Lesson not found')
        navigate(`/learn/${slug}`)
        return
      }
      setLesson(l)
      if (c) setContents(c)
      if ((p as any)?.completed) setCompleted(true)
      setLoading(false)
    })
  }, [lessonId, language, slug, user])

  const markComplete = async () => {
    setCompleted(true)
    if (!isStatic && user && lessonId) {
      await supabase.from('user_lesson_progress').upsert({
        user_id: user.id,
        lesson_id: lessonId,
        completed: true,
        completed_at: new Date().toISOString(),
      })
    }
    await supabase.rpc('add_xp', { user_id: user?.id, xp_amount: lesson?.xp_reward || 20 })
    toast.success(`+${lesson?.xp_reward || 20} XP! Lesson complete!`)
  }

  const translate = async (contentId: string, text: string) => {
    setTranslating(p => ({ ...p, [contentId]: true }))
    try {
      const session = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reading-help`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ text, language: language?.name, action: 'translate' }),
      })
      const data = await res.json()
      if (data.result) setTranslations(p => ({ ...p, [contentId]: data.result }))
      else toast.error('Translation unavailable')
    } catch {
      toast.error('Translation failed')
    } finally {
      setTranslating(p => ({ ...p, [contentId]: false }))
    }
  }

  const submitWriting = async (prompt: string) => {
    if (!writing.trim() || writing.split(' ').length < 5) {
      toast.error('Please write at least a few sentences')
      return
    }
    if (!isPaid) {
      toast.error('Upgrade to Pro for AI writing feedback')
      return
    }
    setSubmitting(true)
    try {
      const session = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/writing-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({
          language: language?.name,
          prompt,
          submission: writing,
          lessonId: isStatic ? null : lessonId,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setWritingFeedback(data)
      toast.success(`Score: ${data.score}/100`)
    } catch (e: any) {
      toast.error(e.message || 'Feedback unavailable')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !language) {
    return <DashboardLayout><div className="p-8 text-muted-foreground animate-pulse">Loading lesson...</div></DashboardLayout>
  }
  if (!lesson) return null

  const courseId = lesson.course_id || (lessonId?.includes('foundations') ? `static-${slug}-foundations` : null)

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to={`/learn/${slug}`} className="hover:text-foreground transition-colors">{language.name}</Link>
          <ChevronRight className="w-3 h-3" />
          {courseId && (
            <>
              <Link to={`/learn/${slug}/course/${courseId}`} className="hover:text-foreground transition-colors">Course</Link>
              <ChevronRight className="w-3 h-3" />
            </>
          )}
          <span className="text-foreground">{lesson.title}</span>
        </div>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{language.flag}</span>
            <div>
              <h1 className="text-2xl font-bold">{lesson.title}</h1>
              {lesson.description && <p className="text-muted-foreground">{lesson.description}</p>}
            </div>
          </div>
        </motion.div>

        <div className="space-y-6 mb-8">
          {contents.map((c: any, i: number) => (
            <motion.div
              key={c.id || i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              {c.content_type === 'text' && (
                <div className="p-5 rounded-xl border border-white/10 bg-white/5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-foreground whitespace-pre-line leading-relaxed">{c.content.text}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0"
                      onClick={() => translate(c.id || String(i), c.content.text)}
                      disabled={translating[c.id || String(i)]}
                    >
                      {translating[c.id || String(i)]
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Languages className="w-4 h-4" />}
                    </Button>
                  </div>
                  {translations[c.id || String(i)] && (
                    <div className="mt-3 pt-3 border-t border-white/10 text-sm text-muted-foreground">
                      <span className="font-medium text-cyan-400">Translation: </span>
                      {translations[c.id || String(i)]}
                    </div>
                  )}
                </div>
              )}

              {c.content_type === 'vocab_list' && (
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  <div className="px-5 py-3 bg-white/5 border-b border-white/10">
                    <h3 className="font-semibold flex items-center gap-2"><BookOpen className="w-4 h-4 text-green-400" />Vocabulary</h3>
                  </div>
                  <div className="divide-y divide-white/5">
                    {(c.content.words || []).map((word: any, wi: number) => (
                      <div key={wi} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.03] transition-colors">
                        <span className="font-medium text-lg">{word.target}</span>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">{word.native}</p>
                          {word.transliteration && <p className="text-xs text-muted-foreground/60 italic">{word.transliteration}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {c.content_type === 'writing_prompt' && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <PenTool className="w-4 h-4 text-pink-400" />Writing Practice
                  </h3>
                  <p className="text-muted-foreground mb-4">{c.content.prompt}</p>
                  {isPaid ? (
                    <>
                      <Textarea
                        value={writing}
                        onChange={e => setWriting(e.target.value)}
                        placeholder={`Write in ${language.name}...`}
                        rows={5}
                        className="mb-3"
                      />
                      <Button onClick={() => submitWriting(c.content.prompt)} disabled={submitting || !writing.trim()}>
                        {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Getting feedback...</> : 'Submit for AI Feedback'}
                      </Button>
                      {writingFeedback && (
                        <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10 space-y-3">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl font-bold text-cyan-400">{writingFeedback.score}</span>
                            <span className="text-muted-foreground">/100</span>
                          </div>
                          {writingFeedback.summary && <p className="text-sm">{writingFeedback.summary}</p>}
                          {writingFeedback.corrections?.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-2">Corrections:</p>
                              {writingFeedback.corrections.map((cor: any, ci: number) => (
                                <div key={ci} className="text-sm text-muted-foreground mb-1">
                                  <span className="line-through text-red-400">{cor.original}</span>
                                  {' > '}
                                  <span className="text-green-400">{cor.corrected}</span>
                                  {cor.explanation && <span className="text-muted-foreground"> - {cor.explanation}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          {writingFeedback.model_rewrite && (
                            <div>
                              <p className="text-sm font-medium mb-1">Improved version:</p>
                              <p className="text-sm text-muted-foreground italic">{writingFeedback.model_rewrite}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <PlanGate />
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {!completed ? (
          <Button size="lg" onClick={markComplete} className="w-full sm:w-auto">
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark Complete (+{lesson.xp_reward || 20} XP)
          </Button>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-green-400 font-medium">
              <CheckCircle className="w-5 h-5" />
              Lesson Complete!
            </div>
            {courseId && (
              <Button asChild variant="outline">
                <Link to={`/learn/${slug}/course/${courseId}`}>
                  <ChevronLeft className="w-4 h-4 mr-1" />Back to Course
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
