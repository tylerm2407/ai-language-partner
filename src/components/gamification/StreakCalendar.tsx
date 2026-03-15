import { motion } from 'framer-motion'

interface StreakCalendarProps {
  calendar: Array<{ practice_date: string; xp_earned: number }>
}

export default function StreakCalendar({ calendar }: StreakCalendarProps) {
  const today = new Date()
  const days: Array<{ date: string; xp: number; dayLabel: string }> = []

  // Build last 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const entry = calendar.find(c => c.practice_date === dateStr)
    days.push({
      date: dateStr,
      xp: entry?.xp_earned || 0,
      dayLabel: d.toLocaleDateString('en', { weekday: 'narrow' }),
    })
  }

  const maxXP = Math.max(...days.map(d => d.xp), 1)

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Practice Calendar</h3>
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="grid grid-cols-10 gap-1">
          {days.map((day, i) => {
            const intensity = day.xp > 0 ? Math.max(0.2, day.xp / maxXP) : 0
            const isToday = day.date === today.toISOString().split('T')[0]

            return (
              <motion.div
                key={day.date}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.01 }}
                className={`aspect-square rounded-sm ${isToday ? 'ring-1 ring-primary' : ''}`}
                style={{
                  backgroundColor: day.xp > 0
                    ? `rgba(34, 197, 94, ${intensity})`
                    : 'rgba(255, 255, 255, 0.05)',
                }}
                title={`${day.date}: ${day.xp} XP`}
              />
            )
          })}
        </div>
        <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground">
          <span>30 days ago</span>
          <div className="flex items-center gap-1">
            <span>Less</span>
            {[0, 0.2, 0.4, 0.7, 1].map((intensity, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-sm"
                style={{
                  backgroundColor: intensity > 0
                    ? `rgba(34, 197, 94, ${intensity})`
                    : 'rgba(255, 255, 255, 0.05)',
                }}
              />
            ))}
            <span>More</span>
          </div>
          <span>Today</span>
        </div>
      </div>
    </div>
  )
}
