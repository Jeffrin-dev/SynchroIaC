'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

const AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-central-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1'
]

export default function NewProjectForm() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const name = (formData.get('name') as string)?.trim()

    if (!name) {
      setError('Project name is required')
      setIsSubmitting(false)
      return
    }

    const keyRes = await fetch('/api/v1/auth/session-key')
    if (keyRes.status === 401) {
      router.push('/login')
      return
    }
    const { api_key } = await keyRes.json()

    const response = await fetch('/api/v1/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': api_key
      },
      body: JSON.stringify({
        name,
        repo_url: (formData.get('repo_url') as string)?.trim() || undefined,
        terraform_path: (formData.get('terraform_path') as string)?.trim() || undefined,
        aws_region: formData.get('aws_region') || undefined
      })
    })

    if (response.ok) {
      router.push('/dashboard/projects')
      router.refresh()
      return
    }

    const body = (await response.json().catch(() => null)) as { error?: string } | null
    setError(body?.error ?? 'Failed to create project')
    setIsSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <label className="block">
        <span className="text-sm font-medium text-gray-700">Project name</span>
        <input name="name" required className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">Repository URL</span>
        <input
          name="repo_url"
          placeholder="https://github.com/your-org/your-repo"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">Terraform path</span>
        <input name="terraform_path" defaultValue="./terraform" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">AWS Region</span>
        <select name="aws_region" defaultValue="us-east-1" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
          {AWS_REGIONS.map((region) => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isSubmitting} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
          {isSubmitting ? 'Creating…' : 'Create project'}
        </button>
        <Link href="/dashboard/projects" className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700">
          Cancel
        </Link>
      </div>
    </form>
  )
}
