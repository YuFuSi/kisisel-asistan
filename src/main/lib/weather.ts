// Open-Meteo ile hava durumu. Ücretsiz ve API anahtarı gerektirmiyor.

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const TIMEOUT_MS = 10_000

// WMO hava durumu kodları
const WEATHER_CODES: Record<number, string> = {
  0: 'Açık',
  1: 'Az bulutlu',
  2: 'Parçalı bulutlu',
  3: 'Kapalı',
  45: 'Sisli',
  48: 'Kırağılı sis',
  51: 'Hafif çisenti',
  53: 'Çisenti',
  55: 'Yoğun çisenti',
  56: 'Dondurucu çisenti',
  57: 'Yoğun dondurucu çisenti',
  61: 'Hafif yağmur',
  63: 'Yağmur',
  65: 'Şiddetli yağmur',
  66: 'Dondurucu yağmur',
  67: 'Şiddetli dondurucu yağmur',
  71: 'Hafif kar',
  73: 'Kar',
  75: 'Yoğun kar',
  77: 'Kar taneleri',
  80: 'Hafif sağanak',
  81: 'Sağanak',
  82: 'Şiddetli sağanak',
  85: 'Hafif kar sağanağı',
  86: 'Yoğun kar sağanağı',
  95: 'Gök gürültülü fırtına',
  96: 'Dolu ve gök gürültüsü',
  99: 'Şiddetli dolu ve gök gürültüsü'
}

export function describeWeatherCode(code: number): string {
  return WEATHER_CODES[code] ?? 'Bilinmeyen hava durumu'
}

export interface Place {
  ad: string
  enlem: number
  boylam: number
}

export interface WeatherDay {
  tarih: string
  gun: string
  durum: string
  enDusuk: number
  enYuksek: number
  yagisIhtimali: number | null
}

export interface WeatherReport {
  yer: string
  simdi: {
    sicaklik: number
    hissedilen: number
    durum: string
    nem: number
    ruzgar: number
  }
  gunler: WeatherDay[]
}

async function getJson(url: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new Error('Hava durumu servisine bağlanılamadı. İnternet bağlantını kontrol et.')
  }
  if (!response.ok) throw new Error(`Hava durumu servisi hata verdi (HTTP ${response.status}).`)
  return response.json()
}

interface GeocodingResponse {
  results?: {
    name: string
    latitude: number
    longitude: number
    country?: string
    admin1?: string
  }[]
}

export async function findPlace(name: string): Promise<Place> {
  const query = name.trim()
  if (!query) throw new Error('Şehir adı boş olamaz.')
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(query)}&count=1&language=tr&format=json`
  const data = (await getJson(url)) as GeocodingResponse
  const first = data.results?.[0]
  if (!first) throw new Error(`"${query}" adında bir yer bulunamadı.`)
  const parts = [first.name, first.admin1, first.country].filter(
    (part, index, all) => part && all.indexOf(part) === index
  )
  return { ad: parts.join(', '), enlem: first.latitude, boylam: first.longitude }
}

interface ForecastResponse {
  current: {
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    weather_code: number
    wind_speed_10m: number
  }
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max: (number | null)[]
  }
}

const round = (value: number): number => Math.round(value)

export async function getWeather(place: Place, days: number): Promise<WeatherReport> {
  const dayCount = Math.min(Math.max(days, 1), 7)
  const url =
    `${FORECAST_URL}?latitude=${place.enlem}&longitude=${place.boylam}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    `&timezone=auto&forecast_days=${dayCount}`
  const data = (await getJson(url)) as ForecastResponse

  const gunler: WeatherDay[] = data.daily.time.map((date, index) => ({
    tarih: date,
    gun: new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR', { weekday: 'long' }),
    durum: describeWeatherCode(data.daily.weather_code[index]),
    enDusuk: round(data.daily.temperature_2m_min[index]),
    enYuksek: round(data.daily.temperature_2m_max[index]),
    yagisIhtimali: data.daily.precipitation_probability_max[index] ?? null
  }))

  return {
    yer: place.ad,
    simdi: {
      sicaklik: round(data.current.temperature_2m),
      hissedilen: round(data.current.apparent_temperature),
      durum: describeWeatherCode(data.current.weather_code),
      nem: round(data.current.relative_humidity_2m),
      ruzgar: round(data.current.wind_speed_10m)
    },
    gunler
  }
}
