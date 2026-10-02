import { Coffee, Heart, Moon, Star } from 'lucide-react'
import type { AccessoryId } from '../../lib/wardrobe'

// Kıyafet dolabındaki aksesuarların çizimleri (#125). Ölçüler robotun genişliğine (size) ve gövde
// yüksekliğine (height) göre; böylece Ana Sayfa'daki büyük robotta, masaüstünde ve çentikte aynı durur.
// Yuvalar: baş, göz ve gövde gövdeye; anten aksesuarı antenin içine (anten sallanınca o da sallanır);
// el aksesuarı sağ elin içine çizilir.

const glow = (color: string): string => `drop-shadow(0 0 6px ${color})`

interface BodyProps {
  ids: AccessoryId[]
  size: number
  height: number
}

/** Gövdeye takılanlar: baş, göz (ekranın üstünde) ve gövde */
export function BodyAccessories({ ids, size: s, height: h }: BodyProps): React.JSX.Element {
  // Gözlerin merkezi (ekranın ortası, iki göz ±0.115s)
  const eyeY = h * 0.5
  const eyeX = [s * 0.5 - s * 0.115, s * 0.5 + s * 0.115]
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {ids.includes('headphones') && (
        <>
          <span
            className="absolute block"
            style={{
              left: s * 0.04,
              top: -s * 0.07,
              width: s * 0.92,
              height: h * 0.55,
              borderTop: `${s * 0.04}px solid #3a3e52`,
              borderLeft: `${s * 0.04}px solid #3a3e52`,
              borderRight: `${s * 0.04}px solid #3a3e52`,
              borderRadius: `${s * 0.46}px ${s * 0.46}px 0 0`
            }}
          />
          {[-1, 1].map((side) => (
            <span
              key={side}
              className="absolute block"
              style={{
                top: h * 0.3,
                [side < 0 ? 'left' : 'right']: -s * 0.05,
                width: s * 0.13,
                height: h * 0.32,
                borderRadius: s * 0.06,
                background: 'linear-gradient(160deg, #a3b0ff, #5b63d6)',
                boxShadow: '0 0 12px rgb(139 155 255 / 0.5)'
              }}
            />
          ))}
        </>
      )}

      {(ids.includes('beanie') || ids.includes('winterHat')) && (
        <span
          className="absolute block"
          style={{
            left: s * 0.1,
            top: -s * 0.17,
            width: s * 0.8,
            height: s * 0.32,
            borderRadius: `${s * 0.4}px ${s * 0.4}px ${s * 0.06}px ${s * 0.06}px`,
            background: ids.includes('winterHat')
              ? 'repeating-linear-gradient(90deg, #e05a5a 0 8%, #c94848 8% 16%)'
              : 'linear-gradient(160deg, #f4a1a1, #d86a7d)',
            boxShadow: 'inset 0 -6px 0 rgb(255 255 255 / 0.85)'
          }}
        >
          {ids.includes('winterHat') && (
            <span
              className="absolute left-1/2 block rounded-full bg-white"
              style={{
                width: s * 0.14,
                height: s * 0.14,
                top: -s * 0.08,
                marginLeft: -s * 0.07
              }}
            />
          )}
        </span>
      )}

      {ids.includes('partyHat') && (
        <span
          className="absolute block"
          style={{
            left: s * 0.1,
            top: -s * 0.34,
            width: s * 0.3,
            height: s * 0.38,
            rotate: '-18deg',
            clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
            background: 'repeating-linear-gradient(135deg, #ff9ec7 0 12%, #ffe08a 12% 24%)'
          }}
        />
      )}

      {ids.includes('crown') && (
        <span
          className="absolute block"
          style={{
            left: s * 0.32,
            top: -s * 0.15,
            width: s * 0.36,
            height: s * 0.17,
            clipPath: 'polygon(0 100%, 0 25%, 22% 60%, 50% 0, 78% 60%, 100% 25%, 100% 100%)',
            background: 'linear-gradient(180deg, #ffe08a, #e9a93a)',
            filter: glow('rgb(255 210 120 / 0.8)')
          }}
        />
      )}

      {ids.includes('focusGlasses') &&
        eyeX.map((x, i) => (
          <span
            key={i}
            className="absolute block"
            style={{
              left: x - s * 0.095,
              top: eyeY - s * 0.08,
              width: s * 0.19,
              height: s * 0.16,
              borderRadius: s * 0.04,
              border: `${s * 0.022}px solid rgb(255 255 255 / 0.85)`
            }}
          />
        ))}
      {ids.includes('roundGlasses') &&
        eyeX.map((x, i) => (
          <span
            key={i}
            className="absolute block rounded-full"
            style={{
              left: x - s * 0.105,
              top: eyeY - s * 0.105,
              width: s * 0.21,
              height: s * 0.21,
              border: `${s * 0.02}px solid #e9c46a`
            }}
          />
        ))}
      {(ids.includes('focusGlasses') || ids.includes('roundGlasses')) && (
        <span
          className="absolute block"
          style={{
            left: s * 0.5 - s * 0.025,
            top: eyeY - s * 0.01,
            width: s * 0.05,
            height: s * 0.02,
            background: ids.includes('roundGlasses') ? '#e9c46a' : 'rgb(255 255 255 / 0.85)'
          }}
        />
      )}
      {ids.includes('monocle') && (
        <>
          <span
            className="absolute block rounded-full"
            style={{
              left: eyeX[1] - s * 0.11,
              top: eyeY - s * 0.11,
              width: s * 0.22,
              height: s * 0.22,
              border: `${s * 0.022}px solid #e9c46a`,
              boxShadow: 'inset 0 0 10px rgb(255 255 255 / 0.25)'
            }}
          />
          <span
            className="absolute block"
            style={{
              left: eyeX[1] + s * 0.08,
              top: eyeY + s * 0.08,
              width: s * 0.01,
              height: h * 0.3,
              background: '#e9c46a',
              rotate: '-20deg',
              transformOrigin: 'top'
            }}
          />
        </>
      )}

      {ids.includes('bowtie') && (
        <svg
          className="absolute"
          viewBox="0 0 40 20"
          style={{
            left: s * 0.5 - s * 0.14,
            top: h * 0.82,
            width: s * 0.28,
            height: s * 0.14,
            filter: glow('rgb(139 155 255 / 0.7)')
          }}
        >
          <defs>
            <linearGradient id="bowtie" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#c9d0ff" />
              <stop offset="1" stopColor="#7a86f0" />
            </linearGradient>
          </defs>
          <path d="M20 10 L2 1 L2 19 Z M20 10 L38 1 L38 19 Z" fill="url(#bowtie)" />
          <rect x="16" y="6" width="8" height="8" rx="2" fill="#e6e9ff" />
        </svg>
      )}
      {ids.includes('tie') && (
        <svg
          className="absolute"
          viewBox="0 0 20 50"
          style={{
            left: s * 0.5 - s * 0.06,
            top: h * 0.8,
            width: s * 0.12,
            height: s * 0.3,
            filter: glow('rgb(139 155 255 / 0.6)')
          }}
        >
          <path d="M6 0 H14 L12 8 L18 40 L10 50 L2 40 L8 8 Z" fill="#8b9bff" />
          <path d="M6 0 H14 L12 8 H8 Z" fill="#c9d0ff" />
        </svg>
      )}
      {ids.includes('moonBadge') && (
        <span
          className="absolute flex items-center justify-center rounded-full"
          style={{
            right: s * 0.03,
            top: h * 0.66,
            width: s * 0.15,
            height: s * 0.15,
            background: 'linear-gradient(145deg, #2b2f6b, #171a3d)',
            border: `${s * 0.012}px solid #c9d0ff`,
            boxShadow: '0 0 10px rgb(201 208 255 / 0.6)'
          }}
        >
          <Moon
            style={{ width: s * 0.08, height: s * 0.08 }}
            className="text-[#ffe08a]"
            fill="currentColor"
            strokeWidth={0}
          />
        </span>
      )}
    </div>
  )
}

/** Antenin ucuna takılanlar (anten div'inin içinde: genişlik 0.09s, uç en üstte) */
export function AntennaAccessory({
  id,
  size: s
}: {
  id: AccessoryId | undefined
  size: number
}): React.JSX.Element | null {
  if (id === 'halo') {
    return (
      <span
        aria-hidden
        className="pointer-events-none absolute z-10 block rounded-[50%]"
        style={{
          left: -s * 0.08,
          top: -s * 0.075,
          width: s * 0.25,
          height: s * 0.07,
          border: `${s * 0.018}px solid #d6c8ff`,
          boxShadow: '0 0 12px rgb(214 200 255 / 0.9)'
        }}
      />
    )
  }
  if (id === 'starClip') {
    return (
      <Star
        aria-hidden
        className="pointer-events-none absolute z-10 text-[#ffe08a]"
        style={{
          left: s * 0.05,
          top: -s * 0.035,
          width: s * 0.1,
          height: s * 0.1,
          filter: glow('rgb(255 224 138 / 0.9)')
        }}
        fill="currentColor"
        strokeWidth={0}
      />
    )
  }
  if (id === 'heartTip') {
    return (
      <Heart
        aria-hidden
        className="pointer-events-none absolute z-10 text-[#ff8fbf]"
        style={{
          left: -s * 0.02,
          top: -s * 0.025,
          width: s * 0.13,
          height: s * 0.13,
          filter: glow('rgb(255 143 191 / 0.9)')
        }}
        fill="currentColor"
        strokeWidth={0}
      />
    )
  }
  return null
}

/** Sağ ele takılanlar (elin içinde; el hareket edince o da hareket eder) */
export function HandAccessory({
  id,
  hand
}: {
  id: AccessoryId | undefined
  /** Elin genişliği (px) */
  hand: number
}): React.JSX.Element | null {
  if (id === 'bracelet') {
    return (
      <span
        aria-hidden
        className="pointer-events-none absolute block rounded-full"
        style={{
          left: hand * 0.08,
          right: hand * 0.08,
          bottom: -hand * 0.08,
          height: hand * 0.22,
          border: `${Math.max(2, hand * 0.08)}px solid #b9a6ff`,
          boxShadow: '0 0 10px rgb(185 166 255 / 0.9)'
        }}
      />
    )
  }
  if (id === 'coffee') {
    return (
      <Coffee
        aria-hidden
        className="pointer-events-none absolute text-[#f3d7b5]"
        style={{
          left: hand * 0.1,
          top: -hand * 0.75,
          width: hand * 0.85,
          height: hand * 0.85,
          filter: glow('rgb(243 215 181 / 0.6)')
        }}
        strokeWidth={2.4}
      />
    )
  }
  return null
}
