// Warms the embedding model into MODEL_CACHE_PATH before the web server starts.
//
// Why this exists: on the 500MB Railway box, letting the first HTTP request
// trigger the ~80MB model download AND the ONNX inference at the same time
// spikes memory past the ceiling and OOM-kills the server. Doing it here, in a
// separate process that exits before `next start`, means:
//   1. the download buffers are freed before the server ever allocates,
//   2. the first real search loads the quantized model straight from disk cache.
//
// Runs quantized (model_quantized.onnx, ~23MB) to keep peak RAM low. Never fails
// the boot: if the network is down, we log and continue so the app still starts.

const path = require('path')

async function main() {
  const cacheDir = process.env.MODEL_CACHE_PATH || path.join(__dirname, '..', '.cache', 'models')

  const { pipeline, env } = await import('@xenova/transformers')
  env.cacheDir = cacheDir
  try {
    if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
      env.backends.onnx.wasm.numThreads = 1
    }
  } catch { /* ignore */ }

  console.log(`[prefetch-model] warming Xenova/all-MiniLM-L6-v2 into ${cacheDir} …`)
  const start = Date.now()
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true })
  // One tiny inference forces the ONNX session to fully initialise & cache.
  await extractor('warmup', { pooling: 'mean', normalize: true })
  console.log(`[prefetch-model] ready in ${((Date.now() - start) / 1000).toFixed(1)}s`)
}

main().catch((err) => {
  console.warn('[prefetch-model] warmup failed (continuing anyway):', err && err.message ? err.message : err)
  process.exit(0)
})
