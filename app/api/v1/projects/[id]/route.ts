import { requireAuth } from '../../../../../lib/auth'
import { supabase } from '../../../../../lib/supabase'

const AWS_REGION_REGEX = /^[a-z]{2}-[a-z]+-[0-9]$/

type RouteContext = {
  params: {
    id: string
  }
}

type ProjectPatchBody = {
  name?: unknown
  repo_url?: unknown
  terraform_path?: unknown
  aws_region?: unknown
}

function validateProjectFields(body: ProjectPatchBody) {
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return 'name must be a non-empty string'
    }

    if (body.name.length > 100) {
      return 'name must be 100 characters or fewer'
    }
  }

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

    return { body: parsed as ProjectPatchBody, error: null }
  } catch {
    return { body: null, error: 'Invalid JSON body' }
  }
}

async function fetchProjectForOrg(id: string, orgId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error || !data) return null
  return data
}

export async function GET(req: Request, { params }: RouteContext) {
  const org = await requireAuth(req)
  const project = await fetchProjectForOrg(params.id, org.id)

  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  const { data: scans, error } = await supabase
    .from('scans')
    .select('id, started_at, completed_at, status, total_drifts, critical_drifts, high_drifts')
    .eq('project_id', project.id)
    .order('started_at', { ascending: false })
    .limit(5)

  if (error) {
    return Response.json({ error: 'Failed to fetch recent scans' }, { status: 500 })
  }

  return Response.json({ ...project, recent_scans: scans ?? [] })
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const org = await requireAuth(req)
  const project = await fetchProjectForOrg(params.id, org.id)

  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  const { body, error: bodyError } = await parseJsonBody(req)
  if (bodyError || !body) {
    return Response.json({ error: bodyError }, { status: 400 })
  }

  const validationError = validateProjectFields(body)
  if (validationError) return Response.json({ error: validationError }, { status: 400 })

  const update: Record<string, string> = {}
  if (body.name !== undefined) update.name = (body.name as string).trim()
  if (body.repo_url !== undefined) update.repo_url = body.repo_url as string
  if (body.terraform_path !== undefined) update.terraform_path = body.terraform_path as string
  if (body.aws_region !== undefined) update.aws_region = body.aws_region as string

  if (Object.keys(update).length === 0) {
    return Response.json(project)
  }

  const { data, error } = await supabase
    .from('projects')
    .update(update)
    .eq('id', params.id)
    .eq('org_id', org.id)
    .select('*')
    .single()

  if (error) {
    return Response.json({ error: 'Failed to update project' }, { status: 500 })
  }

  return Response.json(data)
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const org = await requireAuth(req)
  const project = await fetchProjectForOrg(params.id, org.id)

  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', params.id)
    .eq('org_id', org.id)

  if (error) {
    return Response.json({ error: 'Failed to delete project' }, { status: 500 })
  }

  return Response.json({ deleted: true, id: params.id })
}
