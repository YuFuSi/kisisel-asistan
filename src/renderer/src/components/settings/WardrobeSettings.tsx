import { useEffect } from 'react'
import { Check, Lock } from 'lucide-react'
import Pet from '../jarvis/Pet'
import {
  ACCESSORIES,
  SLOT_LABELS,
  markWardrobeSeen,
  toggleAccessory,
  useWardrobe,
  type AccessorySlot
} from '../../lib/wardrobe'

const SLOTS: AccessorySlot[] = ['head', 'antenna', 'eyes', 'body', 'hand']

// Kıyafet dolabı (#125): yerine göre gruplu aksesuarlar ve canlı önizleme.
// Kilitliler nasıl kazanılacağını yazar; gizliler kazanılana kadar ??? görünür.
function WardrobeSettings(): React.JSX.Element {
  const wardrobe = useWardrobe()

  // Dolaptan çıkınca "Yeni" rozetleri kalkar
  useEffect(() => () => markWardrobeSeen(), [])

  const unlockedCount = wardrobe.unlocked.length
  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex w-[170px] shrink-0 flex-col items-center gap-2">
        <Pet variant="robot" state="idle" size={110} label="Önizleme" />
        <span className="text-xs text-muted">
          {unlockedCount} / {ACCESSORIES.length} aksesuar · seri {wardrobe.counters.streak} gün
        </span>
      </div>
      <div className="min-w-[260px] flex-1 space-y-4">
        {SLOTS.map((slot) => (
          <div key={slot}>
            <div className="mb-2 text-xs font-medium text-muted">{SLOT_LABELS[slot]}</div>
            <div className="flex flex-wrap gap-2">
              {ACCESSORIES.filter((item) => item.slot === slot).map((item) => {
                const open = wardrobe.unlocked.includes(item.id)
                const worn = wardrobe.equipped[slot] === item.id
                const fresh = open && !wardrobe.seen.includes(item.id)
                const secret = item.hidden && !open
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!open}
                    onClick={() => toggleAccessory(item.id)}
                    aria-pressed={worn}
                    title={secret ? 'Gizli aksesuar: kazanınca ortaya çıkar' : item.how}
                    className={`relative flex min-w-[120px] flex-col items-start rounded-[12px] border px-3 py-2 text-left text-sm transition-colors ${
                      worn
                        ? 'border-accent bg-accent/15 text-ink'
                        : open
                          ? 'border-line text-ink hover:border-line-strong'
                          : 'border-line/60 text-faint'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      {!open && <Lock className="h-3.5 w-3.5" aria-hidden />}
                      {worn && <Check className="h-3.5 w-3.5 text-accent" aria-hidden />}
                      {secret ? '???' : item.name}
                    </span>
                    <span className="text-xs text-muted">
                      {secret ? 'Gizli aksesuar' : open ? (worn ? 'Takılı' : 'Tak') : item.how}
                    </span>
                    {fresh && (
                      <span className="absolute -top-2 -right-2 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-app">
                        Yeni
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default WardrobeSettings
