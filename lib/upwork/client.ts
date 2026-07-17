// Low-level HTTP layer for Upwork's OAuth2 + GraphQL endpoints. No token
// persistence here — see lib/upwork/tokens.ts for that. Kept one-directional
// (tokens.ts depends on this file, never the reverse) so there's no import cycle.

const AUTHORIZE_ENDPOINT = 'https://www.upwork.com/ab/account-security/oauth2/authorize'
const TOKEN_ENDPOINT = 'https://www.upwork.com/api/v3/oauth2/token'
const GRAPHQL_ENDPOINT = 'https://api.upwork.com/graphql'

export interface UpworkTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing required env var: ${name}`)
  return val
}

export function getAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: requireEnv('UPWORK_CLIENT_ID'),
    redirect_uri: requireEnv('UPWORK_REDIRECT_URI'),
    state,
  })
  return `${AUTHORIZE_ENDPOINT}?${params.toString()}`
}

async function requestToken(body: URLSearchParams): Promise<UpworkTokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Upwork token request failed (${res.status}): ${text.slice(0, 500)}`)
  }
  return JSON.parse(text) as UpworkTokenResponse
}

export async function exchangeCodeForToken(code: string): Promise<UpworkTokenResponse> {
  return requestToken(new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: requireEnv('UPWORK_CLIENT_ID'),
    client_secret: requireEnv('UPWORK_CLIENT_SECRET'),
    redirect_uri: requireEnv('UPWORK_REDIRECT_URI'),
  }))
}

export async function refreshToken(refreshTokenValue: string): Promise<UpworkTokenResponse> {
  return requestToken(new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshTokenValue,
    client_id: requireEnv('UPWORK_CLIENT_ID'),
    client_secret: requireEnv('UPWORK_CLIENT_SECRET'),
  }))
}

// ─── GraphQL ──────────────────────────────────────────────────────────────

export class UpworkApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'UpworkApiError'
    this.status = status
  }
}

const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ~300 req/min, ~40k/day per Upwork's limits — a 429 here means we've hit
// that ceiling. Retry with backoff (honoring Retry-After when present)
// rather than failing the user's search outright.
export async function queryGraphQL<T>(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
    })

    if (res.status === 429) {
      if (attempt === MAX_RETRIES) {
        throw new UpworkApiError(429, 'Upwork API rate limit hit — try again shortly.')
      }
      const retryAfterMs = Number(res.headers.get('Retry-After')) * 1000
      await sleep(Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : BASE_BACKOFF_MS * 2 ** attempt)
      continue
    }

    const text = await res.text()
    if (!res.ok) {
      throw new UpworkApiError(res.status, `Upwork GraphQL request failed (${res.status}): ${text.slice(0, 500)}`)
    }

    const json = JSON.parse(text) as { data?: T; errors?: Array<{ message: string }> }
    if (json.errors && json.errors.length > 0) {
      throw new UpworkApiError(200, `Upwork GraphQL error: ${json.errors.map(e => e.message).join('; ')}`)
    }
    return json.data as T
  }

  throw new UpworkApiError(429, 'Upwork API rate limit hit — try again shortly.')
}
