'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

type NotificationConfig = {
  id: string
  type: 'email' | 'slack'
  config: { email?: string; webhook_url?: string }
  enabled: boolean
  created_at?: string
}

export default function NotificationConfigs({ initialConfigs }: { initialConfigs: NotificationConfig[] }) {
  const [configs, setConfigs] = useState(initialConfigs)
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'email' | 'slack'>('email')
  const [formValue, setFormValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function getApiKey() {
    const keyRes = await fetch('/api/v1/auth/session-key')
    if (keyRes.status === 401) {
      router.push('/login')
      return null
    }
    const { api_key } = await keyRes.json()
    return api_key
  }

  async function toggle(config: NotificationConfig) {
    setError(null)
    const api_key = await getApiKey()
    if (!api_key) return

    const response = await fetch(`/api/v1/org/notifications/${config.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': api_key },
      body: JSON.stringify({ enabled: !config.enabled })
    })
    const data = await response.json()
    if (!response.ok) return setError(data.error ?? 'Failed to update notification')
    setConfigs((items) => items.map((item) => (item.id === config.id ? data : item)))
  }

  async function remove(config: NotificationConfig) {
    setError(null)
    const api_key = await getApiKey()
    if (!api_key) return

    const response = await fetch(`/api/v1/org/notifications/${config.id}`, { method: 'DELETE', headers: { 'x-api-key': api_key } })
    const data = await response.json()
    if (!response.ok) return setError(data.error ?? 'Failed to delete notification')
    setConfigs((items) => items.filter((item) => item.id !== config.id))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const api_key = await getApiKey()
      if (!api_key) return

      const response = await fetch('/api/v1/org/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': api_key },
        body: JSON.stringify({ type: formType, config: formType === 'email' ? { email: formValue } : { webhook_url: formValue } })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Failed to add notification')
      setConfigs((items) => [data, ...items])
      setFormValue('')
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add notification')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {configs.length === 0 ? <p className="text-sm text-gray-500">No drift alerts configured.</p> : null}
      <div className="space-y-3">
        {configs.map((config) => {
          const summary = config.type === 'email' ? config.config.email : config.config.webhook_url
          return (
            <div key={config.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
              <div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{config.type === 'email' ? 'Email' : 'Slack'}</span>
                <p className="mt-1 max-w-md truncate text-sm text-gray-600">{summary}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => toggle(config)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700">{config.enabled ? 'Disable' : 'Enable'}</button>
                <button type="button" onClick={() => remove(config)} className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700">Delete</button>
              </div>
            </div>
          )
        })}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {showForm ? (
        <form onSubmit={submit} className="space-y-3 rounded-md border border-gray-200 p-3">
          <select value={formType} onChange={(event) => setFormType(event.target.value as 'email' | 'slack')} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="email">Email</option>
            <option value="slack">Slack</option>
          </select>
          <input value={formValue} onChange={(event) => setFormValue(event.target.value)} placeholder={formType === 'email' ? 'user@example.com' : 'https://hooks.slack.com/...'} className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">{loading ? 'Adding...' : 'Add'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">Cancel</button>
          </div>
        </form>
      ) : <button type="button" onClick={() => setShowForm(true)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Add Notification</button>}
    </div>
  )
}
