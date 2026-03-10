import { useParams, Link } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import PlanGate from '@/components/PlanGate'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import {
  BookOpen, Newspaper, Music, MessageSquare,
  ChevronRight, Clock, BarChart, ExternalLink
} from 'lucide-react'

export default function LanguagePage() {
  const { slug } = useParams<{ slug: string }>()
  const { language, loading: langLoading } = useLanguage(slug!)
  const { user } = useAuth()
  const [courses, setCourses] = useState<any[]>([])
  const [news, setNews] = useState<any[]>([])
  const [music, setMusic] = useState<any[]>([])

  useEffect(() => {
    if (!language) return

    supabase
      .from('courses')
      .select('*, lessons(count)')
      .eq('language_id', language.id)
      .eq('is_published', true)
      .order('order_index')
      .then(({ data }) => { if (data) setCourses(data) })

    supabase
      .from('news_articles')
      .select('*')
      .eq('language_id', language.id)
      .order('published_at', { ascending: false })
      .limit(6)
      .then(({ data }) => { if (data) setNews(data) })

    supabase
      .from('music_tracks')
      .select('*')
      .eq('language_id', language.id)
      .limit(6)
      .then(({ data }) => { if (data) setMusic(data) })
  }, [language])

  if (langLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 animate-pulse text-muted-foreground">Loading...</div>
      </DashboardLayout>
    )
  }

  if (!language) {
    return (
      <DashboardLayout>
        <div className="p-8 text-muted-foreground">Language not found.</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <span className="text-6xl">{language.flag}</span>
            <div>
              <h1 className="text-3xl font-bold">{language.name}</h1>
              <p className="text-muted-foreground">{language.description}</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {courses.length > 0 && (
              <Link to={`/learn/${slug}/course/${courses[0].id}`}>
                <Button className="bg-gradient-to-r from-cyan-500 to-pink-500 text-white">
                  Start Learning <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            )}
            <Link to={`/learn/${slug}/tutor`}>
              <Button variant="outline">Practice with AI Tutor</Button>
            </Link>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1 gap-1">
              <BookOpen className="w-4 h-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="news" className="flex-1 gap-1">
              <Newspaper className="w-4 h-4" /> News
            </TabsTrigger>
            <TabsTrigger value="music" className="flex-1 gap-1">
              <Music className="w-4 h-4" /> Music
            </TabsTrigger>
            <TabsTrigger value="tutor" className="flex-1 gap-1">
              <MessageSquare className="w-4 h-4" /> AI Tutor
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <h2 className="text-lg font-semibold">Courses</h2>
            {courses.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Courses coming soon for {language.name}.
              </p>
            ) : (
              courses.map(course => (
                <Link key={course.id} to={`/learn/${slug}/course/${course.id}`}>
                  <div className="rounded-xl border border-white/10 hover:border-cyan-400/40 p-5 flex items-center justify-between transition-all hover:bg-white/5">
                    <div>
                      <div className="font-semibold">{course.title}</div>
                      <div className="text-sm text-muted-foreground">{course.description}</div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BarChart className="w-3 h-3" /> {course.level_min}–{course.level_max}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />{' '}
                          {course.lessons?.[0]?.count || 0} lessons
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </Link>
              ))
            )}
          </TabsContent>

          {/* News Tab */}
          <TabsContent value="news" className="space-y-3 mt-4">
            <h2 className="text-lg font-semibold">Latest {language.name} News</h2>
            {news.length === 0 ? (
              <p className="text-muted-foreground text-sm">News articles coming soon.</p>
            ) : (
              news.map(article => (
                <div key={article.id} className="rounded-xl border border-white/10 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{article.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{article.summary}</div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span className="bg-cyan-400/10 text-cyan-400 px-2 py-0.5 rounded-full">
                          {article.difficulty}
                        </span>
                        <span>{article.source_name}</span>
                      </div>
                    </div>
                    {article.url && (
                      <a href={article.url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Music Tab */}
          <TabsContent value="music" className="space-y-3 mt-4">
            <h2 className="text-lg font-semibold">{language.name} Music for Learners</h2>
            {music.length === 0 ? (
              <p className="text-muted-foreground text-sm">Music tracks coming soon.</p>
            ) : (
              music.map(track => (
                <div
                  key={track.id}
                  className="rounded-xl border border-white/10 p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-sm">🎵 {track.title}</div>
                    <div className="text-xs text-muted-foreground">{track.artist}</div>
                    <span className="text-xs bg-pink-400/10 text-pink-400 px-2 py-0.5 rounded-full mt-1 inline-block">
                      {track.difficulty}
                    </span>
                  </div>
                  {track.external_url && (
                    <a href={track.external_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1">
                        Listen <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          {/* AI Tutor Tab */}
          <TabsContent value="tutor" className="mt-4">
            <PlanGate feature="the personalized AI tutor">
              <div className="text-center py-8">
                <Link to={`/learn/${slug}/tutor`}>
                  <Button
                    className="bg-gradient-to-r from-cyan-500 to-pink-500 text-white"
                    size="lg"
                  >
                    Open AI Tutor Session <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </PlanGate>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
