import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Settings as SettingsIcon, Save, Globe, Target } from 'lucide-react'
import { SUPPORTED_LANGUAGES } from '@/lib/claude'

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [username, setUsername] = useState(profile?.username || '')
  const [nativeLang, setNativeLang] = useState(profile?.native_language || 'English')
  const [dailyGoal, setDailyGoal] = useState(String(profile?.daily_goal_xp || 50))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim() || null,
      username: username.trim() || null,
      native_language: nativeLang,
      daily_goal_xp: Math.max(10, Math.min(500, parseInt(dailyGoal) || 50)),
    }).eq('id', user.id)

    if (error) {
      toast.error(error.message.includes('unique') ? 'Username is already taken' : 'Failed to save')
    } else {
      toast.success('Settings saved')
      await refreshProfile()
    }
    setSaving(false)
  }

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto p-6 space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-primary" /> Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account preferences.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border bg-card p-6 space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Your name" className="bg-secondary border-border" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="username" className="bg-secondary border-border" />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Native Language</Label>
            <Select value={nativeLang} onValueChange={setNativeLang}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['English', ...SUPPORTED_LANGUAGES].map(lang => (
                  <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Daily XP Goal</Label>
            <Input type="number" min={10} max={500} step={10} value={dailyGoal}
              onChange={e => setDailyGoal(e.target.value)}
              className="bg-secondary border-border w-32" />
            <p className="text-xs text-muted-foreground">Between 10 and 500 XP</p>
          </div>

          <Button onClick={handleSave} disabled={saving}
            className="bg-gradient-to-r from-primary to-accent text-primary-foreground gap-2">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-card p-6 space-y-3"
        >
          <h2 className="font-semibold text-sm">Account</h2>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </motion.div>
      </div>
    </DashboardLayout>
  )
}
