import { useParams, Link } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import DashboardLayout from '@/components/DashboardLayout'
import PlanGate from '@/components/PlanGate'
import { motion } from 'framer-motion'
import { ChevronLeft, MessageSquare } from 'lucide-react'

export default function TutorPage() {
  const { slug } = useParams<{ slug: string }>()
  const { language, loading } = useLanguage(slug!)

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 animate-pulse text-muted-foreground">Loading...</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Link
          to={`/learn/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to {language?.name || slug}
        </Link>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">{language?.flag || '🌐'}</span>
            <div>
              <h1 className="text-2xl font-bold">{language?.name} AI Tutor</h1>
              <p className="text-muted-foreground text-sm">
                Your personal AI language partner
              </p>
            </div>
          </div>

          <PlanGate feature="the personalized AI tutor">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-cyan-400/10 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold mb-2">
                {language?.name} Tutor Session
              </h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Your AI tutor is ready. Full conversational AI with grammar
                correction, vocabulary tracking, and adaptive difficulty — coming in the next update.
              </p>
            </div>
          </PlanGate>
        </motion.div>
      </div>
    </DashboardLayout>
  )
}
