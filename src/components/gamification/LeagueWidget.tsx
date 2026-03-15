import { motion } from 'framer-motion'
import { getLeagueInfo, getNextLeague, type League } from '@/lib/gamification'

interface LeagueWidgetProps {
  league: League
  leagueXp: number
}

export default function LeagueWidget({ league, leagueXp }: LeagueWidgetProps) {
  const info = getLeagueInfo(league)
  const next = getNextLeague(league)
  const nextInfo = next ? getLeagueInfo(next) : null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card border border-border rounded-2xl p-4"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${info.color}20`, border: `1px solid ${info.color}40` }}
        >
          {info.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold" style={{ color: info.color }}>{info.name} League</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {leagueXp.toLocaleString()} XP this week
            {nextInfo && ` • Top 20% promoted to ${nextInfo.name}`}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
