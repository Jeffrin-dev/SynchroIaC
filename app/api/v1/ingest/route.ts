import { badRequest, created, notFound, serverError, tooManyRequests } from '../../../../lib/api-response'
import { withAuth } from '../../../../lib/auth'
import { checkRateLimit } from '../../../../lib/ratelimit'
import { sendDriftAlert } from '../../../../lib/resend'
import { supabase } from '../../../../lib/supabase'

type SummaryPayload = {
  total: number
  critical: number
  high: number
  medium: number
  low: number
}

type IngestPayload = {
  project_id?: unknown
  scanner_version?: unknown
  drifts?: unknown
  summary?: unknown
}

function validateSummary(summary: unknown): SummaryPayload | string {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return 'summary is missing or invalid'
  }

  const candidate = summary as Record<string, unknown>
  for (const field of ['total', 'critical', 'high', 'medium', 'low'] as const) {
    if (typeof candidate[field] !== 'number' || !Number.isFinite(candidate[field])) {
      return `summary.${field} is missing or invalid`
    }
  }

  return candidate as SummaryPayload
}

export async function POST(req: Request) {
  return withAuth(req, async (req, org) => {
    const rateLimit = checkRateLimit(`ingest:${org.id}`, 60, 60_000)
  if (!rateLimit.allowed) {
    return tooManyRequests(rateLimit.resetAt - Date.now())
  }

  let body: IngestPayload
  try {
    const parsed = await req.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return badRequest('body is missing or invalid')
    }
    body = parsed as IngestPayload
  } catch {
    return badRequest('Invalid JSON body')
  }

  if (typeof body.project_id !== 'string' || body.project_id.trim() === '') {
    return badRequest('project_id is missing or invalid')
  }

  if (!Array.isArray(body.drifts)) {
    return badRequest('drifts is missing or invalid')
  }

  const summary = validateSummary(body.summary)
  if (typeof summary === 'string') {
    return badRequest(summary)
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', body.project_id)
    .eq('org_id', org.id)
    .maybeSingle()

  if (projectError || !project) {
    return notFound('Project not found')
  }

  const { data: scan, error: scanError } = await supabase
    .from('scans')
    .insert({
      project_id: body.project_id,
      status: 'running',
      scanner_version: typeof body.scanner_version === 'string' ? body.scanner_version : null,
      started_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (scanError || !scan) {
    return serverError('Failed to create scan')
  }

  const scanId = scan.id

  if (body.drifts.length > 0) {
    const rows = body.drifts.map((drift) => {
      const item = drift as Record<string, unknown>
      return {
        scan_id: scanId,
        resource_type: item.resource_type,
        resource_id: item.resource_id,
        attribute: item.attribute,
        desired_value: item.desired_value,
        actual_value: item.actual_value,
        drift_type: item.drift_type,
        risk_level: item.risk_level,
        explanation: null,
        pr_url: null
      }
    })

    const { error: driftError } = await supabase.from('drifts').insert(rows)

    if (driftError) {
      await supabase
        .from('scans')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: driftError.message
        })
        .eq('id', scanId)

      return serverError('Failed to insert drift records')
    }
  }

  const { error: updateError } = await supabase
    .from('scans')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      total_drifts: summary.total,
      critical_drifts: summary.critical,
      high_drifts: summary.high,
      medium_drifts: summary.medium,
      low_drifts: summary.low
    })
    .eq('id', scanId)

  if (updateError) {
    console.error('Failed to update completed scan', updateError)
  }

  if (summary.critical > 0 || summary.high > 0) {
    // Floating promise for alerts - wrapped in try/catch to prevent process crash
    (async () => {
      try {
        const { data: configs, error: configsError } = await supabase
          .from('notification_configs')
          .select('id, type, config, enabled')
          .eq('org_id', org.id)
          .eq('enabled', true)

        if (configsError) {
          console.error('Failed to load notification configs', configsError)
          return
        }

        await Promise.all(
          (configs ?? [])
            .filter((config) => config.type === 'email')
            .map((config) => {
              const configBody = config.config as Record<string, unknown>
              const recipientEmail =
                typeof configBody.recipientEmail === 'string'
                  ? configBody.recipientEmail
                  : typeof configBody.email === 'string'
                    ? configBody.email
                    : ''

              if (!recipientEmail) {
                console.warn('Email notification config missing recipient email', config.id)
                return Promise.resolve()
              }

              return sendDriftAlert({
                orgName: org.name,
                recipientEmail,
                projectName: project.name,
                scanId,
                totalDrifts: summary.total,
                criticalCount: summary.critical,
                highCount: summary.high,
                mediumCount: summary.medium,
                lowCount: summary.low,
                dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard/scans/${scanId}`
              })
            })
        )
      } catch (error) {
        console.error('Failed to send drift alerts', error)
      }
    })()
  }

    return created({
      scan_id: scanId,
      drifts_recorded: body.drifts.length,
      status: 'completed'
    })
  })
}
