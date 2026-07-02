'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
      <h2 className="text-lg font-semibold text-slate-800">Something went wrong</h2>
      <p className="text-sm text-slate-500 max-w-md">{error.message || 'Unknown error'}</p>
      <button
        onClick={reset}
        className="mt-2 px-4 py-2 rounded-md bg-slate-800 text-white text-sm hover:bg-slate-700"
      >
        Try again
      </button>
    </div>
  )
}
