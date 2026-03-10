import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { motion } from 'framer-motion'
import {
  BookOpen, PenTool, MessageSquare, Mic, Music, Newspaper,
  CheckCircle, Clock, BarChart, ChevronRight, PlayCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

const KIND_ICONS: Record<string, any> = {
  vocab: BookOpen, reading: BookOpen, writing: PenTool,
  conversation: MessageSquare, pronunciation: Mic, music: Music, news: Newspaper,
}
const KIND_COLORS: Record<string, string> = {
  vocab: 'text-green-400', reading: 'text-cyan-400', writing: 'text-pink-400',
  conversation: 'text-purple-400', pronunciation: 'text-orange-400',
  music: 'text-yellow-400', news: 'text-blue-400',
}

export default function CoursePage() {
  const { slug, courseId } = useParams<{ slug: string; courseId: string }>()
  const { user } = useAuth()
  const [course, setCourse] = useState<any>(null)
  const [lessons, setLessons] = useState<any[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!courseId || !user) return
    Promise.all([
      supabase.from('courses').select('*, languages(*)').eq('id', courseId).single(),
      supabase.from('lessons').select('*').eq('course_id', courseId).eq('is_published', true).order('order_index'),
    ]).then(async ([{ data: c }, { data: l }]) => {
      if (c) setCourse(c)
      if (l) {
        setLessons(l)
        const lessonIds = l.map((x: any) => x.id)
        if (lessonIds.length > 0) {
          const { data: prog } = await supabase.from('user_lesson_progress')
            .select('*').eq('user_id', user.id).in('lesson_id', lessonIds)
          if (prog) {
            const map: Record<string, any> = {}
            prog.forEach((p: any) => { map[p.lesson_id] = p })
            setProgressMap(map)
          }
        }
      }
      setLoading(false)
    })
  }, [courseId, user])

  if (loading) return <DashboardLayout><div className="p-8 text-muted-foreground animate-pulse">Loading course...</div></DashboardLayout>
  if (!course) return <DashboardLayout><div className="p-8 text-muted-foreground">Course not found.</div></DashboardLayout>

  const completedCount = lessons.filter(l => progressMap[l.id]?.status === 'completed').length
  const progressPercent = lessons.length > 0 ? (completedCount / lessons.length) * 100 : 0
  const nextLesson = lessons.find(l => progressMap[l.id]?.status !== 'completed')

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Breadcrumb */}
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Link to={`/learn/${slug}`} className="hover:text-foreground">{course.languages?.name}</Link>
          <span>/</span>
          <span>{course.title}</span>
        </div>

        {/* Course header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="text-xs bg-cyan-400/10 text-cyan-400 px-2 py-0.5 rounded-full capitalize mb-2 inline-block">{course.type}</span>
              <h1 className="text-2xl font-bold">{course.title}</h1>
              <p className="text-muted-foreground text-sm mt-1">{course.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
            <span className="flex items-center gap-1"><BarChart className="w-3 h-3" /> {course.level_min}&ndash;{course.level_max}</span>
            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {lessons.length} lessons</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> ~{lessons.reduce((a: number, l: any) => a + (l.estimated_minutes || 0), 0)} min total</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{completedCount}/{lessons.length} completed</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
          {nextLesson && (
            <Link to={`/learn/${slug}/lesson/${nextLesson.id}`} className="mt-4 block">
              <Button className="gap-2 bg-gradient-to-r from-cyan-500 to-pink-500 text-white">
                <PlayCircle className="w-4 h-4" />
                {completedCount === 0 ? 'Start Course' : 'Continue Learning'}
              </Button>
            </Link>
          )}
          {completedCount === lessons.length && lessons.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-green-400 font-semibold">
              <CheckCircle className="w-5 h-5" /> Course Complete!
            </div>
          )}
        </motion.div>

        {/* Lessons list */}
        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Lessons</h2>
          {lessons.map((lesson, i) => {
            const prog = progressMap[lesson.id]
            const status = prog?.status || 'not_started'
            const Icon = KIND_ICONS[lesson.kind] || BookOpen
            const colorClass = KIND_COLORS[lesson.kind] || 'text-cyan-400'
            return (
              <motion.div key={lesson.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}>
                <Link to={`/learn/${slug}/lesson/${lesson.id}`}>
                  <div className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border transition-all hover:bg-white/5',
                    status === 'completed' ? 'border-green-500/30 bg-green-500/5' : 'border-white/10'
                  )}>
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                      status === 'completed' ? 'bg-green-500/20' : 'bg-white/10')}>
                      {status === 'completed'
                        ? <CheckCircle className="w-5 h-5 text-green-400" />
                        : <Icon className={cn('w-5 h-5', colorClass)} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{lesson.title}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className={cn('capitalize', colorClass)}>{lesson.kind}</span>
                        <span>·</span>
                        <span>{lesson.level}</span>
                        <span>·</span>
                        <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{lesson.estimated_minutes}m</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {prog?.last_score != null && (
                        <span className="text-xs text-yellow-400 font-medium">{prog.last_score}/100</span>
                      )}
                      {status === 'completed'
                        ? <span className="text-xs text-green-400 font-medium">Done</span>
                        : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
          {lessons.length === 0 && (
            <p className="text-muted-foreground text-sm">No lessons published yet.</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
