const { execSync, spawn } = require('child_process')

const PORT = 3000
const isWindows = process.platform === 'win32'

// Kill anything running on the port before starting
try {
  const pids = new Set()

  if (isWindows) {
    const output = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8' })
    for (const line of output.trim().split('\n')) {
      const parts = line.trim().split(/\s+/)
      const pid = parts[parts.length - 1]
      if (pid && pid !== '0' && /^\d+$/.test(pid)) pids.add(pid)
    }
  } else {
    const output = execSync(`lsof -ti tcp:${PORT} -sTCP:LISTEN`, { encoding: 'utf8' })
    for (const pid of output.trim().split('\n')) {
      if (pid) pids.add(pid)
    }
  }

  for (const pid of pids) {
    try {
      execSync(isWindows ? `taskkill /PID ${pid} /F` : `kill -9 ${pid}`, { stdio: 'ignore' })
      console.log(`Killed process ${pid} on port ${PORT}`)
    } catch {}
  }
} catch {
  // Port is already free — nothing to kill
}

const next = spawn('npx', ['next', 'dev', '--port', String(PORT)], {
  stdio: 'inherit',
  shell: true,
})

next.on('exit', (code) => process.exit(code ?? 0))
