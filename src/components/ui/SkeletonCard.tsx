import { cn } from '@/lib/utils'

interface SkeletonCardProps {
  className?: string
  lines?: number
  showAvatar?: boolean
}

export default function SkeletonCard({ className, lines = 2, showAvatar }: SkeletonCardProps) {
  return (
    <div className={cn('bg-card border border-border rounded-2xl p-4 animate-pulse', className)}>
      <div className="flex items-start gap-3">
        {showAvatar && (
          <div className="w-10 h-10 rounded-full bg-secondary flex-shrink-0" />
        )}
        <div className="flex-1 space-y-2.5">
          <div className="h-4 bg-secondary rounded-lg w-3/4" />
          {Array.from({ length: lines - 1 }).map((_, i) => (
            <div
              key={i}
              className="h-3 bg-secondary rounded-lg"
              style={{ width: `${60 + Math.random() * 30}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SkeletonStat() {
  return (
    <div className="bg-card border border-border rounded-2xl p-3 text-center animate-pulse">
      <div className="w-5 h-5 bg-secondary rounded-full mx-auto mb-2" />
      <div className="h-5 bg-secondary rounded-lg w-12 mx-auto mb-1" />
      <div className="h-3 bg-secondary rounded-lg w-16 mx-auto" />
    </div>
  )
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-14 bg-card border border-border rounded-xl animate-pulse" />
      ))}
    </div>
  )
}
