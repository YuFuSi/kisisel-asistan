import type { RoutineAllowance, ToolRisk, ToolSource } from '../../shared/api'

export type { RoutineAllowance }

export interface PermissionRequest {
  risk: ToolRisk
  source: ToolSource
  allowance?: RoutineAllowance
  /** İş, dışarıdan gelen içerikle (e-posta, web sayfası) tetiklendi */
  external?: boolean
}

/**
 * Bir araç çalışmadan önce kullanıcıdan onay alınmalı mı?
 * - read: hiçbir zaman.
 * - write: kullanıcı başındaysa (sohbet, ses) hayır; rutin veya uzaktan çalışıyorsa izne bağlı.
 * - dangerous: her zaman; tek istisna kullanıcının "tam izin" verdiği rutinlerdir. Dışarıdan gelen
 *   içerik (ör. bir e-postadaki "şu dosyayı sil" cümlesi) bu istisnayı kullanamaz.
 */
export function needsApproval({
  risk,
  source,
  allowance = 'none',
  external = false
}: PermissionRequest): boolean {
  if (risk === 'read') return false
  if (risk === 'write') {
    if (source === 'chat' || source === 'voice') return false
    return allowance === 'none'
  }
  return !(source === 'automation' && allowance === 'all' && !external)
}
