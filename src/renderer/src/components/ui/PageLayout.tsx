import { motion } from 'motion/react'
import PageHeader from './PageHeader'

// Sayfa açılınca içerik hafif bulanıklıktan netleşerek, çok az yükselerek belirir (Pıtır Cam)
const enter = {
  initial: { opacity: 0, y: 10, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { type: 'spring', stiffness: 140, damping: 22 }
} as const

// Bütün sayfaların ortak iskeleti (tasarım turu 3. aşama): aynı başlık, genişlik ve boşluklar.
// - width: 'default' okunabilir sayfalar (Planlama, Analizler, Ayarlar), 'wide' ızgaralı
//   sayfalar (Takvim).
// - fill: sayfa kendi içinde kayan tam yükseklikte bir alan istiyorsa (Hafıza'daki not
//   düzenleyici, harita); başlık ve sekmeler üstte sabit, içerik kalan yüksekliği doldurur.

interface PageLayoutProps {
  title: string
  description?: string
  /** Başlığın sağındaki eylemler (düğme, ay gezinmesi vb.) */
  actions?: React.ReactNode
  /** Başlığın altındaki sekme sırası */
  tabs?: React.ReactNode
  width?: 'default' | 'wide'
  fill?: boolean
  /** Ayarlar gibi hareket tercihini canlı izleyen sayfalar için statik giriş. */
  reduceMotion?: boolean
  children: React.ReactNode
}

const WIDTH_CLASS = { default: 'max-w-4xl', wide: 'max-w-6xl' } as const

function PageLayout({
  title,
  description,
  actions,
  tabs,
  width = 'default',
  fill = false,
  reduceMotion = false,
  children
}: PageLayoutProps): React.JSX.Element {
  const frame = `mx-auto w-full ${WIDTH_CLASS[width]} px-8`
  const entrance = reduceMotion
    ? {
        initial: false as const,
        animate: { opacity: 1, y: 0, filter: 'none' },
        transition: { duration: 0 }
      }
    : enter

  if (fill) {
    return (
      <motion.div {...entrance} className="flex h-full flex-col">
        <div className={`${frame} shrink-0 pt-8`}>
          <PageHeader title={title} description={description} actions={actions} />
          {tabs}
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </motion.div>
    )
  }

  return (
    <motion.div {...entrance} className={`${frame} py-8`}>
      <PageHeader title={title} description={description} actions={actions} />
      {tabs && <div className="mb-6">{tabs}</div>}
      {children}
    </motion.div>
  )
}

export default PageLayout
