# Kişisel Asistan

Yapay zeka destekli Windows masaüstü kişisel asistanı. Electron, React, TypeScript ve Tailwind CSS ile yazılıyor.

## Yol haritası

- [x] **Aşama 0:** Proje iskeleti, yan menü, sayfalar
- [x] **Aşama 1:** AI sohbet ve Ayarlar (OpenAI / Gemini / Claude / Ollama)
- [x] **Aşama 2:** Görevler, hatırlatmalar, notlar, hafıza
- [x] **Aşama 3:** Sistem tepsisi, kısayol tuşu, Windows ile başlama
- [x] **Aşama 4:** Hava durumu, web arama, bilgisayar kontrolü
- [ ] **Aşama 5:** Gmail ve Google Takvim
- [ ] **Aşama 6:** Sesli komut ve sesli yanıt
- [ ] **Aşama 7:** Kurulum dosyası (.exe)

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm install` | Bağımlılıkları kurar (ilk seferde bir kez) |
| `npm run dev` | Uygulamayı geliştirme modunda açar (kod değişince anında yenilenir) |
| `npm run typecheck` | TypeScript tip hatalarını kontrol eder |
| `npm run lint` | Kod stilini ve olası hataları kontrol eder |
| `npm run build:win` | Windows kurulum dosyası üretir (`dist/` klasörüne) |

## Klasör yapısı

```
src/
├─ main/       Arka plan (Node): pencere, veritabanı, yapay zeka, araçlar
├─ preload/    Arayüz ile arka plan arasındaki güvenli köprü
└─ renderer/   Arayüz (React): sayfalar ve bileşenler
```
