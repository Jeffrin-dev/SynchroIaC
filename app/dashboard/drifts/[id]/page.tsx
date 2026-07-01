import Link from 'next/link'
import { headers } from 'next/headers'
import { ExplainButton } from '../../../../components/ExplainButton'
import { PRButton } from '../../../../components/PRButton'
import { ResolveButton } from '../../../../components/ResolveButton'
import { timeAgo } from '../../../../lib/format'

type Drift = {
  id: string
  resource_type: string | null
  resource_id: string | null
  attribute: string | null
  desired_value: unknown
  actual_value: unknown
  drift_type: string | null
  risk_level: string | null
  explanation: string | null
  pr_url: string | null
  resolved_at: string | null
  created_at: string | null
}

type PageProps = {
  params: { id: string }
}

function getBaseUrl() {
  const headerStore = headers()
  const host = headerStore.get('host')
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http'
  return process.env.NEXT_PUBLIC_APP_URL ?? (host ? `${protocol}://${host}` : '')
}

import { getDashboardOrgContext } from '../../../../lib/dashboard-auth'

async function getDrift(id: string, apiKey: string): Promise<{ drift: Drift | null; status: number; error: string | null }> {
  const baseUrl = getBaseUrl()
  if (!baseUrl) return { drift: null, status: 500, error: 'Dashboard API is not configured' }

  const response = await fetch(`${baseUrl}/api/v1/drifts/${id}`, {
    headers: { 'x-api-key': apiKey },
    cache: 'no-store'
  })
  const data = await response.json().catch(() => ({})) as Drift & { error?: string }

  if (!response.ok) {
    return { drift: null, status: response.status, error: data.error ?? 'Failed to fetch drift' }
  }

  return { drift: data, status: response.status, error: null }
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value, null, 2)
}

function truncate(value: string, length = 8) {
  return value.length > length ? `${value.slice(0, length)}…` : value
}

function riskClasses(risk: string | null | undefined) {
  switch (risk) {
    case 'critical': return 'bg-red-100 text-red-800'
    case 'high': return 'bg-orange-100 text-orange-800'
    case 'medium': return 'bg-yellow-100 text-yellow-800'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-1 text-sm text-gray-900">{value}</dd></div>
}

export default async function DriftDetailPage({ params }: PageProps) {
  const ctx = await getDashboardOrgContext()
  const { drift, status, error } = await getDrift(params.id, ctx.apiKey)

  if (status === 404) {
    return <section className="space-y-4"><Link href="/dashboard/drifts" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">← Back to drifts</Link><div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-bold text-gray-900">Drift not found</h1></div></section>
  }

  if (error || !drift) {
    return <section className="space-y-4"><h1 className="text-2xl font-bold text-gray-900">Drift</h1><div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error ?? 'Failed to load drift'}</div></section>
  }

  const highRiskActual = drift.risk_level === 'critical' || drift.risk_level === 'high'
  const isResolved = Boolean(drift.resolved_at)

  return (
    <section className="space-y-6">
      <nav className="text-sm text-gray-500"><Link href="/dashboard/drifts" className="font-medium text-indigo-600 hover:text-indigo-700">Drifts</Link><span className="mx-2">/</span><span>{truncate(drift.id, 12)}</span></nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${riskClasses(drift.risk_level)}`}>{drift.risk_level ?? 'low'}</span>
          <h1 className="text-2xl font-bold text-gray-900">{drift.resource_type ?? 'unknown'} <span className="font-normal text-gray-500">/</span> {drift.resource_id ?? 'unknown'}</h1>
        </div>
        <div className="flex flex-wrap gap-3"><PRButton driftId={drift.id} existingPrUrl={drift.pr_url} /><ResolveButton driftId={drift.id} isResolved={isResolved} /></div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-8 md:grid-cols-2">
          <dl className="grid gap-4">
            <DetailItem label="Resource Type" value={drift.resource_type ?? '—'} />
            <DetailItem label="Resource ID" value={drift.resource_id ?? '—'} />
            <DetailItem label="Attribute" value={drift.attribute ?? '—'} />
            <DetailItem label="Drift Type" value={drift.drift_type ?? '—'} />
            <DetailItem label="Detected" value={timeAgo(drift.created_at)} />
            <DetailItem label="Status" value={<span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${isResolved ? 'bg-green-500' : 'bg-red-500'}`} />{isResolved ? 'Resolved' : 'Open'}</span>} />
          </dl>
          <div className="space-y-4">
            <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Terraform declares</p><pre className="overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-3 font-mono text-sm text-gray-900">{stringifyValue(drift.desired_value)}</pre></div>
            <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">AWS actual value</p><pre className={`overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-3 font-mono text-sm ${highRiskActual ? 'text-red-700' : 'text-gray-900'}`}>{stringifyValue(drift.actual_value)}</pre></div>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-lg font-bold text-gray-900">AI Explanation</h2><ExplainButton driftId={drift.id} existingExplanation={drift.explanation} /></section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-lg font-bold text-gray-900">Fix Pull Request</h2><div className="space-y-2"><PRButton driftId={drift.id} existingPrUrl={drift.pr_url} /><p className="text-sm text-gray-500">PR generation requires Pro plan.</p></div></section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"><ResolveButton driftId={drift.id} isResolved={isResolved} /></section>
    </section>
  )
}
