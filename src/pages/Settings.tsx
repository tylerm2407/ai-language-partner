import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Settings as SettingsIcon, Save, Globe, Target, Trash2, AlertTriangle } from 'lucide-react'
import { SUPPORTED_LANGUAGES } from '@/lib/claude'

type DeleteStep = 'idle' | 'confirm' | 'type-confirm'

const DELETE_PHRASE = 'delete my account'

export default function Settings() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [username, setUsername] = useState(profile?.username || '')
  const [nativeLang, setNativeLang] = useState(profile?.native_language || 'English')
  const [dailyGoal, setDailyGoal] = useState(String(profile?.daily_goal_xp || 50))
  const [saving, setSaving] = useState(false)

  // Account deletion state
  const [deleteStep, setDeleteStep] = useState<DeleteStep>('idle')
  const [deletePhrase, setDeletePhrase] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim().slice(0, 100) || null,
      username: username.trim().slice(0, 30) || null,
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

  const handleDeleteAccount = async () => {
    if (deletePhrase !== DELETE_PHRASE) return
    setDeleting(true)
    try {
      const { error } = await supabase.rpc('delete_user')
      if (error) throw error
      await signOut()
      navigate('/')
    } catch {
      toast.error('Failed to delete account. Please try again or contact support.')
      setDeleting(false)
      setDeleteStep('idle')
      setDeletePhrase('')
    }
  }

  return (
    <AppShell title="Settings">
      <div className="max-w-xl mx-auto p-4 space-y-6 pb-28">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-primary" /> Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account preferences.</p>
        </motion.div>

        {/* Profile settings */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border bg-card p-6 space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={e => setFullName(e.target.value.slice(0, 100))}
              placeholder="Your name"
              className="bg-secondary border-border"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30))}
              placeholder="username"
              className="bg-secondary border-border"
              maxLength={30}
            />
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
            <Input
              type="number"
              min={10}
              max={500}
              step={10}
              value={dailyGoal}
              onChange={e => setDailyGoal(e.target.value)}
              className="bg-secondary border-border w-32"
            />
            <p className="text-xs text-muted-foreground">Between 10 and 500 XP</p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-primary to-accent text-primary-foreground gap-2"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </motion.div>

        {/* Account info */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-card p-6 space-y-2"
        >
          <h2 className="font-semibold text-sm">Account</h2>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </motion.div>

        {/* Danger zone */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="rounded-2xl border border-destructive/40 bg-card p-6 space-y-4"
        >
          <h2 className="font-semibold text-sm text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Danger Zone
          </h2>

          {deleteStep === 'idle' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
              <Button
                variant="outline"
                className="border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground gap-2"
                onClick={() => setDeleteStep('confirm')}
              >
                <Trash2 className="w-4 h-4" /> Delete Account
              </Button>
            </div>
          )}

          {deleteStep === 'confirm' && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-destructive">This will permanently delete:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Your profile and all personal data</li>
                <li>All conversation history</li>
                <li>All lesson and XP progress</li>
                <li>All achievements and streaks</li>
                <li>Your subscription (no refunds for remaining period)</li>
              </ul>
              <p className="text-xs text-muted-foreground font-medium">This action is irreversible.</p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDeleteStep('idle')}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setDeleteStep('type-confirm')}
                >
                  I understand, continue
                </Button>
              </div>
            </div>
          )}

          {deleteStep === 'type-confirm' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Type <span className="font-mono font-semibold text-foreground">{DELETE_PHRASE}</span> to confirm deletion.
              </p>
              <Input
                value={deletePhrase}
                onChange={e => setDeletePhrase(e.target.value)}
                placeholder={DELETE_PHRASE}
                className="bg-secondary border-destructive/50 focus:border-destructive"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setDeleteStep('idle'); setDeletePhrase('') }}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDeleteAccount}
                  disabled={deletePhrase !== DELETE_PHRASE || deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete My Account'}
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AppShell>
  )
}
