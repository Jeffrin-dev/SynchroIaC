import Link from 'next/link'
import { headers } from 'next/headers'
import OrgNameForm from '../../../components/OrgNameForm'
import RotateKeyButton from '../../../components/RotateKeyButton'
import NotificationConfigs from '../../../components/NotificationConfigs'

type Org = { id: string; name: string; plan: 'free' | 'pro' | 'team'; created_at: string }
type NotificationConfig = { id: string; type: 'email' | 'slack'; config: { email?: string; webhook_url?: string }; enabled: boolean; created_at?: string }
type OrgResponse = { org: Org; notification_configs: NotificationConfig[]; api_key_preview: string }

const planClasses = { free: 'bg-gray-100 text-gray-700', pro: 'bg-indigo-100 text-indigo-700', team: 'bg-purple-100 text-purple-700' }
const planLimits = {
  free: 'Free: 2 projects, 10 AI explanations/month, no PR generation',
  pro: 'Pro: 10 projects, unlimited AI explanations, PR generation',
  team: 'Team: unlimited everything'
}

import { getDashboardOrgContext } from '../../../lib/dashboard-auth'

async function getOrg(apiKey: string): Promise<OrgResponse | null> {
  const headerStore = headers()
  const host = headerStore.get('host')
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (host ? `${protocol}://${host}` : '')
  if (!baseUrl) return null

  const response = await fetch(`${baseUrl}/api/v1/org`, { headers: { 'x-api-key': apiKey }, cache: 'no-store' })
  if (!response.ok) return null
  return (await response.json()) as OrgResponse
}

export default async function SettingsPage() {
  const ctx = await getDashboardOrgContext()
  const data = await getOrg(ctx.apiKey)

  if (!data) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">Failed to load organization settings</div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <p className="text-sm text-gray-500">Signed in as {ctx.userEmail}</p>

      <article className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Organization Name</h2>
        <div className="mt-4"><OrgNameForm currentName={data.org.name} /></div>
      </article>

      <article className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">API Key</h2>
          <p className="mt-1 text-sm text-gray-500">Used by the scanner to authenticate with SynchroIaC.</p>
        </div>
        <div className="rounded-md bg-gray-50 p-3 font-mono text-sm text-gray-900">{data.api_key_preview}</div>
        <p className="text-sm text-amber-700">Your full API key is never shown after creation.</p>
        <RotateKeyButton />
      </article>

      <article className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${planClasses[data.org.plan]}`}>{data.org.plan}</span>
        </div>
        <p className="text-sm text-gray-600">{planLimits[data.org.plan]}</p>
        <Link href="/dashboard/billing" className="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Upgrade</Link>
      </article>

      <article className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Drift Alerts</h2>
        <div className="mt-4"><NotificationConfigs initialConfigs={data.notification_configs} /></div>
      </article>
    </section>
  )
}
