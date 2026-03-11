import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ArrowRight, Globe, Loader2 } from 'lucide-react'

export default function Login() {
  const { signIn, signUp, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  const [form, setForm] = useState({ email: '', password: '', name: '' })

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) navigate('/dashboard', { replace: true })
  }, [user, authLoading, navigate])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.password) return
    setLoading(true)
    setError('')

    if (mode === 'login') {
      const { error } = await signIn(form.email, form.password)
      if (error) { setError(error.message); setLoading(false) }
      else navigate('/dashboard', { replace: true })
    } else {
      if (!form.name.trim()) { setError('Please enter your name'); setLoading(false); return }
      const { error } = await signUp(form.email, form.password, form.name)
      if (error) { setError(error.message); setLoading(false) }
      else navigate('/onboarding', { replace: true })
    }
  }

  if (authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Gradient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex flex-col justify-center px-5 py-8 relative max-w-sm mx-auto w-full">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <Globe className="w-8 h-8 text-cyan-400" />
            <span className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
              Fluenci
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            {mode === 'signup' ? 'Start learning a new language today — free forever' : 'Welcome back! Ready to practice?'}
          </p>
        </motion.div>

        {/* Tab switcher */}
        <div className="flex bg-white/5 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setMode('signup'); setError('') }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mode === 'signup' ? 'bg-white/10 text-foreground' : 'text-muted-foreground'
            }`}
          >
            Sign Up — Free
          </button>
          <button
            onClick={() => { setMode('login'); setError('') }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mode === 'login' ? 'bg-white/10 text-foreground' : 'text-muted-foreground'
            }`}
          >
            Log In
          </button>
        </div>

        {/* Form */}
        <motion.form
          key={mode}
          initial={{ opacity: 0, x: mode === 'signup' ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          onSubmit={handleSubmit}
          className="space-y-3"
        >
          {mode === 'signup' && (
            <Input
              placeholder="Your name"
              value={form.name}
              onChange={set('name')}
              className="h-12 text-base"
              autoComplete="name"
            />
          )}
          <Input
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={set('email')}
            className="h-12 text-base"
            autoComplete="email"
            inputMode="email"
          />
          <div className="relative">
            <Input
              type={showPass ? 'text' : 'password'}
              placeholder="Password"
              value={form.password}
              onChange={set('password')}
              className="h-12 text-base pr-12"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              onClick={() => setShowPass(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg"
            >
              {error}
            </motion.p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-black"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {mode === 'signup' ? 'Create Free Account' : 'Log In'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </motion.form>

        {mode === 'signup' && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            Free forever. No credit card required.
          </p>
        )}

        {/* Legal */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing you agree to our{' '}
          <Link to="/pricing" className="text-cyan-400">Terms</Link>.
        </p>
      </div>
    </div>
  )
}
