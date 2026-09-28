import { useState } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import type { ConnectionResult } from '@shared/api'
import { errorMessage } from '../../lib/errors'
import { secondaryButtonClass } from '../../lib/styles'

function ConnectionTest(): React.JSX.Element {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<ConnectionResult | null>(null)

  async function run(): Promise<void> {
    setTesting(true)
    setResult(null)
    try {
      setResult(await window.api.settings.testConnection())
    } catch (err) {
      setResult({ ok: false, message: errorMessage(err) })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-3">
      <button onClick={() => void run()} disabled={testing} className={secondaryButtonClass}>
        {testing && <Loader2 className="h-4 w-4 animate-spin" />}
        {testing ? 'Test ediliyor...' : 'Bağlantıyı test et'}
      </button>

      {testing && (
        <p className="text-xs text-faint">
          Yerel modeller ilk kullanımda belleğe yüklenirken biraz bekletebilir.
        </p>
      )}

      {result && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm select-text ${
            result.ok
              ? 'border-positive/30 bg-positive/10 text-positive'
              : 'border-negative/30 bg-negative/10 text-negative'
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  )
}

export default ConnectionTest
