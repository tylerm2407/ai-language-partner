import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { motion } from 'framer-motion'
import { Music, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function MusicAdminPage() {
  const { user } = useAuth()
  const [tracks, setTracks] = useState<any[]>([])
  const [languages, setLanguages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    language_id: '',
    title: '',
    artist: '',
    external_url: '',
    difficulty: 'B1',
    snippet: '',
  })

  const fetchTracks = () => {
    supabase
      .from('music_tracks')
      .select('*, languages(name, flag)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setTracks(data); setLoading(false) })
  }

  useEffect(() => {
    fetchTracks()
    supabase.from('languages').select('id, name, flag').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setLanguages(data) })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.language_id || !form.title || !form.artist) return
    await supabase.from('music_tracks').insert([form])
    setForm({ language_id: '', title: '', artist: '', external_url: '', difficulty: 'B1', snippet: '' })
    fetchTracks()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('music_tracks').delete().eq('id', id)
    fetchTracks()
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <Music className="w-6 h-6 text-pink-400" />
            <h1 className="text-2xl font-bold">Music Admin</h1>
          </div>
          <p className="text-muted-foreground text-sm">Manage music tracks for all languages.</p>
        </motion.div>

        {/* Add Track Form */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Track
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={form.language_id}
              onChange={e => setForm(f => ({ ...f, language_id: e.target.value }))}
              className="rounded-lg border border-white/10 bg-background px-3 py-2 text-sm col-span-2"
              required
            >
              <option value="">Select language...</option>
              {languages.map(l => (
                <option key={l.id} value={l.id}>{l.flag} {l.name}</option>
              ))}
            </select>
            <Input placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            <Input placeholder="Artist" value={form.artist} onChange={e => setForm(f => ({ ...f, artist: e.target.value }))} required />
            <Input placeholder="External URL (YouTube, Spotify...)" value={form.external_url} onChange={e => setForm(f => ({ ...f, external_url: e.target.value }))} />
            <select
              value={form.difficulty}
              onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
              className="rounded-lg border border-white/10 bg-background px-3 py-2 text-sm"
            >
              {['A1','A2','B1','B2','C1','C2'].map(d => <option key={d}>{d}</option>)}
            </select>
            <Input
              placeholder="Lyric snippet (optional)"
              value={form.snippet}
              onChange={e => setForm(f => ({ ...f, snippet: e.target.value }))}
              className="col-span-2"
            />
            <div className="col-span-2 flex justify-end">
              <Button type="submit" className="bg-gradient-to-r from-cyan-500 to-pink-500 text-white">
                <Plus className="w-4 h-4 mr-2" /> Add Track
              </Button>
            </div>
          </form>
        </div>

        {/* Track List */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">All Tracks ({tracks.length})</h2>
          {loading ? (
            <div className="animate-pulse text-muted-foreground text-sm">Loading tracks...</div>
          ) : tracks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tracks yet.</p>
          ) : (
            tracks.map(track => (
              <div key={track.id} className="rounded-xl border border-white/10 p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {track.languages?.flag} 🎵 {track.title}
                  </div>
                  <div className="text-xs text-muted-foreground">{track.artist} · {track.difficulty}</div>
                  {track.external_url && (
                    <a href={track.external_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-cyan-400 underline truncate block max-w-xs">
                      {track.external_url}
                    </a>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(track.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-400/10 flex-shrink-0"
                >
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
