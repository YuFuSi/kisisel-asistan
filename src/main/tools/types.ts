import type { ToolSet } from 'ai'
import type { ToolRisk } from '../../shared/api'

// Her yetenek bir modül: modele verilecek araçlar + arayüzde görünecek Türkçe etiketler.
// Yeni bir yetenek eklemek için bu tipte bir modül yazıp tools/index.ts listesine eklemek yeterli.
export interface ToolModule {
  tools: ToolSet
  labels: Record<string, string>
  /**
   * Her aracın risk seviyesi (read / write / dangerous). Onay kuralları buna göre uygulanır.
   * Listede olmayan araç güvenlik için "dangerous" sayılır.
   */
  risks: Record<string, ToolRisk>
  /**
   * İçinde kendi onay kartını (requireApproval) ayrıntılı bilgiyle gösteren araçlar.
   * Bunlar dışındaki write/dangerous araçlar için onay gerekiyorsa genel bir onay kartı gösterilir.
   */
  selfApproval?: string[]
  /**
   * Verilirse ve false dönerse modülün araçları modele hiç verilmez (ör. Google hesabı bağlı değilken).
   * Çalışamayacak araçları gizlemek küçük modellerin yanlış araç seçmesini azaltır.
   */
  isAvailable?: () => boolean
}
