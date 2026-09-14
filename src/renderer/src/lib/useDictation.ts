import { useEffect, useRef, useState } from 'react'
import { errorMessage } from './errors'
import { startRecording, type Recording } from './recorder'

export interface Dictation {
  recording: boolean
  transcribing: boolean
  error: string | null
  /** İlk basışta kayda başlar, ikincide kaydı yazıya çevirip onText ile verir */
  toggle: () => Promise<void>
}

// Mikrofonla yazma düğmesinin ortak mantığı (sohbet kutusu ve Ana Sayfa komut kutusu)
export function useDictation(onText: (text: string) => void): Dictation {
  const [recording, setRecording] = useState<Recording | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recordingRef = useRef<Recording | null>(null)

  // Bileşen kapanırken (ör. sayfa değişince) kayıt sürüyorsa mikrofon bırakılsın
  useEffect(() => () => recordingRef.current?.cancel(), [])

  async function toggle(): Promise<void> {
    setError(null)
    if (!recording) {
      try {
        const started = await startRecording()
        recordingRef.current = started
        setRecording(started)
      } catch (err) {
        setError(errorMessage(err))
      }
      return
    }

    const current = recording
    recordingRef.current = null
    setRecording(null)
    setTranscribing(true)
    try {
      const { audio, mimeType } = await current.stop()
      onText(await window.api.speech.transcribe(audio, mimeType))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setTranscribing(false)
    }
  }

  return { recording: recording !== null, transcribing, error, toggle }
}
