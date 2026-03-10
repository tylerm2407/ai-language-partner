import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, Music, Info } from 'lucide-react'
import { getSongsForLanguage, type SongLink } from '@/lib/popularSongs'

interface Props {
  languageSlug: string
  languageName: string
}

const DIFFICULTY_COLORS = {
  beginner:     'bg-green-500/20 text-green-400',
  intermediate: 'bg-yellow-500/20 text-yellow-400',
  advanced:     'bg-red-500/20 text-red-400',
}

function PlatformButton({
  href, label, color, icon,
}: { href: string; label: string; color: string; icon: React.ReactNode }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105 active:scale-95 ${color}`}
      onClick={e => e.stopPropagation()}
    >
      {icon}
      {label}
      <ExternalLink className="w-3 h-3 opacity-70" />
    </a>
  )
}

// SVG icons (inline — no external deps, no copyrighted assets)
const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
)

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.54 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
  </svg>
)

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
)

export default function PopularSongsSection({ languageSlug, languageName }: Props) {
  const songs = getSongsForLanguage(languageSlug)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all')

  const filtered = filter === 'all' ? songs : songs.filter(s => s.difficulty === filter)

  if (songs.length === 0) return null

  return (
    <div className="space-y-4">
      {/* Legal notice */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Songs open in third-party services. This app only links to external music and does not host, stream, or cache any audio content.
        </span>
      </div>

      {/* Difficulty filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'beginner', 'intermediate', 'advanced'] as const).map(d => (
          <button
            key={d}
            onClick={() => setFilter(d)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
              filter === d
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10 border border-white/10'
            }`}
          >
            {d === 'all' ? `All (${songs.length})` : d}
          </button>
        ))}
      </div>

      {/* Song list */}
      <div className="space-y-2">
        {filtered.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="rounded-xl border border-white/10 bg-white/5 overflow-hidden"
          >
            {/* Song row */}
            <button
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0">
                <Music className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{s.title}</p>
                <p className="text-xs text-muted-foreground truncate">{s.artist}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {s.difficulty && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[s.difficulty]}`}>
                    {s.difficulty}
                  </span>
                )}
                {s.genre && (
                  <span className="text-xs text-muted-foreground hidden sm:inline">{s.genre}</span>
                )}
              </div>
            </button>

            {/* Expanded: platform buttons */}
            <AnimatePresence>
              {expanded === s.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-3 flex flex-wrap gap-2 border-t border-white/5 pt-3">
                    <PlatformButton
                      href={s.spotifyUrl}
                      label="Open in Spotify"
                      color="bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20"
                      icon={<SpotifyIcon />}
                    />
                    <PlatformButton
                      href={s.appleMusicUrl}
                      label="Open in Apple Music"
                      color="bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 border border-pink-500/20"
                      icon={<AppleIcon />}
                    />
                    <PlatformButton
                      href={s.youtubeUrl}
                      label="Open in YouTube"
                      color="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                      icon={<YouTubeIcon />}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No songs at this difficulty level for {languageName}.
        </div>
      )}
    </div>
  )
}
