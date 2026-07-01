import Link from 'next/link'
import { headers } from 'next/headers'

type Project = { id: string; name: string; repo_url: string | null; terraform_path: string; aws_region: string }

import { getDashboardOrgContext } from '../../../../../lib/dashboard-auth'

async function getProject(id: string, apiKey: string): Promise<Project | null> {
  const headerStore = headers()
  const host = headerStore.get('host')
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (host ? `${protocol}://${host}` : '')
  if (!baseUrl) return null

  const response = await fetch(`${baseUrl}/api/v1/projects/${id}`, { headers: { 'x-api-key': apiKey }, cache: 'no-store' })
  if (!response.ok) return null
  return (await response.json()) as Project
}

export default async function ProjectSettingsPage({ params }: { params: { id: string } }) {
  const ctx = await getDashboardOrgContext()
  const project = await getProject(params.id, ctx.apiKey)

  if (!project) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Project Not Found</h1>
        <Link href="/dashboard/projects" className="mt-4 inline-block text-indigo-600 hover:text-indigo-500">
          &larr; Back to projects
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{project.name} Settings</h1>
        <Link href="/dashboard/projects" className="text-sm font-medium text-gray-500 hover:text-gray-700">
          &larr; Back
        </Link>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-gray-600">Project settings are currently managed via API.</p>
      </div>
    </div>
  )
}
