import type { HomeWeather } from '../../shared/api'
import { findPlace, getWeather } from '../lib/weather'
import { getSettings } from '../settings'

// Ana Sayfa'daki hava kartı: sabah özetinin şehri kullanılır, sonuç 30 dk önbellekte tutulur
const CACHE_MS = 30 * 60_000
let cache: { city: string; at: number; value: HomeWeather } | null = null

export async function getHomeWeather(): Promise<HomeWeather | null> {
  const city = getSettings().briefCity.trim()
  if (!city) return null
  if (cache && cache.city === city && Date.now() - cache.at < CACHE_MS) return cache.value
  try {
    const report = await getWeather(await findPlace(city), 1)
    const day = report.gunler[0]
    const value: HomeWeather = {
      place: report.yer.split(',')[0],
      temperature: report.simdi.sicaklik,
      condition: report.simdi.durum,
      min: day?.enDusuk ?? null,
      max: day?.enYuksek ?? null,
      rainChance: day?.yagisIhtimali ?? null
    }
    cache = { city, at: Date.now(), value }
    return value
  } catch (err) {
    console.error('Ana Sayfa hava durumu alınamadı:', err)
    return cache?.city === city ? cache.value : null
  }
}
