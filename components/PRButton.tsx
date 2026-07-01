'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type PRButtonProps = {
  driftId: string
  existingPrUrl: string | null
}

export function PRButton({ driftId, existingPrUrl }: PRButtonProps) {
  const [loading, setLoading] = useState(false)
  const [prUrl, setPrUrl] = useState<string | null>(existingPrUrl)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function generatePr() {
    setLoading(true)
    setError(null)

    try {
      const keyRes = await fetch('/api/v1/auth/session-key')
      if (keyRes.status === 401) {
        router.push('/login')
        return
      }
      const { api_key } = await keyRes.json()

      const response = await fetch(`/api/v1/drifts/${driftId}/pr`, {
        method: 'POST',
        headers: { 'x-api-key': api_key }
      })
      const data = await response.json().catch(() => ({})) as { pr_url?: string; error?: string; detail?: string }

      if (!response.ok) {
        throw new Error(data.detail ?? data.error ?? 'Failed to create PR')
      }

      setPrUrl(data.pr_url ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create PR')
    } finally {
      setLoading(false)
    }
  }

  if (prUrl) {
    return <a href={prUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">View PR on GitHub</a>
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
        Creating PR...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="button" onClick={generatePr} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Generate Fix PR</button>
    </div>
  )
}
