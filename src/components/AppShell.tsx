import { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import BottomNav from './BottomNav'
import { Crown, Settings, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const isPro = profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'family'

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col overflow-x-hidden">
      {/* Top header */}
      {(title || showBack) && (
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
            <h1 className="flex-1 font-bold text-lg truncate">
              {title || (
                <span className="bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
                  Fluenci
                </span>
              )}
            </h1>
            {headerRight || (
              !showBack && (
                <div className="flex items-center gap-2">
                  {isPro && <Crown className="w-4 h-4 text-yellow-400" />}
                  <Link to="/settings" className="p-2 rounded-xl hover:bg-secondary/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Settings className="w-5 h-5 text-muted-foreground" />
                  </Link>
                </div>
              )
            )}
          </div>
        </header>
      )}

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
