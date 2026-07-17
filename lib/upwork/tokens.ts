import fs from 'fs/promises'
import path from 'path'
import { refreshToken as refreshUpworkToken, type UpworkTokenResponse } from './client'

export interface TokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number
  obtainedAt: number
}

export class UpworkNotConnectedError extends Error {
  constructor() {
    super('Upwork is not connected — visit /api/auth/upwork to authorize.')
    this.name = 'UpworkNotConnectedError'
  }
}

// Same pattern as PORTFOLIO_PATH/ENGINE_PATH in lib/portfolio.ts — in prod this
// MUST point at the Railway persistent volume, or every redeploy wipes the
// token file and forces re-authorization.
function getTokenPath(): string {
  return process.env.UPWORK_TOKEN_PATH || path.join(process.cwd(), '.cache', 'upwork-tokens.json')
}

function toTokenSet(res: UpworkTokenResponse): TokenSet {
  const now = Date.now()
  return {
    accessToken: res.access_token,
    refreshToken: res.refresh_token,
    expiresAt: now + res.expires_in * 1000,
    obtainedAt: now,
  }
}

export async function readTokens(): Promise<TokenSet | null> {
  try {
    const raw = await fs.readFile(getTokenPath(), 'utf-8')
    return JSON.parse(raw) as TokenSet
  } catch {
    return null
  }
}

export async function writeTokens(tokens: TokenSet): Promise<void> {
  const filePath = getTokenPath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(tokens, null, 2), 'utf-8')
}

export async function storeTokenResponse(res: UpworkTokenResponse): Promise<void> {
  await writeTokens(toTokenSet(res))
}

export async function clearTokens(): Promise<void> {
  try {
    await fs.unlink(getTokenPath())
  } catch {
    // already gone
  }
}

export async function isConnected(): Promise<boolean> {
  return (await readTokens()) !== null
}

// Refresh a bit before actual expiry so a slow request never straddles the boundary.
const REFRESH_MARGIN_MS = 60_000

export async function getValidAccessToken(): Promise<string> {
  const tokens = await readTokens()
  if (!tokens) throw new UpworkNotConnectedError()

  if (Date.now() < tokens.expiresAt - REFRESH_MARGIN_MS) {
    return tokens.accessToken
  }

  // Upwork rotates the refresh token on every use — the old one is invalid
  // the instant this call succeeds, so the new one MUST be persisted.
  const refreshed = await refreshUpworkToken(tokens.refreshToken)
  await storeTokenResponse(refreshed)
  return refreshed.access_token
}
