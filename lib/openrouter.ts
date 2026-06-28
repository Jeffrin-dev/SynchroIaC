export type DriftExplainInput = {
  resourceType: string
  resourceId: string
  attribute: string
  desiredValue: string
  actualValue: string
  driftType: string
  riskLevel: string
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const SYSTEM_PROMPT = `You are an infrastructure security and reliability expert. You explain
Terraform and AWS infrastructure drift to DevOps engineers clearly and
concisely. Always structure your response in three parts:
1. What changed (one sentence, factual)
2. Why it matters (one to two sentences, business/security impact)
3. How to fix it (one sentence, the Terraform action needed)
Keep the total response under 120 words. No markdown, no bullet points,
plain text only.`

function buildUserPrompt(input: DriftExplainInput): string {
  return `Resource type: ${input.resourceType}
Resource ID: ${input.resourceId}
Drifted attribute: ${input.attribute}
Terraform declares: ${input.desiredValue}
AWS actual value: ${input.actualValue}
Drift type: ${input.driftType}
Risk level: ${input.riskLevel}

Explain this infrastructure drift.`
}

function extractErrorMessage(body: unknown): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    const error = record.error

    if (typeof record.message === 'string') return record.message
    if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') {
      return (error as Record<string, string>).message
    }
    if (typeof error === 'string') return error
  }

  if (typeof body === 'string' && body.trim()) return body.trim()
  return 'Unknown error'
}

export async function explainDrift(input: DriftExplainInput): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY')
  }

  let response: Response
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? '',
        'X-Title': 'SynchroIaC'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini-search-preview:free',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(input) }
        ],
        max_tokens: 200,
        temperature: 0.3
      })
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`OpenRouter unreachable: ${message}`)
  }

  if (!response.ok) {
    let errorBody: unknown
    try {
      errorBody = await response.json()
    } catch {
      try {
        errorBody = await response.text()
      } catch {
        errorBody = undefined
      }
    }

    throw new Error(`OpenRouter error ${response.status}: ${extractErrorMessage(errorBody)}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  return (data.choices?.[0]?.message?.content ?? '').trim()
}
