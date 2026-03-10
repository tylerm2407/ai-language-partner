import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUPPORTED_LANGUAGES, LANGUAGE_FLAGS } from '@/lib/claude'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronLeft, Globe, Target, User } from 'lucide-react'

const STEPS = ['Welcome', 'Language', 'Goal'] as const
const GOALS = [
  { value: 30, label: 'Casual', desc: '30 XP/day · ~5 min' },
  { value: 50, label: 'Regular', desc: '50 XP/day · ~10 min' },
  { value: 100, label: 'Serious', desc: '100 XP/day · ~20 min' },
  { value: 200, label: 'Intense', desc: '200 XP/day · ~30 min' },
]

export default function Onboarding() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [fullName, setFullName] = useState('')
  const [targetLang, setTargetLang] = useState('Spanish')
  const [dailyGoal, setDailyGoal] = useState(50)
  const [saving, setSaving] = useState(false)

  const TOP_LANGS = ['Spanish', 'French', 'German', 'Japanese', 'Korean', 'Mandarin Chinese', 'Portuguese', 'Italian']

  const handleFinish = async () => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim() || null,
      target_language: targetLang,
      daily_goal_xp: dailyGoal,
    }).eq('id', user.id)

    if (error) { toast.error('Failed to save'); setSaving(false); return }
    await refreshProfile()
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div key={i} className={cn('h-1 flex-1 rounded-full transition-all', i <= step ? 'bg-primary' : 'bg-secondary')} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="welcome" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h1 className="text-2xl font-bold">Welcome to Fluenci!</h1>
                <p className="text-muted-foreground text-sm mt-2">Let's set up your profile in a few quick steps.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> What's your name?</Label>
                <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Your name" className="bg-secondary border-border" autoFocus />
              </div>
              <Button onClick={() => setStep(1)} className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground gap-2">
                Continue <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="language" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2"><Globe className="w-6 h-6 text-primary" /> Pick your language</h1>
                <p className="text-muted-foreground text-sm mt-2">What language do you want to learn?</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {TOP_LANGS.map(lang => (
                  <button key={lang} onClick={() => setTargetLang(lang)}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all text-sm',
                      targetLang === lang
                        ? 'border-primary/40 bg-primary/10 text-foreground'
                        : 'border-border bg-card hover:border-primary/20 text-muted-foreground'
                    )}
                  >
                    <span className="text-lg mr-2">{LANGUAGE_FLAGS[lang] || '🌐'}</span>
                    {lang}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(0)} className="border-border">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button onClick={() => setStep(2)} className="flex-1 bg-gradient-to-r from-primary to-accent text-primary-foreground gap-2">
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="goal" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="w-6 h-6 text-primary" /> Set your daily goal</h1>
                <p className="text-muted-foreground text-sm mt-2">How much time can you commit each day?</p>
              </div>
              <div className="space-y-3">
                {GOALS.map(g => (
                  <button key={g.value} onClick={() => setDailyGoal(g.value)}
                    className={cn(
                      'w-full p-4 rounded-xl border text-left transition-all',
                      dailyGoal === g.value
                        ? 'border-primary/40 bg-primary/10'
                        : 'border-border bg-card hover:border-primary/20'
                    )}
                  >
                    <div className="font-medium text-sm">{g.label}</div>
                    <div className="text-xs text-muted-foreground">{g.desc}</div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="border-border">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button onClick={handleFinish} disabled={saving}
                  className="flex-1 bg-gradient-to-r from-primary to-accent text-primary-foreground gap-2">
                  {saving ? 'Setting up...' : 'Start Learning'} <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
