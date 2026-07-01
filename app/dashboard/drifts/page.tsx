import Link from 'next/link'
import { headers } from 'next/headers'
import { timeAgo } from '../../../lib/format'

const LIMIT = 20
const RISK_LEVELS = ['critical', 'high', 'medium', 'low'] as const

type RiskLevel = (typeof RISK_LEVELS)[number]

type Drift = {
  id: string
  resource_type: string | null
  resource_id: string | null
  attribute: string | null
  desired_value: unknown
  actual_value: unknown
  risk_level: RiskLevel | string | null
  project_id: string | null
  created_at: string | null
}

type Project = {
  id: string
  name: string
}

type DriftsResponse = {
  drifts: Drift[]
  total: number
  limit: number
  offset: number
}

type ProjectsResponse = {
  projects: Project[]
}

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getBaseUrl() {
  const headerStore = headers()
  const host = headerStore.get('host')
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http'
  return process.env.NEXT_PUBLIC_APP_URL ?? (host ? `${protocol}://${host}` : '')
}

function buildQuery(searchParams: PageProps['searchParams']) {
  const params = new URLSearchParams()
  for (const key of ['project_id', 'risk_level']) {
    const value = firstParam(searchParams?.[key])
    if (value) params.set(key, value)
  }
  const resolved = firstParam(searchParams?.resolved)
  const resolvedWasSubmitted = Object.prototype.hasOwnProperty.call(searchParams ?? {}, 'resolved')
  if (resolved === 'true' || resolved === 'false') {
    params.set('resolved', resolved)
  } else if (!resolvedWasSubmitted) {
    params.set('resolved', 'false')
  }
  params.set('limit', String(LIMIT))
  params.set('offset', firstParam(searchParams?.offset) ?? '0')
  return params
}

import { getDashboardOrgContext } from '../../../lib/dashboard-auth'

async function apiFetch<T>(path: string, apiKey: string): Promise<{ data: T | null; error: string | null }> {
  const baseUrl = getBaseUrl()
  if (!baseUrl) return { data: null, error: 'Dashboard API is not configured' }

  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'x-api-key': apiKey },
    cache: 'no-store'
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    return { data: null, error: data.error ?? 'Failed to fetch data' }
  }

  return { data: await response.json() as T, error: null }
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value
}

function riskClasses(risk: string | null | undefined) {
  switch (risk) {
    case 'critical': return 'bg-red-100 text-red-800'
    case 'high': return 'bg-orange-100 text-orange-800'
    case 'medium': return 'bg-yellow-100 text-yellow-800'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function pageHref(searchParams: PageProps['searchParams'], offset: number) {
  const params = buildQuery(searchParams)
  params.set('offset', String(Math.max(0, offset)))
  return `/dashboard/drifts?${params.toString()}`
}

export default async function DriftsPage({ searchParams }: PageProps) {
  const ctx = await getDashboardOrgContext()
  const query = buildQuery(searchParams)
  const [{ data: driftData, error }, { data: projectData }] = await Promise.all([
    apiFetch<DriftsResponse>(`/api/v1/drifts?${query.toString()}`, ctx.apiKey),
    apiFetch<ProjectsResponse>('/api/v1/projects', ctx.apiKey)
  ])

  const projects = projectData?.projects ?? []
  const projectNames = new Map(projects.map((project) => [project.id, project.name]))
  const drifts = driftData?.drifts ?? []
  const total = driftData?.total ?? 0
  const offset = driftData?.offset ?? Number(query.get('offset') ?? 0)
  const activeResolved = query.get('resolved')
  const counts = Object.fromEntries(RISK_LEVELS.map((risk) => [risk, drifts.filter((drift) => drift.risk_level === risk).length])) as Record<RiskLevel, number>
  const showingStart = total === 0 ? 0 : offset + 1
  const showingEnd = Math.min(offset + LIMIT, total)

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Drifts</h1>

      <form className="flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm" action="/dashboard/drifts">
        <label className="space-y-1 text-sm font-medium text-gray-700">
          <span>Project</span>
          <select name="project_id" defaultValue={query.get('project_id') ?? ''} className="block rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
            <option value="">All projects</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-gray-700">
          <span>Risk level</span>
          <select name="risk_level" defaultValue={query.get('risk_level') ?? ''} className="block rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
            <option value="">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-gray-700">
          <span>Status</span>
          <select name="resolved" defaultValue={activeResolved ?? 'false'} className="block rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
            <option value="false">Open</option>
            <option value="true">Resolved</option>
            <option value="">All</option>
          </select>
        </label>
        <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Apply</button>
        <Link href="/dashboard/drifts" className="pb-2 text-sm font-medium text-indigo-600 hover:text-indigo-700">Clear filters</Link>
      </form>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        {RISK_LEVELS.map((risk) => <span key={risk} className={`rounded-full px-3 py-1 text-xs font-medium ${riskClasses(risk)}`}>{risk[0].toUpperCase() + risk.slice(1)}: {counts[risk]}</span>)}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {drifts.length === 0 ? (
          <div className="p-10 text-center text-gray-500"><span className="mx-auto mb-3 block text-3xl text-green-600">✓</span>{activeResolved === 'true' ? 'No resolved drifts found.' : 'No drift detected'}</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Risk</th><th className="px-4 py-3">Resource</th><th className="px-4 py-3">Attribute</th><th className="px-4 py-3">Change</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">Detected</th><th className="px-4 py-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-200">
              {drifts.map((drift) => (
                <tr key={drift.id}>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskClasses(drift.risk_level)}`}>{drift.risk_level ?? 'low'}</span></td>
                  <td className="px-4 py-3 text-gray-900">{truncate(`${drift.resource_type ?? 'unknown'} / ${drift.resource_id ?? 'unknown'}`, 40)}</td>
                  <td className="px-4 py-3 text-gray-600">{drift.attribute ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{truncate(stringifyValue(drift.desired_value), 30)} → {truncate(stringifyValue(drift.actual_value), 30)}</td>
                  <td className="px-4 py-3 text-gray-600">{drift.project_id ? projectNames.get(drift.project_id) ?? truncate(drift.project_id, 8) : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{timeAgo(drift.created_at)}</td>
                  <td className="px-4 py-3"><Link href={`/dashboard/drifts/${drift.id}`} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <p>Showing {showingStart}-{showingEnd} of {total} drifts</p>
        <div className="flex gap-2">
          {offset === 0 ? <span className="rounded-md border border-gray-200 px-3 py-2 text-gray-300">Previous</span> : <Link href={pageHref(searchParams, offset - LIMIT)} className="rounded-md border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50">Previous</Link>}
          {offset + LIMIT >= total ? <span className="rounded-md border border-gray-200 px-3 py-2 text-gray-300">Next</span> : <Link href={pageHref(searchParams, offset + LIMIT)} className="rounded-md border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50">Next</Link>}
        </div>
      </div>
    </section>
  )
}
