import { useLanguages } from '@/hooks/useLanguage'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, Search, Globe } from 'lucide-react'
import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-500/20 text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  hard: 'bg-orange-500/20 text-orange-400',
  very_hard: 'bg-red-500/20 text-red-400',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  very_hard: 'Very Hard',
}

export default function LanguagesPage() {
  const { languages, loading } = useLanguages()
  const [search, setSearch] = useState('')

  const filtered = languages.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.native_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              Choose Your{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
                Language
              </span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              50 languages. One AI tutor that adapts to you. Start any language free.
            </p>
          </motion.div>

          <div className="max-w-md mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search languages..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array(9).fill(0).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/10 p-6 animate-pulse h-40 bg-white/5" />
              ))}
            </div>
          ) : (
            <>
              <p className="text-center text-sm text-muted-foreground mb-6">
                {filtered.length} language{filtered.length !== 1 ? 's' : ''} available
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((lang, i) => (
                  <motion.div
                    key={lang.id || lang.slug}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <Link to={`/learn/${lang.slug}`}>
                      <div className="rounded-2xl border border-white/10 hover:border-cyan-400/40 bg-white/5 hover:bg-white/[0.08] p-6 h-full flex flex-col transition-all cursor-pointer group">
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-5xl">{lang.flag}</span>
                          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-cyan-400 transition-colors mt-1" />
                        </div>
                        <h2 className="text-xl font-bold mb-0.5 group-hover:text-cyan-400 transition-colors">
                          {lang.name}
                        </h2>
                        <p className="text-sm text-muted-foreground mb-3">{lang.native_name}</p>
                        <div className="flex items-center gap-2 flex-wrap mt-auto">
                          {lang.difficulty && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[lang.difficulty] || ''}`}>
                              {DIFFICULTY_LABELS[lang.difficulty]}
                            </span>
                          )}
                          {lang.speakers_millions != null && lang.speakers_millions > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {lang.speakers_millions >= 1000
                                ? `${(lang.speakers_millions / 1000).toFixed(1)}B speakers`
                                : `${lang.speakers_millions}M speakers`}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
                {filtered.length === 0 && (
                  <div className="col-span-3 text-center py-16 text-muted-foreground">
                    No languages found matching "{search}".
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}