import { useLanguages } from '@/hooks/useLanguage'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, Search, Globe } from 'lucide-react'
import { useState } from 'react'
import AppShell from '@/components/AppShell'
import { Input } from '@/components/ui/input'

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
    <AppShell title="Languages">
      <div className="py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search languages..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 w-full"
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border p-4 animate-pulse h-20 bg-secondary/30" />
            ))}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {filtered.length} language{filtered.length !== 1 ? 's' : ''} available
            </p>
            <div className="space-y-2">
              {filtered.map((lang, i) => (
                <motion.div
                  key={lang.id || lang.slug}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                >
                  <Link to={`/learn/${lang.slug}`}>
                    <div className="rounded-2xl border border-border bg-card hover:bg-secondary/50 active:bg-secondary p-4 flex items-center gap-3 transition-colors">
                      <span className="text-3xl flex-shrink-0">{lang.flag}</span>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-sm">{lang.name}</h2>
                        <p className="text-xs text-muted-foreground">{lang.native_name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {lang.difficulty && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[lang.difficulty] || ''}`}>
                              {DIFFICULTY_LABELS[lang.difficulty]}
                            </span>
                          )}
                          {lang.speakers_millions != null && lang.speakers_millions > 0 && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {lang.speakers_millions >= 1000
                                ? `${(lang.speakers_millions / 1000).toFixed(1)}B`
                                : `${lang.speakers_millions}M`}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Link>
                </motion.div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No languages found matching "{search}".
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
