# Kişisel Asistan

Windows için yapay zeka destekli masaüstü kişisel asistanı. Asistan sohbet eder; görev, hatırlatma, not, hafıza, Gmail, Google Takvim, ses ve bilgisayar kontrolü gibi yetenekleri **araç** olarak kullanır.

Sürüm: **1.0.0-beta**

## Özellikler

- **Sohbet:** Ollama (yerel), OpenAI, Gemini veya Claude modelleriyle akışlı cevap. Sohbet arama, sabitleme, yeniden adlandırma, cevabı yeniden üretme, mesajı düzenleme ve Markdown olarak dışa aktarma.
- **Görevler ve hatırlatmalar:** Tarihli görevler, tekrarlayan hatırlatmalar (her gün, hafta içi, her hafta), erteleme ve Windows bildirimleri.
- **Notlar ve hafıza:** Otomatik kaydedilen notlar. Asistan önemli bilgileri hafızasına kaydeder ve sonraki sohbetlerde hatırlar.
- **Belge okuma:** PDF, Word ve metin dosyalarını sohbete ekleyip soru sorma.
- **İnternet:** Hava durumu (anahtarsız) ve web arama (Tavily).
- **Bilgisayar kontrolü:** Uygulama ve dosya açma, dosya arama, sistem bilgisi, pano. Riskli işlemler önce onay ister.
- **Gmail ve Google Takvim:** E-posta özetleme, arama, okuma, yanıtlama, taslak; etkinlik listeleme, ekleme, güncelleme, silme.
- **Sabah özeti:** Hava, bugünkü görevler, hatırlatmalar, takvim ve okunmamış e-postalar tek bildirimde.
- **Ses:** Mikrofonla yazma (Groq veya OpenAI Whisper) ve cevapları Windows sesiyle okuma.
- **Sistem:** Tepside çalışma, global kısayol (`Ctrl+Shift+Space`), Windows ile başlama.
- **Kişiselleştirme:** "Hakkımda" metni, konuşma tonu, yaratıcılık ve bağlam uzunluğu ayarları.

## Kurulum

### Hazır kurulum dosyasıyla

1. `npm run build:win` ile `dist/kisisel-asistan-1.0.0-beta-setup.exe` dosyasını üretin.
2. Dosyayı çalıştırın. Yönetici izni gerekmez.
3. Uygulama imzasız olduğu için Windows SmartScreen uyarı verebilir: **Ek bilgi → Yine de çalıştır**.

Veriler `%APPDATA%\kisisel-asistan` klasöründe tutulur. Uygulama kaldırılınca veriler silinmez.

### Geliştirme ortamında

```bash
npm install
npm run dev
```

Yerel model için [Ollama](https://ollama.com) kurulu olmalı (ör. `ollama pull qwen3:14b`). Bulut modelleri için API anahtarı Ayarlar sayfasından girilir; anahtarlar Windows'un şifreleme altyapısıyla saklanır.

## İsteğe bağlı anahtarlar

| Özellik | Gereken |
|---|---|
| Web arama | Tavily API anahtarı |
| Gmail ve Takvim | Google Cloud'da "Masaüstü uygulaması" türünde OAuth istemcisi, Gmail API ve Google Calendar API etkin |
| Mikrofonla yazma | Groq (ücretsiz) veya OpenAI API anahtarı |
| Bulut modelleri | OpenAI, Gemini veya Claude API anahtarı |

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm install` | Bağımlılıkları kurar (ilk seferde bir kez) |
| `npm run dev` | Uygulamayı geliştirme modunda açar (kod değişince anında yenilenir) |
| `npm run typecheck` | TypeScript tip hatalarını kontrol eder |
| `npm run lint` | Kod stilini ve olası hataları kontrol eder |
| `npm run test` | Birim testlerini çalıştırır |
| `npm run build:win` | Windows kurulum dosyası üretir (`dist/` klasörüne) |

## Teknoloji

| Katman | Seçim |
|---|---|
| Masaüstü | Electron + electron-vite |
| Arayüz | React, TypeScript, Tailwind CSS |
| Yapay zeka | Vercel AI SDK |
| Veritabanı | SQLite (`better-sqlite3`) |
| Test | Vitest |
| Paketleme | electron-builder (NSIS) |

## Klasör yapısı

```
src/
├─ shared/     Arka plan ve arayüzün ortak tipleri
├─ main/       Arka plan (Node): pencere, veritabanı, yapay zeka, araçlar, zamanlayıcılar
├─ preload/    Arayüz ile arka plan arasındaki güvenli köprü
└─ renderer/   Arayüz (React): sayfalar ve bileşenler
```

Ayrıntılı mimari notlar ve geliştirme kuralları için [CLAUDE.md](CLAUDE.md) dosyasına bakın.

## Yol haritası

- [x] Aşama 0: Proje iskeleti
- [x] Aşama 1: AI sohbet ve Ayarlar
- [x] Aşama 2: Görevler, hatırlatmalar, notlar, hafıza
- [x] Aşama 3: Sistem tepsisi, kısayol tuşu, Windows ile başlama
- [x] Aşama 4: Hava durumu, web arama, bilgisayar kontrolü
- [ ] Aşama 5: Gmail ve Google Takvim (kod hazır, hesapla test bekliyor)
- [x] Aşama 6: Sesli komut ve sesli yanıt
- [x] Tur A-D: Arayüz, sohbet deneyimi, yeni yetenekler, asistanın zekası
- [ ] Tur E: Güvenilirlik (hata günlüğü, otomatik yedek)
- [x] Tur F: Kurulum dosyası (v1.0.0-beta)
