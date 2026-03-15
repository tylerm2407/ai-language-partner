import { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import BottomNav from './BottomNav'
import { Crown, Settings, ChevronLeft, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getHeartsInfo } from '@/lib/gamification'

interface Props {
  children: ReactNode
  title?: string
  showBack?: boolean
  backTo?: string
  headerRight?: ReactNode
  noPadding?: boolean
  noBottomNav?: boolean
}

export default function AppShell({
  children,
  title,
  showBack,
  backTo,
  headerRight,
  noPadding,
  noBottomNav,
}: Props) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isPro = profile?.subscription_tier !== 'free' && !!profile?.subscription_tier

  // Gamification header data
  const gems = profile?.gems ?? 0
  const heartsInfo = profile ? getHeartsInfo(
    profile.hearts ?? 5,
    (profile as any).max_hearts ?? 5,
    (profile as any).hearts_last_regen_at ?? new Date().toISOString()
  ) : { current: 5, max: 5 }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col overflow-x-hidden">
      {/* Top header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border safe-area-top">
        <div className="flex items-center h-14 px-4 max-w-lg mx-auto gap-3">
          {showBack && (
            <button
              onClick={() => backTo ? navigate(backTo) : navigate(-1)}
              className="p-2 -ml-2 rounded-xl hover:bg-secondary/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="flex-1 font-bold text-lg truncate font-heading">
            {title || (
              <span className="bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
                Fluenci
              </span>
            )}
          </h1>
          {headerRight || (
            !showBack && profile && (
              <div className="flex items-center gap-2.5">
                {/* Gems */}
                <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">
                  <span className="text-xs">💎</span>
                  <span className="text-xs font-bold text-amber-400">{gems}</span>
                </div>

                {/* Hearts */}
                <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-1">
                  <Heart className="w-3 h-3 text-red-400 fill-red-400" />
                  <span className="text-xs font-bold text-red-400">{heartsInfo.current}</span>
                </div>

                {isPro && <Crown className="w-4 h-4 text-yellow-400" />}
                <Link to="/settings" className="p-2 rounded-xl hover:bg-secondary/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <Settings className="w-5 h-5 text-muted-foreground" />
                </Link>
              </div>
            )
          )}
        </div>
      </header>

      {/* Main content — padded for bottom nav */}
      <main className={cn(
        'flex-1 max-w-lg mx-auto w-full',
        noPadding ? '' : 'px-4',
        noBottomNav ? 'pb-4' : 'pb-[calc(5rem+env(safe-area-inset-bottom,0px))]',
      )}>
        {children}
      </main>

      {!noBottomNav && <BottomNav />}
    </div>
  )
}
