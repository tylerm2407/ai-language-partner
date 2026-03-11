import { Link, useLocation } from 'react-router-dom'
import { Home, BookOpen, Brain, Trophy, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

const TABS = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/learn', icon: BookOpen, label: 'Learn' },
  { to: '/practice', icon: Brain, label: 'Practice' },
  { to: '/leaderboard', icon: Trophy, label: 'Ranks' },
  { to: '/profile', icon: User, label: 'Profile' },
]

export default function BottomNav() {
  const location = useLocation()
  const { profile } = useAuth()

  // Don't render if not authenticated
  if (!profile) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-white/10 safe-area-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-1">
        {TABS.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to))
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-[56px] transition-all duration-200',
                active
                  ? 'text-cyan-400'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn(
                'p-1.5 rounded-xl transition-all duration-200',
                active ? 'bg-cyan-400/15' : ''
              )}>
                <Icon className={cn('w-5 h-5', active ? 'stroke-[2.5]' : 'stroke-2')} />
              </div>
              <span className={cn('text-[10px] font-medium leading-none', active ? 'text-cyan-400' : '')}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
