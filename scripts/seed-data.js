// Seeds PORTFOLIO_PATH / ENGINE_PATH with the bundled defaults on first boot.
// Runs before `next start`. No-ops once the target has data, so it never
// overwrites edits made through the running app on a persistent volume.

const fs = require('fs')
const path = require('path')

function isEmptyDir(dir) {
  return !fs.existsSync(dir) || fs.readdirSync(dir).length === 0
}

// In production, PORTFOLIO_PATH / ENGINE_PATH / UPWORK_TOKEN_PATH MUST point at
// the persistent volume — otherwise every case study/engine edit AND the
// Upwork OAuth tokens are written to the ephemeral container filesystem and
// silently lost on redeploy (forcing a re-authorization through Upwork).
if (process.env.NODE_ENV === 'production') {
  const missing = ['PORTFOLIO_PATH', 'ENGINE_PATH', 'UPWORK_TOKEN_PATH'].filter((k) => !process.env[k])
  if (missing.length > 0) {
    console.warn(
      `[seed-data] ⚠️  ${missing.join(', ')} not set — runtime edits (and/or the ` +
      `Upwork connection) will NOT persist across redeploys. Point these at the mounted volume (e.g. /data).`
    )
  }
}

const portfolioTarget = process.env.PORTFOLIO_PATH
if (portfolioTarget) {
  const bundled = path.join(__dirname, '..', 'data', 'portfolio')
  if (path.resolve(portfolioTarget) !== path.resolve(bundled) && isEmptyDir(portfolioTarget)) {
    fs.mkdirSync(portfolioTarget, { recursive: true })
    fs.cpSync(bundled, portfolioTarget, { recursive: true })
    console.log(`[seed-data] Seeded portfolio data into ${portfolioTarget}`)
  }
}

const engineTarget = process.env.ENGINE_PATH
if (engineTarget) {
  const bundled = path.join(__dirname, '..', 'data', 'engine.json')
  if (path.resolve(engineTarget) !== path.resolve(bundled) && !fs.existsSync(engineTarget)) {
    fs.mkdirSync(path.dirname(engineTarget), { recursive: true })
    fs.copyFileSync(bundled, engineTarget)
    console.log(`[seed-data] Seeded engine config into ${engineTarget}`)
  }
}
