// Cevapları sesli okuma. Windows'un kendi sesleri kullanılır; internet veya anahtar gerekmez.

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

/** Markdown işaretleri sesli okumada "yıldız yıldız" gibi duyulmasın */
export function plainForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' kod bloğu ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/(\*\*|__|\*|_|~~)/g, '')
    .replace(/\|/g, ' ')
    .replace(/\n{2,}/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MAX_SPEECH_LENGTH = 3000

export function speakText(text: string, preferredUri: string): void {
  const synth = window.speechSynthesis
  if (!synth) return
  const content = plainForSpeech(text).slice(0, MAX_SPEECH_LENGTH)
  if (!content) return

  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(content)
  const voice = pickVoice(synth.getVoices(), preferredUri)
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  } else {
    utterance.lang = 'tr-TR'
  }
  synth.speak(utterance)
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel()
}
