// Seeds PORTFOLIO_PATH / ENGINE_PATH with the bundled defaults on first boot.
// Runs before `next start`. No-ops once the target has data, so it never
// overwrites edits made through the running app on a persistent volume.

const fs = require('fs')
const path = require('path')

function isEmptyDir(dir) {
  return !fs.existsSync(dir) || fs.readdirSync(dir).length === 0
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
