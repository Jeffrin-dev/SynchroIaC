'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OrgNameForm({ currentName }: { currentName: string }) {
  const [name, setName] = useState(currentName)
  const [value, setValue] = useState(currentName)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(false), 2000)
    return () => window.clearTimeout(timer)
  }, [success])

  const router = useRouter()

  async function save() {
    setLoading(true)
    setError(null)
    try {
      const keyRes = await fetch('/api/v1/auth/session-key')
      if (keyRes.status === 401) {
        router.push('/login')
        return
      }
      const { api_key } = await keyRes.json()

      const response = await fetch('/api/v1/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-api-key': api_key },
        body: JSON.stringify({ name: value })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Failed to save organization name')
      setName(data.org.name)
      setValue(data.org.name)
      setEditing(false)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save organization name')
    } finally {
      setLoading(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-medium text-gray-900">{name}</p>
        <button type="button" onClick={() => setEditing(true)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Edit</button>
        {success ? <span className="text-sm font-medium text-green-700">Saved</span> : null}
        {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input value={value} onChange={(event) => setValue(event.target.value)} className="min-w-64 rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <button type="button" onClick={save} disabled={loading} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">{loading ? 'Saving...' : 'Save'}</button>
        <button type="button" onClick={() => { setValue(name); setEditing(false); setError(null) }} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">Cancel</button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
