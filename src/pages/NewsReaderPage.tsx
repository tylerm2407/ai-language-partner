import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { motion } from 'framer-motion'
import { ChevronLeft, ExternalLink, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NewsReaderPage() {
  const { articleId } = useParams<{ articleId: string }>()
  const [article, setArticle] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!articleId) return
    supabase
      .from('news_articles')
      .select('*, languages(name, flag, slug)')
      .eq('id', articleId)
      .single()
      .then(({ data }) => { if (data) setArticle(data); setLoading(false) })
  }, [articleId])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 animate-pulse text-muted-foreground">Loading article...</div>
      </DashboardLayout>
    )
  }

  if (!article) {
    return (
      <DashboardLayout>
        <div className="p-8 text-muted-foreground">Article not found.</div>
      </DashboardLayout>
    )
  }

  const lang = article.languages

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {lang && (
          <Link
            to={`/learn/${lang.slug}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back to {lang.name}
          </Link>
        )}

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {lang && <span>{lang.flag} {lang.name}</span>}
            <span>·</span>
            <span className="bg-cyan-400/10 text-cyan-400 px-2 py-0.5 rounded-full">
              {article.difficulty}
            </span>
            <span>·</span>
            <span>{article.source_name}</span>
          </div>

          <h1 className="text-2xl font-bold leading-snug">{article.title}</h1>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{new Date(article.published_at).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric'
            })}</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 mb-3">Summary</h2>
            <p className="text-sm leading-relaxed">{article.summary}</p>
          </div>

          {article.url && (
            <div className="flex justify-start">
              <a href={article.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2">
                  <ExternalLink className="w-4 h-4" /> Read Full Article
                </Button>
              </a>
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  )
}
