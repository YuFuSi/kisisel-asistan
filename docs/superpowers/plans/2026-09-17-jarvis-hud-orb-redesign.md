# Jarvis HUD/Orb Yeniden Tasarımı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jarvis küresini (`Orb.tsx`) düz gradyan disk yerine çok renkli, gerçek bir parçacık sistemine dönüştürmek ve Ana Sayfa'nın görsel dilini bu yeni sinematik HUD kimliğine taşımak.

**Architecture:** Mevcut canvas 2D + `requestAnimationFrame` yaklaşımı korunur (yeni kütüphane eklenmez). Küre, fibonacci-sphere dağılımlı bir nokta bulutu olarak çizilir; durum (`AssistantState`) değiştikçe noktalar küre↔halka arasında yumuşak morph yapar ve renk her zaman çalışan bir çok-renkli döngüden (taban katman) + duruma özgü bir sıcaklık eğiliminden (durum katmanı) oluşur. Dinleme/konuşma durumlarında noktalar gerçek ses seviyesine (mevcut `getAudioLevel`, artık banda bölünmüş `getAudioSpectrum`) tepki verir.

**Tech Stack:** React 19 + TypeScript, canvas 2D (native, kütüphanesiz), Vitest (saf mantık fonksiyonları için), mevcut `lib/audioLevel.ts` altyapısı.

**Spec:** `docs/superpowers/specs/2026-09-17-jarvis-hud-orb-redesign-design.md`

## Global Constraints

- Yeni render teknolojisi/kütüphanesi eklenmez; sadece mevcut canvas 2D yaklaşımı genişletilir.
- `prefers-reduced-motion` açıkken davranış korunmalı: hareket ve renk döngüsü büyük ölçüde durur, sadece durum değişimi yansır (mevcut `Orb.tsx`'teki `reduced` mantığı örnek alınır).
- Renkler için Tailwind'in `zinc-*`/`violet-*` gibi sabit sınıfları değil, tasarım belirteçleri (`--color-*`) kullanılır; küre içindeki HSL renkler CSS değişkeni değildir (canvas'ta hesaplanır), bu bir istisnadır ve mevcut `Orb.tsx`'teki `STATE_COLORS`/`themeColor` deseniyle tutarlı kalır.
- Değişen fonksiyonlarda ESLint kuralı gereği açık dönüş tipi yazılır (`function x(): void`).
- Bu tur sadece `Orb.tsx` ve `HomePage.tsx` kapsamında; sohbet ekranı, yan menü, diğer sayfalar dokunulmaz (speC'teki "Kapsam dışı" bölümü).
- Kod ve yorumlar Türkçe; değişken/fonksiyon adları İngilizce (mevcut kod stili).
- Prettier: tek tırnak, noktalı virgül yok, 100 satır genişliği (`npx prettier --write src` ile).

---

## Dosya Yapısı

- **Oluşturulacak:** `src/renderer/src/lib/orbColor.ts` — taban çok-renkli döngü + durum sıcaklık eğilimi hesaplayan saf fonksiyonlar.
- **Oluşturulacak:** `src/renderer/src/lib/orbColor.test.ts` — yukarıdakinin testleri.
- **Değiştirilecek:** `src/renderer/src/lib/audioLevel.ts` — banda bölünmüş spektrum desteği (`registerSpectrum`, `getAudioSpectrum`, `binSpectrum`).
- **Oluşturulacak:** `src/renderer/src/lib/audioLevel.test.ts` — `binSpectrum` saf fonksiyonunun testi.
- **Değiştirilecek:** `src/renderer/src/lib/recorder.ts` — mikrofon analyser'ını spektrum kaynağı olarak da kaydet.
- **Değiştirilecek:** `src/renderer/src/lib/voiceClient.ts` — giriş ve çıkış analyser'larını spektrum kaynağı olarak da kaydet.
- **Değiştirilecek:** `src/renderer/src/components/jarvis/Orb.tsx` — çekirdek render mantığı parçacık sistemine geçirilir.
- **Değiştirilecek:** `src/renderer/src/pages/HomePage.tsx` — küre büyütülür, durum etiketi ve çevresindeki metinler HUD diline (monospace, harf aralıklı) taşınır.

---

## Task 1: Taban çok-renkli döngü + durum sıcaklık eğilimi (`orbColor.ts`)

**Files:**
- Create: `src/renderer/src/lib/orbColor.ts`
- Test: `src/renderer/src/lib/orbColor.test.ts`

**Interfaces:**
- Produces: `baseHue(t: number): number` — 0-1 arası zaman değerini 0-360 derece hue'ya çevirir (mavi→mor→magenta→pembe→altın döngüsü).
- Produces: `STATE_HUE_BIAS: Record<AssistantState, number>` — durumun taban hue'ya eklediği derece kayması (idle: 0, listening: 10, thinking: -35, working: -35, speaking: 20).
- Produces: `orbHsl(t: number, state: AssistantState, saturation: number, lightness: number): string` — `hsl(...)` string'i üretir, `baseHue` + `STATE_HUE_BIAS[state]` toplanarak.
- Consumes: `AssistantState` tipi `../lib/assistantState`'ten.

- [ ] **Step 1: Write the failing test**

`src/renderer/src/lib/orbColor.test.ts` dosyasını oluştur:

```typescript
import { describe, expect, it } from 'vitest'
import { baseHue, orbHsl, STATE_HUE_BIAS } from './orbColor'

describe('baseHue', () => {
  it('döngü başında maviye yakın bir değer döner', () => {
    expect(baseHue(0)).toBeCloseTo(205, 0)
  })

  it('t=1 ile t=0 aynı noktaya döner (döngüsel)', () => {
    expect(baseHue(1)).toBeCloseTo(baseHue(0), 0)
  })

  it('ara bir noktada mor bandına düşer', () => {
    const hue = baseHue(0.2)
    expect(hue).toBeGreaterThan(205)
    expect(hue).toBeLessThan(300)
  })

  it('0-1 dışındaki değerleri de döngüsel olarak sarar', () => {
    expect(baseHue(1.2)).toBeCloseTo(baseHue(0.2), 0)
    expect(baseHue(-0.2)).toBeCloseTo(baseHue(0.8), 0)
  })
})

describe('orbHsl', () => {
  it('idle durumunda ek sapma olmadan hsl string üretir', () => {
    expect(orbHsl(0, 'idle', 90, 55)).toBe(`hsl(${baseHue(0)}, 90%, 55%)`)
  })

  it('thinking durumunda hue sıcak tarafa kayar', () => {
    const idleHue = Number(orbHsl(0, 'idle', 90, 55).match(/hsl\((.+?),/)![1])
    const thinkingHue = Number(orbHsl(0, 'thinking', 90, 55).match(/hsl\((.+?),/)![1])
    expect(thinkingHue).toBe(idleHue + STATE_HUE_BIAS.thinking)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- orbColor`
Expected: FAIL (`Cannot find module './orbColor'`)

- [ ] **Step 3: Write minimal implementation**

`src/renderer/src/lib/orbColor.ts` dosyasını oluştur:

```typescript
import type { AssistantState } from './assistantState'

// Taban renk döngüsü: mavi -> mor -> magenta -> pembe -> altın -> başa dön
const HUE_STOPS = [205, 255, 300, 335, 45, 205]

/** t: 0-1 arası (döngüsel) zaman değeri; 0-360 arası hue derecesi döner */
export function baseHue(t: number): number {
  const wrapped = ((t % 1) + 1) % 1
  const scaled = wrapped * (HUE_STOPS.length - 1)
  const index = Math.floor(scaled)
  const fraction = scaled - index
  return HUE_STOPS[index] + (HUE_STOPS[index + 1] - HUE_STOPS[index]) * fraction
}

// Her durumun taban döngüye eklediği sıcaklık kayması (derece)
export const STATE_HUE_BIAS: Record<AssistantState, number> = {
  idle: 0,
  listening: 10,
  thinking: -35,
  working: -35,
  speaking: 20
}

/** Belirli bir zaman ve duruma göre küre parçacığının rengi */
export function orbHsl(
  t: number,
  state: AssistantState,
  saturation: number,
  lightness: number
): string {
  const hue = Math.round((baseHue(t) + STATE_HUE_BIAS[state] + 360) % 360)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- orbColor`
Expected: PASS (6 test)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/orbColor.ts src/renderer/src/lib/orbColor.test.ts
git commit -m "Jarvis küresi için çok renkli döngü ve durum sıcaklık eğilimi ekle"
```

---

## Task 2: Bandlanmış ses spektrumu (`audioLevel.ts`)

**Files:**
- Modify: `src/renderer/src/lib/audioLevel.ts`
- Test: `src/renderer/src/lib/audioLevel.test.ts`

**Interfaces:**
- Produces: `binSpectrum(data: Uint8Array, bands: number): number[]` — 0-255 aralığındaki ham frekans verisini `bands` sayıda 0-1 aralığına ortalanmış dilime böler.
- Produces: `registerSpectrum(kind: LevelKind, source: () => number[]): () => void` — `registerLevel` ile aynı desende, kaynağı listeye ekler, kaldırma fonksiyonu döner.
- Produces: `getAudioSpectrum(kind: LevelKind, bands: number): number[]` — kayıtlı kaynak yoksa `bands` uzunlukta sıfır dizisi, varsa ilk kaynağın `binSpectrum` çıktısı.
- Produces: `analyserSpectrum(analyser: AnalyserNode, bands: number): number[]` — `analyser.getByteFrequencyData` okuyup `binSpectrum` uygular.
- Consumes: mevcut `LevelKind`, `sources` deseni (aynı dosyada).

- [ ] **Step 1: Write the failing test**

`src/renderer/src/lib/audioLevel.test.ts` dosyasını oluştur:

```typescript
import { describe, expect, it } from 'vitest'
import { binSpectrum } from './audioLevel'

describe('binSpectrum', () => {
  it('veriyi istenen bant sayısına böler', () => {
    const data = new Uint8Array(256).fill(0)
    const result = binSpectrum(data, 8)
    expect(result).toHaveLength(8)
  })

  it('sıfır veri için tüm bantlar 0 döner', () => {
    const data = new Uint8Array(256).fill(0)
    expect(binSpectrum(data, 4)).toEqual([0, 0, 0, 0])
  })

  it('255 dolu veri için tüm bantlar 1 döner', () => {
    const data = new Uint8Array(256).fill(255)
    expect(binSpectrum(data, 4)).toEqual([1, 1, 1, 1])
  })

  it('bir bandın ortalamasını doğru hesaplar', () => {
    const data = new Uint8Array(4)
    data[0] = 0
    data[1] = 255
    const result = binSpectrum(data, 1)
    expect(result[0]).toBeCloseTo((0 + 255 + 0 + 0) / 4 / 255, 2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- audioLevel`
Expected: FAIL (`binSpectrum is not exported`)

- [ ] **Step 3: Write minimal implementation**

`src/renderer/src/lib/audioLevel.ts` dosyasının sonuna ekle (mevcut içeriği koru, sadece ekleme yap):

```typescript
type SpectrumSource = () => number[]

const spectrumSources: Record<LevelKind, Set<SpectrumSource>> = {
  input: new Set(),
  output: new Set()
}

/** Spektrum kaynağı ekler; dönen fonksiyon kaynağı kaldırır */
export function registerSpectrum(kind: LevelKind, source: SpectrumSource): () => void {
  spectrumSources[kind].add(source)
  return () => {
    spectrumSources[kind].delete(source)
  }
}

/** Kayıtlı ilk kaynağın bantlanmış seviyeleri; kaynak yoksa sıfır dizisi */
export function getAudioSpectrum(kind: LevelKind, bands: number): number[] {
  for (const source of spectrumSources[kind]) return source()
  return new Array(bands).fill(0)
}

/** Ham 0-255 frekans verisini `bands` sayıda 0-1 aralığına ortalanmış dilime böler */
export function binSpectrum(data: Uint8Array, bands: number): number[] {
  const bandSize = Math.floor(data.length / bands)
  const result: number[] = []
  for (let b = 0; b < bands; b++) {
    let sum = 0
    for (let i = 0; i < bandSize; i++) sum += data[b * bandSize + i]
    result.push(sum / bandSize / 255)
  }
  return result
}

/** AnalyserNode'un anlık frekans verisini bantlanmış seviyelere çevirir */
export function analyserSpectrum(analyser: AnalyserNode, bands: number): number[] {
  const data = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(data)
  return binSpectrum(data, bands)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- audioLevel`
Expected: PASS (4 yeni test + mevcutlar)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/audioLevel.ts src/renderer/src/lib/audioLevel.test.ts
git commit -m "Ekolayzer için bantlanmış ses spektrumu desteği ekle"
```

---

## Task 3: Analyser'ları spektrum kaynağı olarak kaydet

**Files:**
- Modify: `src/renderer/src/lib/recorder.ts:60-72` (analyser oluşturma ve `registerLevel` çağrısı civarı — tam satır numarası dosyayı okurken doğrulanmalı)
- Modify: `src/renderer/src/lib/voiceClient.ts:88-160` (giriş analyser'ı `~L91-104`, çıkış analyser'ı `outputNodes()` `~L150-160`)

**Interfaces:**
- Consumes: Task 2'nin `registerSpectrum`, `analyserSpectrum` fonksiyonları.
- Produces: yok (bu görev sadece mevcut analyser'ları yeni kaynağa da bağlar, dışa açık yeni bir arayüz eklemez).

Bu görev canlı ses donanımı gerektirdiğinden birim testi yazılmaz; Task 6'daki CDP doğrulamasında dolaylı olarak test edilir (mevcut projede tüm zamanlayıcı/ses kodu için izlenen desen — bkz. proje notları "mevcut 4 zamanlayıcının hiçbirinin birim testi yok").

- [ ] **Step 1: `recorder.ts`'e spektrum kaydı ekle**

`src/renderer/src/lib/recorder.ts` dosyasını aç, `analyserLevel, registerLevel` import satırını bul ve `analyserSpectrum, registerSpectrum` ekle:

```typescript
import { analyserLevel, analyserSpectrum, registerLevel, registerSpectrum } from './audioLevel'
```

`const unregisterLevel = registerLevel('input', () => analyserLevel(analyser))` satırının hemen altına ekle:

```typescript
  const unregisterSpectrum = registerSpectrum('input', () => analyserSpectrum(analyser, 40))
```

Fonksiyonun temizlik (cleanup) kısmında `unregisterLevel()` çağrısının yanına ekle:

```typescript
    unregisterSpectrum()
```

- [ ] **Step 2: `voiceClient.ts`'e giriş spektrumu kaydı ekle**

`analyserLevel, registerLevel` import satırına `analyserSpectrum, registerSpectrum` ekle. Giriş analyser'ının oluşturulduğu yerde (`registerLevel('input', ...)` çağrısının bulunduğu satır) yanına ekle:

```typescript
        unregisterInputSpectrum: registerSpectrum('input', () => analyserSpectrum(analyser, 40)),
```

Bunun için `unregisterLevel` alanının bulunduğu obje/arayüze `unregisterInputSpectrum` alanını da ekle ve temizlik fonksiyonunda (`current.unregisterLevel()` çağrılan yerde) `current.unregisterInputSpectrum()` çağrısını da ekle.

- [ ] **Step 3: `voiceClient.ts`'in `outputNodes()` fonksiyonuna çıkış spektrumu kaydı ekle**

`outputNodes()` içindeki `registerLevel('output', () => analyserLevel(analyser))` satırının yanına ekle:

```typescript
    registerSpectrum('output', () => analyserSpectrum(analyser, 40))
```

(Çıkış analyser'ı uygulama ömrü boyunca tek seferlik oluşturulduğu için ayrı bir temizlik gerekmez — mevcut `registerLevel('output', ...)` çağrısıyla aynı ömür.)

- [ ] **Step 4: Derleme kontrolü**

Run: `npm run typecheck`
Expected: Hatasız

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/recorder.ts src/renderer/src/lib/voiceClient.ts
git commit -m "Mikrofon ve TTS analyser'larını ekolayzer spektrumuna bağla"
```

---

## Task 4: `Orb.tsx` çekirdek render mantığını parçacık sistemine geçir

**Files:**
- Modify: `src/renderer/src/components/jarvis/Orb.tsx` (tamamı yeniden yazılır; `OrbProps`, dosyanın dışa açtığı `Orb` bileşeni imzası değişmez)

**Interfaces:**
- Consumes: Task 1'in `orbHsl` fonksiyonu, Task 2'nin `getAudioSpectrum` fonksiyonu, mevcut `getAudioLevel`, `AssistantState`, `STATE_LABELS`.
- Produces: `Orb` bileşeni aynı imzayla kalır: `function Orb({ state, size = 240 }: OrbProps): React.JSX.Element` — `HomePage.tsx` (Task 5) bunu değiştirmeden kullanmaya devam eder.

Bu görev canvas render koduna odaklandığından ve saf/deterministik olmadığından (RAF, Math.random tabanlı parçacık dağılımı, gerçek zaman) birim testi pratik değildir — mevcut `Orb.tsx`'in de testi yoktur. Doğrulama Task 6'daki CDP adımlarıyla yapılır.

- [ ] **Step 1: `Orb.tsx`'i tamamen aşağıdaki içerikle değiştir**

```typescript
import { useEffect, useRef } from 'react'
import { STATE_LABELS, type AssistantState } from '../../lib/assistantState'
import { getAudioLevel, getAudioSpectrum } from '../../lib/audioLevel'
import { orbHsl } from '../../lib/orbColor'

interface OrbProps {
  state: AssistantState
  /** Kürenin yaklaşık çapı (px) */
  size?: number
}

// idle: dönmez, sadece nefes alır. Diğerleri halkaya açılır ve döner.
const RING_STATES = new Set<AssistantState>(['listening', 'thinking', 'working', 'speaking'])
const PARTICLE_COUNT = 900
const BAND_COUNT = 40
const HUE_CYCLE_SECONDS = 40

interface Particle {
  /** Küre üzerindeki hedef konum (birim küre) */
  sx: number
  sy: number
  sz: number
  /** Halka üzerindeki hedef konum (aynı parçacık, farklı form) */
  rx: number
  ry: number
  rz: number
  seed: number
  phase: number
  band: number
}

function buildParticles(): Particle[] {
  const particles: Particle[] = []
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const y = 1 - (i / (PARTICLE_COUNT - 1)) * 2
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = goldenAngle * i
    const sx = Math.cos(theta) * radiusAtY
    const sz = Math.sin(theta) * radiusAtY

    const ringAngle = ((i / PARTICLE_COUNT) * Math.PI * 2 * 7) % (Math.PI * 2)
    const ringRadius = 0.72 + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.3 - 0.15
    const rx = Math.cos(ringAngle) * ringRadius
    const ry = Math.sin(ringAngle) * ringRadius * 0.96
    const rz = Math.sin(i * 78.233) * 0.5 * 0.15

    particles.push({
      sx,
      sy: y,
      sz,
      rx,
      ry,
      rz,
      seed: Math.random(),
      phase: Math.random() * Math.PI * 2,
      band: i % BAND_COUNT
    })
  }
  return particles
}

// Jarvis küresi: durumuna göre küre <-> halka arası morph yapan, çok renkli parçacık bulutu (canvas ile çizilir)
function Orb({ state, size = 240 }: OrbProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const width = size
    const height = size
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const particles = buildParticles()
    const radius = size * 0.38

    let morph = 0
    let hueTime = 0
    let last = performance.now()
    let frame = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const draw = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const currentState = stateRef.current
      const morphTarget = RING_STATES.has(currentState) ? 1 : 0
      morph += (morphTarget - morph) * (reduced ? 1 : Math.min(dt * 2.5, 1))
      hueTime = reduced ? hueTime : hueTime + dt / HUE_CYCLE_SECONDS

      const t = reduced ? 0 : now / 1000
      const breathe = reduced ? 1 : 1 + Math.sin(t * (Math.PI * 2) / 4) * 0.03

      const spectrum =
        currentState === 'listening'
          ? getAudioSpectrum('input', BAND_COUNT)
          : currentState === 'speaking'
            ? getAudioSpectrum('output', BAND_COUNT)
            : null
      const overallLevel =
        currentState === 'listening'
          ? getAudioLevel('input')
          : currentState === 'speaking'
            ? getAudioLevel('output')
            : 0

      const cx = width / 2
      const cy = height / 2
      const cosR = Math.cos(t * 0.15)
      const sinR = Math.sin(t * 0.15)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      // Dış ışıma
      const glowColor = orbHsl(hueTime, currentState, 85, 60)
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius * 1.6)
      glow.addColorStop(0, glowColor.replace('hsl', 'hsla').replace(')', ', 0.28)'))
      glow.addColorStop(1, glowColor.replace('hsl', 'hsla').replace(')', ', 0)'))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, radius * 1.6, 0, Math.PI * 2)
      ctx.fill()

      ctx.globalCompositeOperation = 'lighter'

      const projected = particles.map((p) => {
        let x = p.sx + (p.rx - p.sx) * morph
        let y = p.sy + (p.ry - p.sy) * morph
        let z = p.sz + (p.rz - p.sz) * morph

        if (morph > 0.05) {
          if (spectrum) {
            // Dinliyor/konuşuyor: her parçacık kendi frekans bandının seviyesine göre dışa/içe hareket eder
            const bandLevel = spectrum[p.band]
            const push = 1 + bandLevel * 0.6
            x *= push
            y *= push
          } else {
            // Düşünüyor/çalışıyor: spiral akış + hafif rastgele sapma (hibrit)
            const spiralT = ((p.seed * 6 + t * 0.6) % 1) * morph
            const jitter = Math.sin(t * 5 + p.phase) * 0.04 * morph
            x = x * (1 - spiralT * 0.3) + jitter
            y = y * (1 - spiralT * 0.3) + jitter
          }
        }

        x *= breathe
        y *= breathe
        z *= breathe

        const rx2 = x * cosR - z * sinR
        const rz2 = x * sinR + z * cosR
        const scale = 1 / (2.1 - rz2 * 0.6)
        const wave = Math.sin(x * 3 + t * 1.4) * Math.cos(y * 2.5 - t) * 0.5 + 0.5
        return {
          x: cx + rx2 * radius * scale,
          y: cy + y * radius * scale,
          z: rz2,
          wave,
          seed: p.seed
        }
      })
      projected.sort((a, b) => a.z - b.z)

      for (const p of projected) {
        const depth = (p.z + 1) / 2
        const bright = 0.2 + depth * 0.5 + p.wave * 0.3 + overallLevel * 0.3
        const pSize = 0.6 + depth * 1.3 + p.wave * 0.6 + overallLevel * 1
        const color = orbHsl(hueTime + p.seed * 0.15, currentState, 90, 55 + p.wave * 15)
        ctx.globalAlpha = Math.min(1, bright)
        ctx.fillStyle = color
        ctx.shadowColor = color
        ctx.shadowBlur = 2 + p.wave * 3
        ctx.beginPath()
        ctx.arc(p.x, p.y, pSize, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
      ctx.globalCompositeOperation = 'source-over'

      if (reduced) timer = setTimeout(() => (frame = requestAnimationFrame(draw)), 500)
      else frame = requestAnimationFrame(draw)
    }

    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Jarvis: ${STATE_LABELS[state]}`}
      style={{ width: size, height: size, maxWidth: '100%' }}
    />
  )
}

export default Orb
```

- [ ] **Step 2: Derleme ve lint kontrolü**

Run: `npm run typecheck && npm run lint`
Expected: Hatasız

- [ ] **Step 3: Testleri çalıştır (regresyon)**

Run: `npm run test`
Expected: Tüm testler PASS (Task 1-2'deki yenilerle birlikte)

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/jarvis/Orb.tsx
git commit -m "Jarvis küresini çok renkli parçacık sistemine geçir"
```

---

## Task 5: `HomePage.tsx`'i HUD diline taşı

**Files:**
- Modify: `src/renderer/src/pages/HomePage.tsx:60-77` (küre boyutu ve durum etiketi civarı)

**Interfaces:**
- Consumes: Task 4'ün değişmeyen `Orb` bileşeni imzası (`size` prop'u büyütülerek kullanılır).
- Produces: yok (sadece görsel/stil değişikliği; mevcut prop arayüzü `HomePageProps` değişmez).

Bu görev sadece stil/boyut değişikliği olduğundan birim testi yoktur; Task 6'da ekran görüntüsüyle doğrulanır. Mevcut işlevsel bileşenler (`CommandBox`, `QuickAccess`, `ActivityList`, `SystemStatusCard`, `QuoteCard`) olduğu gibi kalır — spec'in "kapsam dışı" notuna uygun olarak bu turda kutu-kart yapıları sökülmez, sadece küre ve durum etiketinin görsel ağırlığı artırılır.

- [ ] **Step 1: Küre boyutunu büyüt ve durum etiketini HUD stiline çevir**

`src/renderer/src/pages/HomePage.tsx` içinde:

```typescript
            <Orb state={state} size={220} />
```

satırını şu şekilde değiştir:

```typescript
            <Orb state={state} size={320} />
```

Ardından durum etiketini gösteren blok:

```typescript
          <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs text-muted">
            <StatusDot level={busy ? 'active' : 'ok'} pulse={busy} className="h-1.5 w-1.5" />
            {STATE_LABELS[state]}
          </span>
```

şu şekilde değiştir (monospace, harf aralıklı, büyük harf — HUD veri etiketi hissi):

```typescript
          <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-surface/60 px-3 py-1 font-mono text-[11px] tracking-[0.15em] text-accent uppercase">
            <StatusDot level={busy ? 'active' : 'ok'} pulse={busy} className="h-1.5 w-1.5" />
            {STATE_LABELS[state]}
          </span>
```

- [ ] **Step 2: Derleme kontrolü**

Run: `npm run typecheck && npx electron-vite build`
Expected: Hatasız

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/pages/HomePage.tsx
git commit -m "Ana Sayfa'da küreyi büyüt ve durum etiketini HUD stiline çevir"
```

---

## Task 6: Uygulamada uçtan uca doğrulama

**Files:** Yok (sadece manuel/CDP doğrulama, kod değişikliği yok)

- [ ] **Step 1: Geliştirme sunucusunu başlat ve Ana Sayfa'yı aç**

Mevcut `.claude/launch.json` dev sunucusunu başlat (proje CLAUDE.md'sindeki E2E yöntemiyle), Ana Sayfa'ya git.

- [ ] **Step 2: `idle` durumunu doğrula**

Ekran görüntüsü al. Beklenen: küre dolgun/hacimli parçacık kümesi gibi görünüyor, **dönmüyor**, sadece hafifçe büyüyüp küçülüyor (nefes alma), renk yavaşça mavi-mor arasında akıyor.

- [ ] **Step 3: `listening` durumunu tetikle ve doğrula**

`window.api` üzerinden veya gerçek mikrofonla sesli oturumu başlat (CLAUDE.md'deki "Sesli sohbeti mikrofonsuz test etme" yöntemiyle Piper sesi beslenebilir ya da sadece `voice:event` ile `phase: 'capturing'` tetiklenebilir). Ekran görüntüsü al. Beklenen: küre halkaya açılıyor, ses geldikçe bantlar farklı seviyelerde içe/dışa hareket ediyor (ekolayzer hissi).

- [ ] **Step 4: `thinking`/`working` durumunu tetikle ve doğrula**

Sohbette bir mesaj gönderip cevap beklerken ekran görüntüsü al. Beklenen: halka biçiminde, spiral+hafif titreşim hareketi, renk sıcak tona kaymış.

- [ ] **Step 5: `speaking` durumunu doğrula**

Sesli cevap oynatılırken ekran görüntüsü al. Beklenen: halka TTS ses seviyesine göre nabız atıyor.

- [ ] **Step 6: `prefers-reduced-motion` ile doğrula**

`resize_window` veya CDP ile `prefers-reduced-motion: reduce` emüle et, sayfayı yenile. Beklenen: parçacıklar yavaş/durgun güncelleniyor (500ms'de bir), sürekli akıcı animasyon yok.

- [ ] **Step 7: Test verilerini temizle, ekran görüntülerini sil**

Oluşturulan geçici sohbet/mesajları sil (proje kuralı).

- [ ] **Step 8: Son commit ve plan dosyasını işaretle**

```bash
git add -A
git commit -m "Jarvis HUD/Orb yeniden tasarımı: uçtan uca doğrulama notları"
```
