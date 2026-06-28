'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type ResolveButtonProps = {
  driftId: string
  isResolved: boolean
}

export function ResolveButton({ driftId, isResolved }: ResolveButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggleResolved() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/v1/drifts/${driftId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_DASHBOARD_API_KEY ?? ''
        },
        body: JSON.stringify({ resolved: !isResolved })
      })
      const data = await response.json().catch(() => ({})) as { error?: string; detail?: string }

      if (!response.ok) {
        throw new Error(data.detail ?? data.error ?? 'Failed to update drift')
      }

      router.push('/dashboard/drifts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update drift')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="button" onClick={toggleResolved} disabled={loading} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? 'Updating...' : isResolved ? 'Reopen Drift' : 'Mark Resolved'}
      </button>
    </div>
  )
}
