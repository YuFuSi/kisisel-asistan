import type { ToolSet } from 'ai'

// Her yetenek bir modül: modele verilecek araçlar + arayüzde görünecek Türkçe etiketler.
// Yeni bir yetenek eklemek için bu tipte bir modül yazıp tools/index.ts listesine eklemek yeterli.
export interface ToolModule {
  tools: ToolSet
  labels: Record<string, string>
  /**
   * Verilirse ve false dönerse modülün araçları modele hiç verilmez (ör. Google hesabı bağlı değilken).
   * Çalışamayacak araçları gizlemek küçük modellerin yanlış araç seçmesini azaltır.
   */
  isAvailable?: () => boolean
}
