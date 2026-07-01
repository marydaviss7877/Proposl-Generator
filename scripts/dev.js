const { execSync, spawn } = require('child_process')

const PORT = 3000

// Kill anything running on the port before starting
try {
  const output = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8' })
  const pids = new Set()
  for (const line of output.trim().split('\n')) {
    const parts = line.trim().split(/\s+/)
    const pid = parts[parts.length - 1]
    if (pid && pid !== '0' && /^\d+$/.test(pid)) pids.add(pid)
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
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
