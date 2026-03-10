import { useLanguages } from '@/hooks/useLanguage'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, ChevronRight, Search } from 'lucide-react'
import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Input } from '@/components/ui/input'

export default function LanguagesPage() {
  const { languages, loading } = useLanguages()
  const [search, setSearch] = useState('')

  const filtered = languages.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase())
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
                <div
                  key={i}
                  className="rounded-2xl border border-white/10 p-6 animate-pulse h-40 bg-white/5"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((lang, i) => (
                <motion.div
                  key={lang.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <Link to={`/learn/${lang.slug}`}>
                    <div className="rounded-2xl border border-white/10 hover:border-cyan-400/40 bg-white/5 hover:bg-white/[0.08] p-6 h-full flex flex-col transition-all cursor-pointer group">
                      <div className="flex items-start justify-between mb-4">
                        <span className="text-5xl">{lang.flag}</span>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-cyan-400 transition-colors mt-1" />
                      </div>
                      <h2 className="text-xl font-bold mb-1 group-hover:text-cyan-400 transition-colors">
                        {lang.name}
                      </h2>
                      <p className="text-sm text-muted-foreground flex-1 mb-4 line-clamp-2">
                        {lang.description}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" />
                        <span>{lang.learner_count.toLocaleString()} learners</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
              {filtered.length === 0 && !loading && (
                <div className="col-span-3 text-center py-16 text-muted-foreground">
                  No languages found matching "{search}".
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
