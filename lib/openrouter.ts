export type DriftExplainInput = {
  resourceType: string
  resourceId: string
  attribute: string
  desiredValue: string
  actualValue: string
  driftType: string
  riskLevel: string
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

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

export async function explainDrift(input: DriftExplainInput): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY')
  }

  let response: Response
  try {
    response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
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
    throw new Error(`Groq unreachable: ${message}`)
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Groq error ${response.status}: ${errorText}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  if (!data.choices || data.choices.length === 0) {
    throw new Error('Groq returned an empty choices array')
  }

  return (data.choices[0]?.message?.content ?? '').trim()
}
