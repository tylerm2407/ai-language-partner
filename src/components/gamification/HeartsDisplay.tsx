import { Heart } from 'lucide-react'

interface HeartsDisplayProps {
  current: number
  max: number
  nextRegenMinutes: number | null
  compact?: boolean
}

export default function HeartsDisplay({ current, max, nextRegenMinutes, compact }: HeartsDisplayProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <Heart className={`w-4 h-4 ${current > 0 ? 'text-red-400 fill-red-400' : 'text-gray-500'}`} />
        <span className="text-sm font-bold text-red-400">{current}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <Heart
            key={i}
            className={`w-3.5 h-3.5 ${
              i < current ? 'text-red-400 fill-red-400' : 'text-gray-600'
            }`}
          />
        ))}
      </div>
      {nextRegenMinutes !== null && (
        <span className="text-[10px] text-muted-foreground">
          {Math.floor(nextRegenMinutes / 60)}h {nextRegenMinutes % 60}m
        </span>
      )}
    </div>
  )
}
