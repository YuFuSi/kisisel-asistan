import { useEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue } from 'motion/react'
import Pet from './components/jarvis/Pet'
import { useAssistantEmotion } from './lib/assistantState'
import { useOrbPrefs } from './lib/orbPrefs'
import type { PetMood } from './lib/petLook'
import { useRemoteAssistant } from './lib/remoteAssistant'

// Masaüstü pet (#pet): görev çubuğunun üstündeki saydam şeritte dolaşan Jarvis robotu.
// Boştayken rastgele bir yere yürür, bazen fareyi kovalar, durup kendi hareketlerini yapar.
// Tıklanınca Jarvis açılır. Fare robotun üstüne gelince pencere tıklamaları almaya başlar.

const SIZE = 110
// Robotun kutusu: eller, anten ve efektler için pay bırakılır
const BOX = SIZE * 1.8
const SPEED = 90 // px/sn

function DesktopPetApp(): React.JSX.Element {
  const { state } = useRemoteAssistant()
  const emotion = useAssistantEmotion()
  const { character } = useOrbPrefs()
  const variant = character === 'cube' ? 'cube' : 'robot'

  const x = useMotionValue(Math.max(0, window.innerWidth - BOX - 40))
  const [walking, setWalking] = useState<0 | 1 | -1>(0)
  const [mood, setMood] = useState<PetMood>('idle')
  const pointerX = useRef<number | null>(null)
  const hovering = useRef(false)
  const pressed = useRef(false)

  // Fare şeritteyken yerini hatırla (kovalamak için)
  useEffect(() => {
    const onMove = (event: PointerEvent): void => {
      pointerX.current = event.clientX
    }
    const onLeave = (): void => {
      pointerX.current = null
    }
    window.addEventListener('pointermove', onMove)
    document.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  // Dolaşma: sadece boştayken (uyurken, çalışırken, sürüklenirken durur)
  const free = state === 'idle' && mood === 'idle'
  useEffect(() => {
    if (!free) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    let walk: ReturnType<typeof animate> | undefined
    const next = (): void => {
      timer = setTimeout(
        () => {
          if (stopped) return
          const max = window.innerWidth - BOX
          const roll = Math.random()
          let target: number | null = null
          // Fare yakındaysa bazen kovalar
          if (pointerX.current !== null && roll < 0.35) target = pointerX.current - BOX / 2
          else if (roll < 0.8) target = Math.random() * max
          if (target === null || hovering.current) {
            next()
            return
          }
          target = Math.min(max, Math.max(0, target))
          const distance = Math.abs(target - x.get())
          if (distance < 30) {
            next()
            return
          }
          setWalking(target > x.get() ? 1 : -1)
          walk = animate(x, target, { duration: distance / SPEED, ease: 'linear' })
          walk.then(() => {
            if (stopped) return
            setWalking(0)
            next()
          })
        },
        2500 + Math.random() * 5000
      )
    }
    next()
    return () => {
      stopped = true
      clearTimeout(timer)
      walk?.stop()
      setTimeout(() => setWalking(0), 0)
    }
  }, [free, x])

  // Fare robotun üstündeyken pencere tıklamaları alır; sürüklerken bırakana kadar alır
  const setInteractive = (value: boolean): void => window.api.pet.setInteractive(value)
  useEffect(() => {
    const onUp = (): void => {
      pressed.current = false
      if (!hovering.current) setInteractive(false)
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <motion.div
        className="pointer-events-auto absolute bottom-0 flex items-end justify-center"
        style={{ x, width: BOX, height: BOX + 30 }}
        onPointerEnter={() => {
          hovering.current = true
          setInteractive(true)
        }}
        onPointerLeave={() => {
          hovering.current = false
          if (!pressed.current) setInteractive(false)
        }}
        onPointerDown={() => {
          pressed.current = true
        }}
      >
        {/* Yürürken adım adım sallanır ve gittiği yöne eğilir */}
        <motion.div
          animate={
            walking
              ? {
                  y: [0, -7, 0],
                  rotate: [walking * 4, walking * 8, walking * 4],
                  transition: { duration: 0.36, repeat: Infinity }
                }
              : { y: 0, rotate: 0 }
          }
        >
          <Pet
            variant={variant}
            state={state}
            emotion={emotion}
            size={SIZE}
            onMoodChange={setMood}
            onClick={() => void window.api.notch.navigate('home')}
            label="Jarvis’i aç"
          />
        </motion.div>
      </motion.div>
    </div>
  )
}

export default DesktopPetApp
