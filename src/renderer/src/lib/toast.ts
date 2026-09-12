import { createContext, useContext } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

export interface ToastApi {
  show: (message: string, kind?: ToastKind) => void
  success: (message: string) => void
  error: (message: string) => void
}

// Sağlayıcı yoksa (ör. testte) sessizce yok sayılır
const fallback: ToastApi = {
  show: () => undefined,
  success: () => undefined,
  error: () => undefined
}

export const ToastContext = createContext<ToastApi>(fallback)

export function useToast(): ToastApi {
  return useContext(ToastContext)
}
