import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { motion } from 'framer-motion'
import { ChevronLeft, Clock, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

export default function LessonPage() {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>()
  const { user } = useAuth()
  const [lesson, setLesson] = useState<any>(null)
  const [contents, setContents] = useState<any[]>([])
  const [course, setCourse] = useState<any>(null)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!lessonId) return
    Promise.all([
      supabase.from('lessons').select('*, courses(*)').eq('id', lessonId).single(),
      supabase.from('lesson_contents').select('*').eq('lesson_id', lessonId).order('order_index'),
    ]).then(([{ data: l }, { data: c }]) => {
      if (l) { setLesson(l); setCourse(l.courses) }
      if (c) setContents(c)
      setLoading(false)
    })

    if (user) {
      supabase.from('user_lesson_progress')
        .select('status').eq('user_id', user.id).eq('lesson_id', lessonId).single()
        .then(({ data }) => { if (data?.status === 'completed') setCompleted(true) })
    }
  }, [lessonId, user])

  const markComplete = async () => {
    if (!user || !lessonId) return
    await supabase.from('user_lesson_progress').upsert({
      user_id: user.id,
      lesson_id: lessonId,
      status: 'completed',
      attempts: 1,
      last_submitted_at: new Date().toISOString(),
    }, { onConflict: 'user_id,lesson_id' })
    setCompleted(true)
  }

  if (loading) return <DashboardLayout><div className="p-8 animate-pulse text-muted-foreground">Loading...</div></DashboardLayout>
  if (!lesson) return <DashboardLayout><div className="p-8 text-muted-foreground">Lesson not found.</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Link
          to={course ? `/learn/${slug}/course/${course.id}` : `/learn/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to course
        </Link>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-start justify-between gap-4 mb-2">
            <h1 className="text-2xl font-bold">{lesson.title}</h1>
            {completed && (
              <div className="flex items-center gap-1 text-green-400 text-sm font-medium flex-shrink-0">
                <CheckCircle className="w-4 h-4" /> Completed
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="capitalize bg-white/10 px-2 py-0.5 rounded-full">{lesson.kind}</span>
            <span>{lesson.level}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {lesson.estimated_minutes} min</span>
          </div>
        </motion.div>

        <div className="space-y-6">
          {contents.map((block, i) => (
            <motion.div
              key={block.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-xl border border-white/10 p-6 bg-white/[0.02]"
            >
              {block.content_type === 'vocab_list' && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 mb-4">Vocabulary</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {block.body.split('|').map((pair: string, j: number) => {
                      const [target, eng] = pair.split('=').map((s: string) => s.trim())
                      return (
                        <div key={j} className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{target}</span>
                          {eng && <><span className="text-muted-foreground">—</span><span className="text-muted-foreground">{eng}</span></>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {(block.content_type === 'text' || block.content_type === 'public_domain_text') && (
                <div>
                  {block.content_type === 'public_domain_text' && block.license_info && (
                    <div className="text-xs text-muted-foreground mb-3 italic">{block.license_info}</div>
                  )}
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{block.body}</pre>
                </div>
              )}
              {block.content_type === 'exercise' && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-pink-400 mb-4">Exercise</h3>
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{block.body}</pre>
                </div>
              )}
              {block.content_type === 'music_snippet' && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-400 mb-3">Music</h3>
                  <p className="text-sm italic">{block.body}</p>
                  {block.source_url && (
                    <a href={block.source_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-cyan-400 underline mt-2 inline-block">
                      Listen on external site
                    </a>
                  )}
                </div>
              )}
              {block.content_type === 'article_link' && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-yellow-400 mb-3">Article</h3>
                  <p className="text-sm text-muted-foreground mb-2">{block.body}</p>
                  {block.source_url && (
                    <a href={block.source_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline">Read Article</Button>
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {!completed && (
          <div className="flex justify-end pt-4">
            <Button
              onClick={markComplete}
              className="bg-gradient-to-r from-cyan-500 to-pink-500 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" /> Mark as Complete
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
