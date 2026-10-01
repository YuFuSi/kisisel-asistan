import type { LucideIcon } from 'lucide-react'

// Renkli, parlak ikon karesi (Jarvis Cam): degrade dolgu, üstte ışık, altta renkli gölge.
// Renk tonu (hue) anlamı taşır: lila Jarvis, mavi zaman, amber dikkat, yeşil tamamlandı.
export const TONES = {
  lilac: 232,
  blue: 210,
  amber: 36,
  green: 152,
  pink: 330,
  teal: 180
} as const

export type IconTone = keyof typeof TONES

interface IconTileProps {
  icon: LucideIcon
  tone?: IconTone
  /** Kenar uzunluğu (px) */
  size?: number
}

function IconTile({ icon: Icon, tone = 'lilac', size = 28 }: IconTileProps): React.JSX.Element {
  const hue = TONES[tone]
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        background: `linear-gradient(145deg, hsl(${hue} 92% 74%), hsl(${hue} 72% 52%))`,
        boxShadow: `inset 0 1px 1px rgb(255 255 255 / 0.55), inset 0 -2px 4px hsl(${hue} 70% 35% / 0.5), 0 4px 12px -2px hsl(${hue} 80% 50% / 0.45)`
      }}
    >
      <Icon
        style={{ width: size * 0.55, height: size * 0.55 }}
        className="text-white drop-shadow-[0_1px_1px_rgb(0_0_0_/_0.25)]"
        strokeWidth={2.2}
      />
    </span>
  )
}

export default IconTile
