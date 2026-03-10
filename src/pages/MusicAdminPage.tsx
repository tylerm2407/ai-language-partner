import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useLanguages } from '@/hooks/useLanguage'
import DashboardLayout from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Trash2, Plus, Music, ShieldAlert } from 'lucide-react'

const DIFFICULTIES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export default function MusicAdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { languages } = useLanguages()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tracks, setTracks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    language_id: '', title: '', artist: '', external_url: '',
    difficulty: 'B1', snippet: '', genre: '',
  })

  // Server-side admin check via Supabase RPC — trusts the database, not the client
  useEffect(() => {
    if (!user) return
    supabase.rpc('is_admin', { uid: user.id }).then(({ data, error }) => {
      setIsAdmin(!error && !!data)
    })
  }, [user])

  useEffect(() => {
    if (isAdmin === true) fetchTracks()
    if (isAdmin === false) setLoading(false)
  }, [isAdmin])

  const fetchTracks = async () => {
    const { data } = await supabase
      .from('music_tracks')
      .select('*, languages(name, flag)')
      .order('created_at', { ascending: false })
    if (data) setTracks(data)
    setLoading(false)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.language_id || !form.title || !form.artist) {
      toast.error('Language, title, and artist are required')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('music_tracks').insert({
      language_id: form.language_id,
      title: form.title,
      artist: form.artist,
      external_url: form.external_url,
      difficulty: form.difficulty,
      snippet: form.snippet || null,
      metadata: form.genre ? { genre: form.genre } : {},
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Track added!')
      setForm({ language_id: '', title: '', artist: '', external_url: '', difficulty: 'B1', snippet: '', genre: '' })
      fetchTracks()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this track?')) return
    const { error } = await supabase.from('music_tracks').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); fetchTracks() }
  }

  if (isAdmin === null) {
    return (
      <DashboardLayout>
        <div className="p-8 text-muted-foreground animate-pulse">Checking permissions...</div>
      </DashboardLayout>
    )
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto p-8 text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground text-sm">You do not have permission to access this page.</p>
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        <div className="flex items-center gap-3">
          <Music className="w-6 h-6 text-yellow-400" />
          <h1 className="text-2xl font-bold">Music Admin</h1>
        </div>

        {/* Add form */}
        <form onSubmit={handleAdd} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Track
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Language *</Label>
              <Select value={form.language_id} onValueChange={v => setForm(p => ({ ...p, language_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select language" /></SelectTrigger>
                <SelectContent>
                  {languages.map(l => <SelectItem key={l.id} value={l.id}>{l.flag} {l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={form.difficulty} onValueChange={v => setForm(p => ({ ...p, difficulty: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Song title" className="mt-1" />
            </div>
            <div>
              <Label>Artist *</Label>
              <Input value={form.artist} onChange={e => setForm(p => ({ ...p, artist: e.target.value }))} placeholder="Artist name" className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label>External URL (YouTube / Spotify)</Label>
              <Input value={form.external_url} onChange={e => setForm(p => ({ ...p, external_url: e.target.value }))} placeholder="https://..." className="mt-1" />
            </div>
            <div>
              <Label>Genre</Label>
              <Input value={form.genre} onChange={e => setForm(p => ({ ...p, genre: e.target.value }))} placeholder="Pop, Folk, etc." className="mt-1" />
            </div>
            <div>
              <Label>Short Snippet (fair use only)</Label>
              <Input value={form.snippet} onChange={e => setForm(p => ({ ...p, snippet: e.target.value }))} placeholder="First line or title..." className="mt-1" />
            </div>
          </div>
          <Button type="submit" disabled={saving} className="bg-gradient-to-r from-cyan-500 to-pink-500 text-white">
            {saving ? 'Saving...' : 'Add Track'}
          </Button>
        </form>

        {/* Tracks list */}
        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{tracks.length} Tracks</h2>
          {loading ? (
            <div className="animate-pulse h-20 bg-white/5 rounded-xl" />
          ) : tracks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tracks yet.</p>
          ) : (
            tracks.map(track => (
              <div key={track.id} className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5">
                <div>
                  <div className="font-medium text-sm">{track.languages?.flag} {track.title}</div>
                  <div className="text-xs text-muted-foreground">{track.artist} · {track.difficulty} · {track.languages?.name}</div>
                  {track.external_url && (
                    <a href={track.external_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-cyan-400 truncate max-w-xs mt-0.5 block">
                      {track.external_url}
                    </a>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(track.id)} className="text-red-400 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
