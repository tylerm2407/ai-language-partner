import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/hooks/useLanguage'
import { getStaticCourse, isStaticCourseId } from '@/lib/staticCourses'
import DashboardLayout from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { motion } from 'framer-motion'
import {
  BookOpen, PenTool, MessageSquare, Mic,
  CheckCircle, Lock, ChevronRight, PlayCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TYPE_ICONS: Record<string, any> = {
  vocabulary: BookOpen,
  reading: BookOpen,
  writing: PenTool,
  conversation: MessageSquare,
  grammar: BookOpen,
  pronunciation: Mic,
}
const TYPE_COLORS: Record<string, string> = {
  vocabulary: 'text-green-400',
  reading: 'text-cyan-400',
  writing: 'text-pink-400',
  conversation: 'text-purple-400',
  grammar: 'text-yellow-400',
  pronunciation: 'text-orange-400',
}

export default function CoursePage() {
  const { slug, courseId } = useParams<{ slug: string; courseId: string }>()
  const { user } = useAuth()
  const { language } = useLanguage(slug!)
  const [course, setCourse] = useState<any>(null)
  const [lessons, setLessons] = useState<any[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [isStatic, setIsStatic] = useState(false)

  useEffect(() => {
    if (!courseId || !language) return

    if (isStaticCourseId(courseId)) {
      const staticCourse = getStaticCourse(language.name, slug!)
      setCourse({ ...staticCourse, languages: language })
      setLessons(staticCourse.lessons)
      setIsStatic(true)
      setLoading(false)
      return
    }

    Promise.all([
      supabase.from('courses').select('*, languages(*)').eq('id', courseId).single(),
      supabase.from('lessons').select('*').eq('course_id', courseId).order('sort_order'),
    ]).then(async ([{ data: c, error: ce }, { data: l }]) => {
      if (ce || !c) {
        const staticCourse = getStaticCourse(language.name, slug!)
        setCourse({ ...staticCourse, languages: language })
        setLessons(staticCourse.lessons)
        setIsStatic(true)
      } else {
        setCourse(c)
        if (l) {
          setLessons(l)
          const { data: prog } = await supabase.from('user_lesson_progress')
            .select('*').eq('user_id', user!.id).in('lesson_id', l.map((x: any) => x.id))
          if (prog) {
            const map: Record<string, any> = {}
            prog.forEach((p: any) => { map[p.lesson_id] = p })
            setProgressMap(map)
          }
        }
      }
      setLoading(false)
    })
  }, [courseId, language, slug, user])

  if (loading || !language) {
    return <DashboardLayout><div className="p-8 text-muted-foreground animate-pulse">Loading course...</div></DashboardLayout>
  }
  if (!course) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground mb-4">Course not found.</p>
          <Button asChild variant="outline"><Link to={`/learn/${slug}`}>Back to {language.name}</Link></Button>
        </div>
      </DashboardLayout>
    )
  }

  const completedCount = lessons.filter(l => progressMap[l.id]?.completed).length
  const progressPct = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0
  const nextLesson = lessons.find(l => !progressMap[l.id]?.completed)

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/languages" className="hover:text-foreground transition-colors">Languages</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to={`/learn/${slug}`} className="hover:text-foreground transition-colors">{language.name}</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground">{course.title}</span>
        </div>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">{language.flag}</span>
            <div>
              <h1 className="text-2xl font-bold">{course.title}</h1>
              {course.description && <p className="text-muted-foreground">{course.description}</p>}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">{completedCount} of {lessons.length} lessons completed</span>
              <span className="font-medium">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>
        </motion.div>

        {nextLesson && (
          <div className="mb-6">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to={`/learn/${slug}/lesson/${nextLesson.id}`}>
                <PlayCircle className="w-4 h-4 mr-2" />
                {completedCount === 0 ? 'Start Course' : 'Continue'}
              </Link>
            </Button>
          </div>
        )}
        {!nextLesson && lessons.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 font-medium text-center">
            Course Complete! You have finished all lessons.
          </div>
        )}

        <div className="space-y-3">
          {lessons.map((lesson, i) => {
            const done = progressMap[lesson.id]?.completed
            const locked = !isStatic && i > 0 && !progressMap[lessons[i - 1]?.id]?.completed && i > completedCount + 1
            const Icon = TYPE_ICONS[lesson.type] || BookOpen
            const colorClass = TYPE_COLORS[lesson.type] || 'text-muted-foreground'

            return (
              <motion.div
                key={lesson.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={locked ? '#' : `/learn/${slug}/lesson/${lesson.id}`} className={locked ? 'pointer-events-none' : ''}>
                  <div className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border transition-all',
                    done
                      ? 'border-green-500/30 bg-green-500/5'
                      : locked
                      ? 'border-white/5 bg-white/[0.02] opacity-50'
                      : 'border-white/10 hover:border-cyan-400/40 bg-white/5 hover:bg-white/[0.08] cursor-pointer group'
                  )}>
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                      done ? 'bg-green-500/20' : 'bg-white/5'
                    )}>
                      {done
                        ? <CheckCircle className="w-5 h-5 text-green-400" />
                        : locked
                        ? <Lock className="w-5 h-5 text-muted-foreground" />
                        : <Icon className={cn('w-5 h-5', colorClass)} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-medium', done ? 'text-green-400' : !locked && 'group-hover:text-cyan-400 transition-colors')}>
                        {lesson.title}
                      </p>
                      {lesson.description && (
                        <p className="text-sm text-muted-foreground truncate">{lesson.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">+{lesson.xp_reward} XP</span>
                      {!locked && !done && <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-cyan-400 transition-colors" />}
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </DashboardLayout>
  )
}
