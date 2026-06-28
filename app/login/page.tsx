'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard')
    })
  }, [router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-bold text-gray-900">SynchroIaC</h1>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600" />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Signing in...' : 'Sign in'}</button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </div>
    </main>
  )
}
