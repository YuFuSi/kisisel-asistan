// Sesli okuma yardımcıları. Seslendirmeyi ana süreç yönetir (Piper veya Windows sesi);
// arayüz sesi voiceClient.ts içinde sırayla çalar.
import { plainForSpeech } from '../../../shared/speechText'

export { plainForSpeech }

export interface VoiceOption {
  uri: string
  label: string
  lang: string
}

const isTurkish = (lang: string): boolean => lang.toLowerCase().startsWith('tr')

/** Türkçe sesler listenin başına alınır */
export function listVoiceOptions(voices: SpeechSynthesisVoice[]): VoiceOption[] {
  return [...voices]
    .sort((a, b) => Number(isTurkish(b.lang)) - Number(isTurkish(a.lang)))
    .map((voice) => ({
      uri: voice.voiceURI,
      label: `${voice.name} (${voice.lang})`,
      lang: voice.lang
    }))
}

/** Seçili ses yoksa Türkçe olanı, o da yoksa ilk sesi kullan */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  preferredUri: string
): SpeechSynthesisVoice | undefined {
  if (preferredUri) {
    const chosen = voices.find((voice) => voice.voiceURI === preferredUri)
    if (chosen) return chosen
  }
  return voices.find((voice) => isTurkish(voice.lang)) ?? voices[0]
}

/** Metni Ayarlar'da seçili sesle okur (Pıtır sesi veya Windows sesi) */
export function speakText(text: string): void {
  if (text.trim()) void window.api.voice.speak(text)
}

export function stopSpeaking(): void {
  void window.api.voice.stopSpeaking()
}
