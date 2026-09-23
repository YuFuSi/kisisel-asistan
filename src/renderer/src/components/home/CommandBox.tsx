import { useRef, useState } from 'react'
import {
  BellPlus,
  FolderSearch,
  ListPlus,
  Mic,
  SendHorizontal,
  Sparkles,
  Sun,
  type LucideIcon
} from 'lucide-react'
import Button from '../ui/Button'
import { useDictation } from '../../lib/useDictation'

export const HOME_COMMAND_ID = 'home-command'

interface Starter {
  label: string
  icon: LucideIcon
  text: string
  /** true ise metin doğrudan gönderilir, değilse kutuya yazılıp tamamlanması beklenir */
  send?: boolean
}

const STARTERS: Starter[] = [
  { label: 'Görev oluştur', icon: ListPlus, text: 'Listeme görev ekle: ' },
  { label: 'Hatırlatma kur', icon: BellPlus, text: 'Bana hatırlat: ' },
  { label: 'Günümü özetle', icon: Sun, text: 'Günlük özetimi hazırla.', send: true },
  { label: 'Dosya bul', icon: FolderSearch, text: 'Bilgisayarımda şu dosyayı bul: ' }
]

interface CommandBoxProps {
  /** Yazılan istek; yeni sohbette cevaplanır */
  onSubmit: (text: string) => void
  /** Kullanıcı kutuya yazarken çağrılır; küre buna tepki verir */
  onTyping?: () => void
}

// Ana Sayfa'daki büyük komut kutusu: yaz, konuş veya hazır bir başlangıç seç
function CommandBox({ onSubmit, onTyping }: CommandBoxProps): React.JSX.Element {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dictation = useDictation((spoken) => {
    setText((previous) => (previous ? `${previous} ${spoken}` : spoken))
    inputRef.current?.focus()
  })

  function submit(value = text): void {
    const content = value.trim()
    if (!content) return
    onSubmit(content)
    setText('')
  }

  function applyStarter(starter: Starter): void {
    if (starter.send) {
      submit(starter.text)
      return
    }
    setText(starter.text)
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    })
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="flex h-14 items-center gap-3 rounded-full border border-line-strong bg-surface pr-2 pl-5 transition-colors focus-within:border-accent/70">
        <Sparkles className="h-4 w-4 shrink-0 text-accent" />
        <input
          id={HOME_COMMAND_ID}
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            onTyping?.()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Bir soru sor, görev ekle veya bir şey söyle..."
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] text-ink outline-none placeholder:text-faint"
        />
        {text.trim() && (
          <Button
            variant="ghost"
            size="sm"
            icon={SendHorizontal}
            onClick={() => submit()}
            aria-label="Gönder"
            title="Gönder"
            className="!p-2 text-muted hover:bg-transparent hover:text-ink"
          />
        )}
        <Button
          variant={dictation.recording ? 'danger' : 'primary'}
          icon={Mic}
          loading={dictation.transcribing}
          onClick={() => void dictation.toggle()}
          disabled={dictation.transcribing}
          aria-label={dictation.recording ? 'Kaydı bitir' : 'Sesle söyle'}
          title={dictation.recording ? 'Kaydı bitir ve yazıya çevir' : 'Sesle söyle'}
          className={`h-10 w-10 !rounded-full !p-0 ${dictation.recording ? 'animate-pulse' : ''}`}
        />
      </div>

      {(dictation.recording || dictation.transcribing || dictation.error) && (
        <p className="mt-2 text-center text-xs">
          {dictation.recording && (
            <span className="text-accent">Dinliyorum... Bitirmek için mikrofona tekrar bas.</span>
          )}
          {dictation.transcribing && <span className="text-muted">Yazıya çevriliyor...</span>}
          {dictation.error && <span className="text-negative select-text">{dictation.error}</span>}
        </p>
      )}

      <div className="mt-3 flex flex-wrap justify-center gap-x-1 gap-y-1">
        {STARTERS.map(({ label, icon: Icon, ...starter }) => (
          <button
            key={label}
            onClick={() => applyStarter({ label, icon: Icon, ...starter })}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default CommandBox
