'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ExplainButtonProps = {
  driftId: string
  existingExplanation: string | null
}

export function ExplainButton({ driftId, existingExplanation }: ExplainButtonProps) {
  const [loading, setLoading] = useState(false)
  const [explanation, setExplanation] = useState<string | null>(existingExplanation)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function generateExplanation() {
    setLoading(true)
    setError(null)

    try {
      const keyRes = await fetch('/api/v1/auth/session-key')
      if (keyRes.status === 401) {
        router.push('/login')
        return
      }
      const { api_key } = await keyRes.json()

      const response = await fetch(`/api/v1/drifts/${driftId}/explain`, {
        method: 'POST',
        headers: { 'x-api-key': api_key }
      })
      const data = await response.json().catch(() => ({})) as { explanation?: string; error?: string; detail?: string }

      if (!response.ok) {
        throw new Error(data.detail ?? data.error ?? 'Failed to generate explanation')
      }

      setExplanation(data.explanation ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate explanation')
    } finally {
      setLoading(false)
    }
  }

  if (explanation) {
    return <div className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-700">{explanation}</div>
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
        Generating explanation...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="button" onClick={generateExplanation} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
        {error ? 'Retry' : 'Generate Explanation'}
      </button>
    </div>
  )
}
