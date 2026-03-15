import { motion } from 'framer-motion'
import { Progress } from '@/components/ui/progress'
import { getQuestConfig } from '@/lib/gamification'

interface Quest {
  id: string
  quest_type: string
  target_value: number
  current_value: number
  gem_reward: number
  completed: boolean
}

interface DailyQuestsProps {
  quests: Quest[]
  loading?: boolean
}

export default function DailyQuests({ quests, loading }: DailyQuestsProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Daily Quests</h3>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-card border border-border rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (quests.length === 0) return null

  const completedCount = quests.filter(q => q.completed).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Daily Quests</h3>
        <span className="text-xs text-muted-foreground">{completedCount}/{quests.length} done</span>
      </div>

      {quests.map((quest, i) => {
        const config = getQuestConfig(quest.quest_type)
        const pct = Math.min((quest.current_value / quest.target_value) * 100, 100)

        return (
          <motion.div
            key={quest.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
              quest.completed
                ? 'bg-green-500/10 border-green-500/20'
                : 'bg-card border-border'
            }`}
          >
            <span className="text-2xl flex-shrink-0">{config.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className={`text-sm font-medium ${quest.completed ? 'line-through text-muted-foreground' : ''}`}>
                  {config.label}
                </p>
                <span className="text-xs text-amber-400 font-medium flex-shrink-0 ml-2">
                  +{quest.gem_reward} 💎
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={pct} className="h-1.5 flex-1" />
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {quest.current_value}/{quest.target_value}
                </span>
              </div>
            </div>
            {quest.completed && (
              <span className="text-green-400 text-lg flex-shrink-0">✓</span>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
