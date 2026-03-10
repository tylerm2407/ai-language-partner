import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { ChevronRight, ChevronLeft, Clock, BookOpen, MessageSquare, PenLine, Music, Newspaper } from 'lucide-react'

const KIND_ICONS: Record<string, React.ReactNode> = {
  vocab: <BookOpen className="w-4 h-4" />,
  reading: <BookOpen className="w-4 h-4" />,
  writing: <PenLine className="w-4 h-4" />,
  conversation: <MessageSquare className="w-4 h-4" />,
  music: <Music className="w-4 h-4" />,
  news: <Newspaper className="w-4 h-4" />,
}

export default function CoursePage() {
  const { slug, courseId } = useParams<{ slug: string; courseId: string }>()
  const [course, setCourse] = useState<any>(null)
  const [lessons, setLessons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!courseId) return
    Promise.all([
      supabase.from('courses').select('*').eq('id', courseId).single(),
      supabase.from('lessons').select('*').eq('course_id', courseId).eq('is_published', true).order('order_index'),
    ]).then(([{ data: c }, { data: l }]) => {
      if (c) setCourse(c)
      if (l) setLessons(l)
      setLoading(false)
    })
  }, [courseId])

  if (loading) return <DashboardLayout><div className="p-8 animate-pulse text-muted-foreground">Loading...</div></DashboardLayout>
  if (!course) return <DashboardLayout><div className="p-8 text-muted-foreground">Course not found.</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Link to={`/learn/${slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to {slug}
        </Link>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6">
          <h1 className="text-2xl font-bold mb-2">{course.title}</h1>
          <p className="text-muted-foreground text-sm mb-3">{course.description}</p>
          <div className="text-xs text-muted-foreground">
            Level {course.level_min}–{course.level_max} · {lessons.length} lessons
          </div>
        </motion.div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Lessons</h2>
          {lessons.length === 0 ? (
            <p className="text-muted-foreground text-sm">No lessons published yet.</p>
          ) : (
            lessons.map((lesson, i) => (
              <motion.div
                key={lesson.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/learn/${slug}/lesson/${lesson.id}`}>
                  <div className="rounded-xl border border-white/10 hover:border-cyan-400/40 p-4 flex items-center justify-between transition-all hover:bg-white/5 group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-cyan-400/10 flex items-center justify-center text-cyan-400">
                        {KIND_ICONS[lesson.kind] || <BookOpen className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-medium text-sm group-hover:text-cyan-400 transition-colors">
                          {lesson.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="capitalize">{lesson.kind}</span>
                          <span>·</span>
                          <span>{lesson.level}</span>
                          <span>·</span>
                          <Clock className="w-3 h-3" />
                          <span>{lesson.estimated_minutes} min</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
