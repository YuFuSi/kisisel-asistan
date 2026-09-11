import { useEffect, useState } from 'react'
import type { DataScope } from '@shared/api'
import { errorMessage } from './errors'

export interface LiveData<T> {
  data: T | null
  error: string | null
}

// Veriyi yükler; ana süreç "bu veri değişti" dediğinde (ör. asistan sohbette görev eklediğinde)
// kendiliğinden yeniden yükler.
// Önemli: `load` bileşenin dışında tanımlanmalı, yoksa her render'da yeniden yükleme yapılır.
export function useLiveData<T>(load: () => Promise<T>, scope: DataScope): LiveData<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const refresh = (): void => {
      load().then(
        (value) => {
          if (!active) return
          setData(value)
          setError(null)
        },
        (err) => {
          if (active) setError(errorMessage(err))
        }
      )
    }

    refresh()
    const unsubscribe = window.api.events.onDataChanged((changed) => {
      if (changed === scope) refresh()
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [load, scope])

  return { data, error }
}
