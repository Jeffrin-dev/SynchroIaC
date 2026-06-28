import { requireAuth } from '../../../../lib/auth'
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
  const org = await requireAuth(req)

  let body: IngestPayload
  try {
    const parsed = await req.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return Response.json({ error: 'body is missing or invalid' }, { status: 400 })
    }
    body = parsed as IngestPayload
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.project_id !== 'string' || body.project_id.trim() === '') {
    return Response.json({ error: 'project_id is missing or invalid' }, { status: 400 })
  }

  if (!Array.isArray(body.drifts)) {
    return Response.json({ error: 'drifts is missing or invalid' }, { status: 400 })
  }

  const summary = validateSummary(body.summary)
  if (typeof summary === 'string') {
    return Response.json({ error: summary }, { status: 400 })
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', body.project_id)
    .eq('org_id', org.id)
    .maybeSingle()

  if (projectError || !project) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
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
    return Response.json({ error: 'Failed to create scan' }, { status: 500 })
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

      return Response.json({ error: 'Failed to insert drift records' }, { status: 500 })
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
    void (async () => {
      try {
        const { data: configs, error: configsError } = await supabase
          .from('notification_configs')
          .select('*')
          .eq('org_id', org.id)
          .eq('enabled', true)

        if (configsError) {
          console.error('Failed to load notification configs', configsError)
          return
        }

        await Promise.all(
          (configs ?? [])
            .filter((config) => config.type === 'email')
            .map((config) => sendDriftAlert({ org, project_id: body.project_id, scan_id: scanId, summary, config }))
        )
      } catch (error) {
        console.error('Failed to send drift alerts', error)
      }
    })()
  }

  return Response.json(
    {
      scan_id: scanId,
      drifts_recorded: body.drifts.length,
      status: 'completed'
    },
    { status: 201 }
  )
}
