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
  ChevronRight, Lock
} from 'lucide-react'

export default function LanguagePage() {
  const { slug } = useParams<{ slug: string }>()
  const { language, loading: langLoading } = useLanguage(slug!)
  const { user } = useAuth()
  const [courses, setCourses] = useState<any[]>([])
  const [news, setNews] = useState<any[]>([])
  const [music, setMusic] = useState<any[]>([])

  useEffect(() => {
    if (!language?.id) return

    // Courses — use correct column names from schema
    supabase
      .from('courses')
      .select('*, lessons(count)')
      .eq('language_id', language.id)
      .order('sort_order')
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
  }, [language?.id])

  if (langLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!language) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <p className="text-muted-foreground">Language not found.</p>
          <Button asChild className="mt-4"><Link to="/languages">Browse Languages</Link></Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <span className="text-6xl">{language.flag}</span>
            <div>
              <h1 className="text-3xl font-bold">{language.name}</h1>
              <p className="text-muted-foreground">{language.native_name} · {language.family}</p>
            </div>
          </div>
        </motion.div>

        <Tabs defaultValue="learn">
          <TabsList className="mb-6">
            <TabsTrigger value="learn"><BookOpen className="w-4 h-4 mr-2" />Courses</TabsTrigger>
            <TabsTrigger value="news"><Newspaper className="w-4 h-4 mr-2" />News</TabsTrigger>
            <TabsTrigger value="music"><Music className="w-4 h-4 mr-2" />Music</TabsTrigger>
            <TabsTrigger value="tutor"><MessageSquare className="w-4 h-4 mr-2" />AI Tutor</TabsTrigger>
          </TabsList>

          {/* COURSES TAB */}
          <TabsContent value="learn">
            {courses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium mb-1">Courses coming soon</p>
                <p className="text-sm">Run the SQL setup scripts to populate courses, or use the AI Tutor to start practicing now.</p>
                <Button asChild className="mt-4" variant="outline">
                  <Link to={`/learn/${slug}/tutor`}>Start with AI Tutor</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {courses.map((course, i) => (
                  <motion.div key={course.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <Link to={`/learn/${slug}/course/${course.id}`}>
                      <div className="flex items-center justify-between p-5 rounded-xl border border-white/10 hover:border-cyan-400/40 bg-white/5 hover:bg-white/[0.08] transition-all group cursor-pointer">
                        <div>
                          <h3 className="font-semibold text-lg group-hover:text-cyan-400 transition-colors">{course.title}</h3>
                          {course.description && <p className="text-sm text-muted-foreground mt-0.5">{course.description}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            {course.lessons?.[0]?.count ?? 0} lessons
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* NEWS TAB */}
          <TabsContent value="news">
            {news.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Newspaper className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No news articles yet for {language.name}.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {news.map(article => (
                  <Link key={article.id} to={`/news/${article.id}`}>
                    <div className="p-4 rounded-xl border border-white/10 hover:border-cyan-400/40 bg-white/5 hover:bg-white/[0.08] transition-all cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium mb-1">{article.title}</h3>
                          {article.summary && <p className="text-sm text-muted-foreground line-clamp-2">{article.summary}</p>}
                        </div>
                        {article.difficulty && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 whitespace-nowrap capitalize">{article.difficulty}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* MUSIC TAB */}
          <TabsContent value="music">
            {music.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Music className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No music tracks yet for {language.name}.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {music.map(track => (
                  <div key={track.id} className="p-4 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{track.title}</p>
                      <p className="text-sm text-muted-foreground">{track.artist}</p>
                    </div>
                    {track.difficulty && <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 capitalize">{track.difficulty}</span>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* AI TUTOR TAB */}
          <TabsContent value="tutor">
            <PlanGate>
              <div className="text-center py-8">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-cyan-400" />
                <h3 className="text-2xl font-bold mb-2">Your Personal {language.name} Tutor</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Chat with an AI tutor that remembers your mistakes, tracks your vocabulary, and adapts to your level.
                </p>
                <Button asChild size="lg">
                  <Link to={`/learn/${slug}/tutor`}>Start Tutoring Session</Link>
                </Button>
              </div>
            </PlanGate>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}