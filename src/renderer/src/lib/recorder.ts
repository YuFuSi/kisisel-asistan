// Mikrofon kaydı. Kayıt bitince sesi ana sürece gönderip yazıya çevirtiyoruz.

export interface Recording {
  /** Kaydı bitirir ve ses verisini döndürür */
  stop: () => Promise<{ audio: ArrayBuffer; mimeType: string }>
  /** Kaydı iptal eder, ses verisi kullanılmaz */
  cancel: () => void
}

function describeMicError(error: unknown): Error {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError') {
    return new Error(
      'Mikrofon izni verilmedi. Windows ayarlarından uygulamalar için mikrofon erişimine izin ver.'
    )
  }
  if (name === 'NotFoundError') return new Error('Mikrofon bulunamadı.')
  return new Error('Mikrofon açılamadı.')
}

export async function startRecording(): Promise<Recording> {
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (error) {
    throw describeMicError(error)
  }

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm'
  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks: Blob[] = []
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })
  recorder.start()

  const releaseMicrophone = (): void => stream.getTracks().forEach((track) => track.stop())

  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.addEventListener(
          'stop',
          () => {
            releaseMicrophone()
            const blob = new Blob(chunks, { type: mimeType })
            void blob.arrayBuffer().then((audio) => resolve({ audio, mimeType }))
          },
          { once: true }
        )
        recorder.stop()
      }),
    cancel: () => {
      if (recorder.state !== 'inactive') recorder.stop()
      releaseMicrophone()
    }
  }
}
