import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getLevelInfo } from '@/lib/achievements'
import { LANGUAGE_FLAGS } from '@/lib/claude'
import { Home, MessageSquare, BookOpen, Trophy, User, Settings, Flame, Zap, Heart, Menu, LogOut, Crown } from 'lucide-react'
import { Button } from './ui/button'
import { Progress } from './ui/progress'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/conversation', icon: MessageSquare, label: 'Conversation' },
  { to: '/learn', icon: BookOpen, label: 'Learn' },
  { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { to: '/achievements', icon: Zap, label: 'Achievements' },
  { to: '/profile', icon: User, label: 'Profile' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const levelInfo = profile ? getLevelInfo(profile.total_xp) : null
  const dailyPercent = profile ? Math.min((profile.today_xp / profile.daily_goal_xp) * 100, 100) : 0
  const isPro = profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'family'

  const handleSignOut = async () => { await signOut(); navigate('/') }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">Fluenci</span>
          {isPro && <Crown className="w-4 h-4 text-yellow-400" />}
        </Link>
      </div>

      {profile && (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-pink-500 flex items-center justify-center text-sm font-bold">
              {(profile.full_name || profile.username || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{profile.full_name || profile.username || 'Learner'}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <span>{LANGUAGE_FLAGS[profile.target_language] || '🌐'}</span>
                <span>{profile.target_language}</span>
              </div>
            </div>
          </div>
          {levelInfo && (
            <div className="space-y-1 mb-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{levelInfo.level.name}</span>
                <span>{profile.total_xp.toLocaleString()} XP</span>
              </div>
              <Progress value={levelInfo.progressPercent} className="h-1.5" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-orange-400 text-sm"><Flame className="w-4 h-4" /><span className="font-bold">{profile.streak_days}</span></div>
            <div className="flex items-center gap-1 text-yellow-400 text-sm"><Zap className="w-4 h-4" /><span className="font-bold">{profile.today_xp}/{profile.daily_goal_xp}</span></div>
            {!isPro && <div className="flex items-center gap-1 text-red-400 text-sm"><Heart className="w-4 h-4" /><span className="font-bold">{profile.hearts}</span></div>}
          </div>
          <div className="mt-2">
            <Progress value={dailyPercent} className="h-1" />
            <div className="text-xs text-muted-foreground mt-1">Daily goal: {Math.round(dailyPercent)}%</div>
          </div>
        </div>
      )}

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to} onClick={() => setMobileOpen(false)}
            className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
              location.pathname === to ? 'bg-cyan-400/10 text-cyan-400 font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-white/5')}>
            <Icon className="w-4 h-4 flex-shrink-0" />{label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10 space-y-1">
        {!isPro && (
          <Link to="/pricing">
            <Button size="sm" className="w-full bg-gradient-to-r from-cyan-500 to-pink-500 hover:opacity-90 text-white">
              <Crown className="w-3 h-3 mr-1" /> Upgrade to Pro
            </Button>
          </Link>
        )}
        <Link to="/settings" onClick={() => setMobileOpen(false)}>
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 w-full transition-all">
            <Settings className="w-4 h-4" /> Settings
          </button>
        </Link>
        <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-red-400 hover:bg-red-400/5 w-full transition-all">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="hidden lg:flex flex-col w-64 border-r border-white/10 bg-background/50 backdrop-blur-xl flex-shrink-0">
        <SidebarContent />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-background border-r border-white/10 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-white/10">
          <button onClick={() => setMobileOpen(true)}><Menu className="w-6 h-6" /></button>
          <span className="font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">Fluenci</span>
          <div className="flex items-center gap-2 text-sm"><Flame className="w-4 h-4 text-orange-400" /><span className="text-orange-400 font-bold">{profile?.streak_days || 0}</span></div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
