import { useParams, Link } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import PlanGate from '@/components/PlanGate'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { BookOpen, Newspaper, Music, MessageSquare, ChevronRight } from 'lucide-react'
import { getStaticCourse } from '@/lib/staticCourses'
import PopularSongsSection from '@/components/PopularSongsSection'
import SRSStatsWidget from '@/components/SRSStatsWidget'

export default function LanguagePage() {
  const { slug } = useParams<{ slug: string }>()
  const { language, loading: langLoading } = useLanguage(slug!)
  const [courses, setCourses] = useState<any[]>([])
  const [news, setNews] = useState<any[]>([])

  const staticCourse = slug && language ? getStaticCourse(language.name, slug) : null
  const displayCourses = courses.length > 0 ? courses : (staticCourse ? [staticCourse] : [])

  useEffect(() => {
    if (!slug) return
    supabase
      .from('languages')
      .select('id')
      .eq('slug', slug)
      .single()
      .then(({ data: langRow }) => {
        if (!langRow?.id) return
        supabase
          .from('courses')
          .select('*, lessons(count)')
          .eq('language_id', langRow.id)
          .order('sort_order')
          .then(({ data }) => { if (data && data.length > 0) setCourses(data) })

        supabase
          .from('news_articles')
          .select('*')
          .eq('language_id', langRow.id)
          .order('published_at', { ascending: false })
          .limit(6)
          .then(({ data }) => { if (data) setNews(data) })
      })
  }, [slug])

  if (langLoading && !language) {
    return (
      <AppShell showBack title="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  if (!language) {
    return (
      <AppShell showBack title="Not Found">
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">Language not found.</p>
          <Button asChild variant="outline"><Link to="/learn">Browse Languages</Link></Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell showBack backTo="/learn" title={language.name}>
      <div className="py-4">
        {/* Language header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 sm:gap-4 mb-5 py-2"
        >
          <span className="text-4xl sm:text-5xl">{language.flag}</span>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">{language.name}</h1>
            <p className="text-sm text-muted-foreground truncate">{language.native_name} · {language.family}</p>
          </div>
        </motion.div>

        <Tabs defaultValue="learn">
          <TabsList className="w-full mb-5 grid grid-cols-4 h-11">
            <TabsTrigger value="learn" className="text-[11px] sm:text-xs gap-1"><BookOpen className="w-3.5 h-3.5 hidden sm:block" />Courses</TabsTrigger>
            <TabsTrigger value="news" className="text-[11px] sm:text-xs gap-1"><Newspaper className="w-3.5 h-3.5 hidden sm:block" />News</TabsTrigger>
            <TabsTrigger value="music" className="text-[11px] sm:text-xs gap-1"><Music className="w-3.5 h-3.5 hidden sm:block" />Music</TabsTrigger>
            <TabsTrigger value="tutor" className="text-[11px] sm:text-xs gap-1"><MessageSquare className="w-3.5 h-3.5 hidden sm:block" />Tutor</TabsTrigger>
          </TabsList>

          {/* COURSES */}
          <TabsContent value="learn" className="space-y-3">
            <SRSStatsWidget languageSlug={slug!} languageName={language.name} languageFlag={language.flag} />
            {displayCourses.map((course, i) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/learn/${slug}/course/${course.id}`}>
                  <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border border-border bg-card active:bg-secondary hover:bg-secondary/50 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm sm:text-base truncate">{course.title}</p>
                      {course.description && <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">{course.description}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {course.lessons?.length ?? 5} lessons
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </TabsContent>

          {/* NEWS */}
          <TabsContent value="news" className="space-y-3">
            {news.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No news articles yet for {language.name}.</p>
              </div>
            ) : (
              news.map(article => (
                <Link key={article.id} to={`/news/${article.id}`}>
                  <div className="p-3 sm:p-4 rounded-2xl border border-border bg-card active:bg-secondary transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-sm flex-1">{article.title}</h3>
                      {article.difficulty && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary capitalize flex-shrink-0">{article.difficulty}</span>
                      )}
                    </div>
                    {article.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{article.summary}</p>}
                  </div>
                </Link>
              ))
            )}
          </TabsContent>

          {/* MUSIC */}
          <TabsContent value="music">
            <PopularSongsSection languageSlug={slug!} languageName={language.name} />
          </TabsContent>

          {/* AI TUTOR */}
          <TabsContent value="tutor">
            <PlanGate>
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">AI Tutor for {language.name}</h3>
                <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
                  Remembers your mistakes, tracks vocab, and adapts to your level.
                </p>
                <Button asChild size="lg" className="w-full min-h-[48px]">
                  <Link to={`/learn/${slug}/tutor`}>Start Session</Link>
                </Button>
              </div>
            </PlanGate>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
