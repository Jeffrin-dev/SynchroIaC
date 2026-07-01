'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RotateKeyButton() {
  const [loading, setLoading] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const router = useRouter()

  async function rotate() {
    if (!window.confirm('This will invalidate your current API key. All scanners using the old key will stop working until updated. Continue?')) return
    setConfirmed(true)
    setLoading(true)
    setError(null)
    try {
      const keyRes = await fetch('/api/v1/auth/session-key')
      if (keyRes.status === 401) {
        router.push('/login')
        return
      }
      const { api_key } = await keyRes.json()

      const response = await fetch('/api/v1/org/rotate-key', { method: 'POST', headers: { 'x-api-key': api_key } })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Failed to rotate API key')
      setNewKey(data.api_key)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate API key')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={rotate} disabled={loading} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
        {loading ? 'Rotating...' : 'Rotate API Key'}
      </button>
      {confirmed && error ? <p className="text-sm text-red-600">{error}</p> : null}
      {newKey ? (
        <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-800">Save this key now. It disappears when you leave this page.</p>
          <pre className="overflow-x-auto rounded bg-white p-3 text-sm text-gray-900">{newKey}</pre>
          <button type="button" onClick={() => navigator.clipboard.writeText(newKey)} className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100">Copy</button>
        </div>
      ) : null}
    </div>
  )
}
