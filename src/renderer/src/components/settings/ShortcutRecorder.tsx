import { useEffect, useRef, useState } from 'react'
import { Keyboard } from 'lucide-react'
import { DEFAULT_SHORTCUT, acceleratorFromKeys, formatAccelerator } from '@shared/shortcut'
import { secondaryButtonClass } from '../../lib/styles'

interface ShortcutRecorderProps {
  value: string
  active: boolean
  onChange: (accelerator: string) => Promise<void>
}

function ShortcutRecorder({ value, active, onChange }: ShortcutRecorderProps): React.JSX.Element {
  const [recording, setRecording] = useState(false)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  })

  // Kayıt sırasında tuşları yakala. Mevcut global kısayol askıya alınır;
  // yoksa aynı tuşlara basınca pencere gizlenir ve kayıt yapılamaz.
  useEffect(() => {
    if (!recording) return
    void window.api.settings.suspendShortcut(true)

    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setRecording(false)
        return
      }
      const accelerator = acceleratorFromKeys(event)
      if (!accelerator) return
      setRecording(false)
      void onChangeRef.current(accelerator)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      void window.api.settings.suspendShortcut(false)
    }
  }, [recording])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className={`flex h-10 min-w-52 items-center gap-2 rounded-lg border px-3 text-sm ${
            recording
              ? 'border-accent bg-accent/10 text-accent-hover'
              : 'border-line bg-surface text-ink'
          }`}
        >
          <Keyboard className="h-4 w-4 text-faint" />
          {recording ? 'Tuş kombinasyonuna bas...' : formatAccelerator(value)}
        </div>
        {recording ? (
          <button onClick={() => setRecording(false)} className={secondaryButtonClass}>
            İptal
          </button>
        ) : (
          <>
            <button onClick={() => setRecording(true)} className={secondaryButtonClass}>
              Değiştir
            </button>
            {value !== DEFAULT_SHORTCUT && (
              <button
                onClick={() => void onChange(DEFAULT_SHORTCUT)}
                className={secondaryButtonClass}
              >
                Varsayılan
              </button>
            )}
            {value && (
              <button onClick={() => void onChange('')} className={secondaryButtonClass}>
                Kapat
              </button>
            )}
          </>
        )}
      </div>
      {recording && (
        <p className="text-xs text-faint">
          Ctrl, Alt veya Win ile birlikte bir tuşa bas. Vazgeçmek için Esc.
        </p>
      )}
      {!recording && value && !active && (
        <p className="text-xs text-caution">
          Bu kısayol şu an çalışmıyor; başka bir uygulama kullanıyor olabilir. Farklı bir
          kombinasyon dene.
        </p>
      )}
    </div>
  )
}

export default ShortcutRecorder
