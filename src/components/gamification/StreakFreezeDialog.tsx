import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface StreakFreezeDialogProps {
  isOpen: boolean
  onClose: () => void
  gems: number
  currentFreezes: number
  onPurchase: () => Promise<void>
}

export default function StreakFreezeDialog({ isOpen, onClose, gems, currentFreezes, onPurchase }: StreakFreezeDialogProps) {
  const [loading, setLoading] = useState(false)
  const cost = 200
  const canAfford = gems >= cost
  const maxReached = currentFreezes >= 2

  if (!isOpen) return null

  const handlePurchase = async () => {
    setLoading(true)
    try {
      await onPurchase()
      onClose()
    } catch {
      // Error handled by caller
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-4">
          <span className="text-5xl">🧊</span>
          <h3 className="text-lg font-bold mt-2">Streak Freeze</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Protects your streak if you miss a day of practice. You can hold up to 2 freezes.
          </p>
        </div>

        <div className="flex items-center justify-between bg-secondary/50 rounded-xl p-3 mb-4">
          <span className="text-sm text-muted-foreground">Your gems</span>
          <span className="font-bold text-amber-400">💎 {gems}</span>
        </div>

        <div className="flex items-center justify-between bg-secondary/50 rounded-xl p-3 mb-4">
          <span className="text-sm text-muted-foreground">Freezes owned</span>
          <span className="font-bold">{currentFreezes}/2</span>
        </div>

        {maxReached ? (
          <p className="text-sm text-center text-muted-foreground mb-4">
            You already have the maximum number of streak freezes.
          </p>
        ) : !canAfford ? (
          <p className="text-sm text-center text-red-400 mb-4">
            You need {cost - gems} more gems to purchase this.
          </p>
        ) : null}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={!canAfford || maxReached || loading}
            className="flex-1 bg-gradient-to-r from-primary to-accent text-primary-foreground border-0"
          >
            {loading ? 'Purchasing...' : `Buy for 💎 ${cost}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
