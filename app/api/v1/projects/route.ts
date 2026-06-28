import { requireAuth } from '../../../../lib/auth'
import { supabase } from '../../../../lib/supabase'

const DEFAULT_TERRAFORM_PATH = './terraform'
const DEFAULT_AWS_REGION = 'us-east-1'
const AWS_REGION_REGEX = /^[a-z]{2}-[a-z]+-[0-9]$/

type ProjectBody = {
  name?: unknown
  repo_url?: unknown
  terraform_path?: unknown
  aws_region?: unknown
}

type ProjectInsert = {
  org_id: string
  name: string
  repo_url: string | null
  terraform_path: string
  aws_region: string
}

function validateName(value: unknown, required: boolean) {
  if (value === undefined) {
    return required ? 'name is required' : null
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'name must be a non-empty string'
  }

  if (value.length > 100) {
    return 'name must be 100 characters or fewer'
  }

  return null
}

function validateOptionalProjectFields(body: ProjectBody) {
  if (body.repo_url !== undefined) {
    if (typeof body.repo_url !== 'string' || !body.repo_url.startsWith('https://github.com/')) {
      return 'repo_url must start with https://github.com/'
    }
  }

  if (body.terraform_path !== undefined) {
    if (typeof body.terraform_path !== 'string' || (!body.terraform_path.startsWith('./') && !body.terraform_path.startsWith('/'))) {
      return 'terraform_path must start with ./ or /'
    }
  }

  if (body.aws_region !== undefined) {
    if (typeof body.aws_region !== 'string' || !AWS_REGION_REGEX.test(body.aws_region)) {
      return 'aws_region must be a valid AWS region format'
    }
  }

  return null
}

async function parseJsonBody(req: Request) {
  try {
    const parsed = await req.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { body: null, error: 'body is missing or invalid' }
    }

    return { body: parsed as ProjectBody, error: null }
  } catch {
    return { body: null, error: 'Invalid JSON body' }
  }
}

async function getProjectScanStats(projectIds: string[]) {
  if (projectIds.length === 0) return new Map<string, { scan_count: number; last_scan_at: string | null; latest_scan_total_drifts: number | null }>()

  const { data, error } = await supabase
    .from('scans')
    .select('project_id, started_at, total_drifts')
    .in('project_id', projectIds)

  if (error) throw error

  const stats = new Map<string, { scan_count: number; last_scan_at: string | null; latest_scan_total_drifts: number | null }>()
  for (const id of projectIds) {
    stats.set(id, { scan_count: 0, last_scan_at: null, latest_scan_total_drifts: null })
  }

  for (const scan of data ?? []) {
    const projectId = scan.project_id as string
    const projectStats = stats.get(projectId) ?? { scan_count: 0, last_scan_at: null, latest_scan_total_drifts: null }
    projectStats.scan_count += 1

    const startedAt = scan.started_at as string | null
    if (startedAt && (!projectStats.last_scan_at || startedAt > projectStats.last_scan_at)) {
      projectStats.last_scan_at = startedAt
      projectStats.latest_scan_total_drifts = scan.total_drifts as number
    }

    stats.set(projectId, projectStats)
  }

  return stats
}

export async function GET(req: Request) {
  const org = await requireAuth(req)

  const { data: projects, error, count } = await supabase
    .from('projects')
    .select('*', { count: 'exact' })
    .eq('org_id', org.id)
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }

  try {
    const stats = await getProjectScanStats((projects ?? []).map((project) => project.id as string))
    const projectsWithStats = (projects ?? []).map((project) => ({
      ...project,
      scan_count: stats.get(project.id as string)?.scan_count ?? 0,
      last_scan_at: stats.get(project.id as string)?.last_scan_at ?? null,
      latest_scan_total_drifts: stats.get(project.id as string)?.latest_scan_total_drifts ?? null
    }))

    return Response.json({ projects: projectsWithStats, total: count ?? projectsWithStats.length })
  } catch {
    return Response.json({ error: 'Failed to fetch project scan stats' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const org = await requireAuth(req)
  const { body, error: bodyError } = await parseJsonBody(req)

  if (bodyError || !body) {
    return Response.json({ error: bodyError }, { status: 400 })
  }

  const nameError = validateName(body.name, true)
  if (nameError) return Response.json({ error: nameError }, { status: 400 })

  const fieldsError = validateOptionalProjectFields(body)
  if (fieldsError) return Response.json({ error: fieldsError }, { status: 400 })

  if (org.plan === 'free' || org.plan === 'pro') {
    const planLimit = org.plan === 'free' ? 2 : 10
    const { count, error: countError } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)

    if (countError) {
      return Response.json({ error: 'Failed to enforce project limit' }, { status: 500 })
    }

    if ((count ?? 0) >= planLimit) {
      const message = org.plan === 'free' ? 'Free plan limited to 2 projects' : 'Pro plan limited to 10 projects'
      return Response.json({ error: message, upgrade_url: '/dashboard/billing' }, { status: 402 })
    }
  }

  const project: ProjectInsert = {
    org_id: org.id,
    name: (body.name as string).trim(),
    repo_url: body.repo_url === undefined ? null : (body.repo_url as string),
    terraform_path: body.terraform_path === undefined ? DEFAULT_TERRAFORM_PATH : (body.terraform_path as string),
    aws_region: body.aws_region === undefined ? DEFAULT_AWS_REGION : (body.aws_region as string)
  }

  const { data, error } = await supabase
    .from('projects')
    .insert(project)
    .select('*')
    .single()

  if (error) {
    return Response.json({ error: 'Failed to create project' }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
