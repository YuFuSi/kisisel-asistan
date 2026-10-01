import { useRef, useState } from 'react'
import {
  BellPlus,
  FolderSearch,
  ListPlus,
  Mic,
  SendHorizontal,
  Sun,
  type LucideIcon
} from 'lucide-react'
import { motion } from 'motion/react'
import Button from '../ui/Button'
import IconTile, { TONES, type IconTone } from '../ui/IconTile'
import { useDictation } from '../../lib/useDictation'

export const HOME_COMMAND_ID = 'home-command'

interface Starter {
  label: string
  icon: LucideIcon
  text: string
  /** true ise metin doğrudan gönderilir, değilse kutuya yazılıp tamamlanması beklenir */
  send?: boolean
  tone: IconTone
}

const STARTERS: Starter[] = [
  { label: 'Görev oluştur', icon: ListPlus, text: 'Listeme görev ekle: ', tone: 'lilac' },
  { label: 'Hatırlatma kur', icon: BellPlus, text: 'Bana hatırlat: ', tone: 'pink' },
  { label: 'Günümü özetle', icon: Sun, text: 'Günlük özetimi hazırla.', send: true, tone: 'amber' },
  { label: 'Dosya bul', icon: FolderSearch, text: 'Bilgisayarımda şu dosyayı bul: ', tone: 'blue' }
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
  const [focused, setFocused] = useState(false)
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
      {/* Cam komut kutusu: odaklanınca lila ışıkla yumuşakça parlar */}
      <motion.div
        className="glass flex h-16 items-center gap-3 !rounded-[26px] pr-2.5 pl-6"
        animate={{
          boxShadow: focused
            ? 'inset 0 1px 0 rgb(255 255 255 / 0.1), 0 0 0 1px rgb(139 155 255 / 0.45), 0 18px 60px -12px rgb(139 155 255 / 0.35)'
            : 'inset 0 1px 0 rgb(255 255 255 / 0.08), 0 0 0 1px rgb(139 155 255 / 0), 0 24px 48px -24px rgb(0 0 0 / 0.7)'
        }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <input
          aria-label="Jarvis’e komut ver"
          id={HOME_COMMAND_ID}
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            onTyping?.()
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Bir soru sor, görev ekle veya bir şey söyle..."
          className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-ink outline-none placeholder:text-faint"
        />
        <Button
          variant={dictation.recording ? 'danger' : 'ghost'}
          icon={Mic}
          loading={dictation.transcribing}
          onClick={() => void dictation.toggle()}
          disabled={dictation.transcribing}
          aria-label={dictation.recording ? 'Kaydı bitir' : 'Sesle söyle'}
          title={dictation.recording ? 'Kaydı bitir ve yazıya çevir' : 'Sesle söyle'}
          className={`h-10 w-10 !rounded-full !p-0 ${dictation.recording ? 'animate-pulse' : ''}`}
        />
        {/* Gönder: lila degrade, yazı varken tam parlak */}
        <motion.button
          type="button"
          onClick={() => submit()}
          aria-label="Gönder"
          title="Gönder"
          disabled={!text.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white disabled:cursor-default"
          style={{
            background: 'linear-gradient(140deg, #a3b0ff, #7b85f2)',
            boxShadow:
              'inset 0 1px 1px rgb(255 255 255 / 0.45), 0 6px 18px -4px rgb(139 155 255 / 0.6)'
          }}
          animate={{ opacity: text.trim() ? 1 : 0.45, scale: text.trim() ? 1 : 0.92 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 26 }}
        >
          <SendHorizontal className="h-[18px] w-[18px]" />
        </motion.button>
      </motion.div>

      {(dictation.recording || dictation.transcribing || dictation.error) && (
        <p className="mt-2 text-center text-xs">
          {dictation.recording && (
            <span className="text-accent">Dinliyorum... Bitirmek için mikrofona tekrar bas.</span>
          )}
          {dictation.transcribing && <span className="text-muted">Yazıya çevriliyor...</span>}
          {dictation.error && <span className="text-negative select-text">{dictation.error}</span>}
        </p>
      )}

      {/* Başlangıç önerileri: renkli ikonlu cam haplar; üstüne gelince hafifçe yükselir */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {STARTERS.map((starter, index) => (
          <motion.button
            key={starter.label}
            onClick={() => applyStarter(starter)}
            className="flex min-h-10 items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5 text-sm text-ink/80 hover:text-ink"
            // Hap, ikonunun renginde çok hafif tonlu cam: ikon ile kutu aynı aileden
            style={{
              background: `linear-gradient(180deg, hsl(${TONES[starter.tone]} 90% 70% / 0.12), hsl(${TONES[starter.tone]} 80% 60% / 0.05))`,
              boxShadow: `inset 0 1px 0 hsl(${TONES[starter.tone]} 90% 80% / 0.16), inset 0 0 0 1px hsl(${TONES[starter.tone]} 80% 70% / 0.14)`
            }}
            initial={{ opacity: 0, y: 8 }}
            // Giriş sırayla gecikmeli; üstüne gelme ve basma gecikmesiz
            animate={{
              opacity: 1,
              y: 0,
              transition: {
                type: 'spring',
                stiffness: 260,
                damping: 24,
                delay: 0.35 + index * 0.06
              }
            }}
            whileHover={{ y: -3, scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            <IconTile icon={starter.icon} tone={starter.tone} size={26} />
            {starter.label}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

export default CommandBox
