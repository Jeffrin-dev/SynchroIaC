import Link from 'next/link'
import { headers } from 'next/headers'
import { timeAgo } from '../../../lib/format'

type Project = {
  id: string
  name: string
  repo_url: string | null
  aws_region: string
  last_scan_at: string | null
  latest_scan_total_drifts?: number | null
}

type ProjectsResponse = {
  projects: Project[]
}

import { getDashboardOrgContext } from '../../../lib/dashboard-auth'

async function getProjects(apiKey: string): Promise<Project[] | null> {
  const headerStore = headers()
  const host = headerStore.get('host')
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (host ? `${protocol}://${host}` : '')

  if (!baseUrl) return null

  const response = await fetch(`${baseUrl}/api/v1/projects`, {
    headers: { 'x-api-key': apiKey },
    cache: 'no-store'
  })

  if (!response.ok) return null

  const data = (await response.json()) as ProjectsResponse
  return data.projects
}

export default async function ProjectsPage() {
  const ctx = await getDashboardOrgContext()
  const projects = await getProjects(ctx.apiKey)

  if (!projects) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-gray-500 shadow-sm">Failed to load projects</div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <Link href="/dashboard/projects/new" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">New Project</Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-gray-500">No projects yet. Create your first project to start scanning for drift.</p>
          <Link href="/dashboard/projects/new" className="mt-5 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">New Project</Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <article key={project.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-bold text-gray-900">{project.name}</h2>
                  <p className="mt-1 text-sm text-gray-500">{project.repo_url ?? 'No repo configured'}</p>
                </div>
                <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{project.aws_region}</span>
              </div>

              <div className="mt-5 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                <p><span className="font-medium text-gray-900">Last scan:</span> {timeAgo(project.last_scan_at)}</p>
                <p><span className="font-medium text-gray-900">Total drift:</span> {project.latest_scan_total_drifts ?? 'Unavailable'}</p>
              </div>

              <div className="mt-5 flex gap-3">
                <Link href={`/dashboard/drifts?project_id=${project.id}`} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">View Drifts</Link>
                <Link href={`/dashboard/projects/${project.id}/settings`} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Settings</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
