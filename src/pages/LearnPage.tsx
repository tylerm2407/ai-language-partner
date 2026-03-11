import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguages } from '@/hooks/useLanguage'
import AppShell from '@/components/AppShell'
import { Input } from '@/components/ui/input'
import { motion } from 'framer-motion'
import { Search, ChevronRight } from 'lucide-react'

const DIFFICULTY_BADGE: Record<string, { label: string; color: string }> = {
  easy:      { label: 'Easy',      color: 'text-green-400 bg-green-400/10' },
  medium:    { label: 'Medium',    color: 'text-yellow-400 bg-yellow-400/10' },
  hard:      { label: 'Hard',      color: 'text-orange-400 bg-orange-400/10' },
  very_hard: { label: 'Very Hard', color: 'text-red-400 bg-red-400/10' },
}

export default function LearnPage() {
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
            placeholder="Search 50 languages..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11"
          />
        </div>

        <p className="text-xs text-muted-foreground">{filtered.length} languages available</p>

        {/* Language list */}
        {loading ? (
          <div className="space-y-3">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((lang, i) => {
              const badge = DIFFICULTY_BADGE[lang.difficulty || '']
              return (
                <motion.div
                  key={lang.slug}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4) }}
                >
                  <Link to={`/learn/${lang.slug}`}>
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-white/10 bg-white/5 active:bg-white/10 hover:bg-white/[0.08] transition-colors">
                      <span className="text-3xl w-10 text-center flex-shrink-0">{lang.flag}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{lang.name}</p>
                        <p className="text-xs text-muted-foreground">{lang.native_name}
                          {lang.speakers_millions != null && lang.speakers_millions > 0 && (
                            <span> · {lang.speakers_millions >= 1000 ? `${(lang.speakers_millions/1000).toFixed(1)}B` : `${lang.speakers_millions}M`} speakers</span>
                          )}
                        </p>
                      </div>
                      {badge && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${badge.color}`}>
                          {badge.label}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
