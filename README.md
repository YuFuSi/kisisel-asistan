# Jarvis (Kişisel Asistan)

Windows için yapay zeka destekli, sesle konuşulabilen masaüstü kişisel asistanı. Sohbet eder; görev, hatırlatma, not, hafıza, Gmail, Google Takvim, otomasyon (rutin), pencere kontrolü ve internet gibi yetenekleri **araç** olarak kullanır. Uygulama içi kimliği **Jarvis**.

Sürüm: **1.1.0-beta**

## Özellikler

- **Ana Sayfa:** Canlı, ışıklı bir küre (WebGL) etrafında selamlama, kişiye özel günün özeti ve komut kutusu. Küre asistanın durumuna (dinliyor, düşünüyor, çalışıyor, konuşuyor), duygu haline (başarı, hata, onay bekleme) ve bildirimlere göre tepki verir; rengi ve yoğunluğu Ayarlar'dan seçilebilir.
- **Sohbet:** Ollama (yerel), OpenAI, Gemini veya Claude modelleriyle akışlı cevap. Sohbetler tarihe göre gruplanır (Bugün/Dün/Bu hafta), arama, sabitleme, yeniden adlandırma, cevabı yeniden üretme, mesajı düzenleme, Markdown olarak dışa aktarma.
- **Komut paleti (`Ctrl+K`):** Sayfalara ve sık işlemlere (yeni sohbet, günü özetle, sohbet arama) klavyeyle anında ulaşma.
- **Görevler ve hatırlatmalar:** Tarihli/saatli görevler, tekrarlayan hatırlatmalar (her gün, hafta içi, her hafta), erteleme ve Windows bildirimleri.
- **Notlar ve Hafıza Merkezi:** Otomatik kaydedilen notlar, anlamsal (embedding tabanlı) arama. Asistan önemli bilgileri hafızasına kaydeder ve sonraki sohbetlerde hatırlar.
- **Otomasyonlar (rutinler):** Kullanıcının kurduğu, belirli saatte kendiliğinden çalışan serbest metin talimatlı görevler; izin seviyesi (hiçbiri/yazma/tam) ve çalıştırma geçmişi.
- **Analizler ve Başarımlar:** Araç kullanım istatistikleri ve rozetler; tamamı yerelde `activity_log`'dan hesaplanır, dışarı hiçbir şey gitmez.
- **Sesli sohbet (yerel, internetsiz):** "Hey Jarvis" uyandırma kelimesi, whisper.cpp ile konuşma tanıma, Piper ile Türkçe seslendirme, söz kesme (barge-in). Ayrıca Groq/OpenAI ile mikrofonla yazma seçeneği.
- **Belge okuma:** PDF, Word ve metin dosyalarını sohbete ekleyip soru sorma; küreye dosya sürükleyip bırakma.
- **İnternet:** Hava durumu (anahtarsız) ve web arama (Tavily).
- **Bilgisayar kontrolü:** Uygulama ve dosya açma, dosya arama, pencere listeleme/öne getirme/küçültme/kapatma, sistem bilgisi, pano. Riskli işlemler önce onay ister.
- **Gmail ve Google Takvim:** E-posta özetleme, arama, okuma, yanıtlama, taslak; etkinlik listeleme, ekleme, güncelleme, silme.
- **Sabah özeti:** Hava, bugünkü görevler, hatırlatmalar, takvim ve okunmamış e-postalar tek bildirimde; isteğe bağlı sesli okuma.
- **Sistem:** Tepside çalışma, global kısayol (`Ctrl+Shift+Space`), ayrı bir HUD paneli (`Ctrl+Shift+J`), Windows ile başlama, günlük yedekleme, günlük dosyası, bozuk veritabanından kurtarma.
- **Kişiselleştirme:** "Hakkımda" metni, konuşma tonu, yaratıcılık ve bağlam uzunluğu ayarları.

## Kurulum

### Hazır kurulum dosyasıyla

1. `npm run build:win` ile `dist/kisisel-asistan-<sürüm>-setup.exe` dosyasını üretin.
2. Dosyayı çalıştırın. Yönetici izni gerekmez.
3. Uygulama imzasız olduğu için Windows SmartScreen uyarı verebilir: **Ek bilgi → Yine de çalıştır**.

Veriler `%APPDATA%\kisisel-asistan` klasöründe tutulur. Uygulama kaldırılınca veriler silinmez.

### Geliştirme ortamında

```bash
npm install
npm run dev
```

Yerel model için [Ollama](https://ollama.com) kurulu olmalı (ör. `ollama pull qwen3:14b`). Bulut modelleri için API anahtarı Ayarlar sayfasından girilir; anahtarlar Windows'un şifreleme altyapısıyla saklanır. Yerel sesli sohbet için Ayarlar > Ses'ten ses paketi indirilir (whisper.cpp, Piper, uyandırma kelimesi modeli — bkz. [LICENSES.md](LICENSES.md)).

## İsteğe bağlı anahtarlar

| Özellik                  | Gereken                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Web arama                | Tavily API anahtarı                                                                                   |
| Gmail ve Takvim          | Google Cloud'da "Masaüstü uygulaması" türünde OAuth istemcisi, Gmail API ve Google Calendar API etkin |
| Mikrofonla yazma (bulut) | Groq (ücretsiz) veya OpenAI API anahtarı — yerel whisper.cpp anahtar gerektirmez                      |
| Bulut sohbet modelleri   | OpenAI, Gemini veya Claude API anahtarı                                                               |

## Komutlar

| Komut               | Ne yapar                                                            |
| ------------------- | ------------------------------------------------------------------- |
| `npm install`       | Bağımlılıkları kurar (ilk seferde bir kez)                          |
| `npm run dev`       | Uygulamayı geliştirme modunda açar (kod değişince anında yenilenir) |
| `npm run typecheck` | TypeScript tip hatalarını kontrol eder                              |
| `npm run lint`      | Kod stilini ve olası hataları kontrol eder                          |
| `npm run test`      | Birim testlerini çalıştırır                                         |
| `npm run build:win` | Windows kurulum dosyası üretir (`dist/` klasörüne)                  |

CI (`.github/workflows/ci.yml`) her PR'da ve `main`'e her gönderimde tip kontrolü, lint, test ve derlemeyi çalıştırır; `main`'e gönderimde ayrıca imzasız Windows kurulum dosyasını üretip iş çıktısı (artifact) olarak saklar.

## Teknoloji

| Katman     | Seçim                                                           |
| ---------- | --------------------------------------------------------------- |
| Masaüstü   | Electron 39 + electron-vite                                     |
| Arayüz     | React 19, TypeScript, Tailwind CSS 4                            |
| Yapay zeka | Vercel AI SDK v7 (Ollama/OpenAI/Gemini/Claude)                  |
| Veritabanı | SQLite (`better-sqlite3`), WAL + günlük yedek                   |
| Ses        | whisper.cpp, Piper, openWakeWord, Silero VAD (onnxruntime-node) |
| Test       | Vitest                                                          |
| Paketleme  | electron-builder (NSIS)                                         |

## Klasör yapısı

```
src/
├─ shared/     Arka plan ve arayüzün ortak tipleri
├─ main/       Arka plan (Node): pencere, veritabanı, yapay zeka, araçlar, ses, zamanlayıcılar
├─ preload/    Arayüz ile arka plan arasındaki güvenli köprü
└─ renderer/   Arayüz (React): sayfalar, bileşenler, küre (Jarvis)
```

Ayrıntılı mimari notlar ve geliştirme kuralları için [CLAUDE.md](CLAUDE.md) dosyasına bakın. Paketlenen model ve ikili dosyaların lisansları için [LICENSES.md](LICENSES.md) dosyasına bakın.

## Yol haritası

- [x] Aşama 0-6: Proje iskeleti, AI sohbet, görev/hatırlatma/not/hafıza, sistem tepsisi, internet ve bilgisayar kontrolü, Gmail/Takvim, sesli komut
- [x] Bölüm 2, Tur A-F: Arayüz, sohbet deneyimi, yeni yetenekler, asistanın zekası, kurulum dosyası
- [x] Bölüm 3, Tur G: Sağlam temel (yedekleme, günlük, araç izinleri, etkinlik kaydı)
- [x] Tur H-I: Jarvis kimliği ve arayüzü, yerel sesli sohbet
- [x] Tur J: Otomasyon motoru (rutinler)
- [x] Tur K: Hafıza Merkezi 2.0 (anlamsal arama) ve proaktif bildirimler
- [x] Sakin premium yeniden tasarım: küre (WebGL), Ana Sayfa, sidebar (gün çizelgesi, öneriler), komut paleti
- [x] Analizler ve Başarımlar (gerçek veriden hesaplanan istatistik ve rozetler)
- [ ] Tur L: Bilgisayarı yönetme (pencere kontrolünün ilk dilimi tamam; dosya işleri, tarayıcı otomasyonu, fare/klavye ajanı bekliyor)
- [ ] Tur M: Her yerde Jarvis (MCP istemcisi, Telegram, Home Assistant, Spotify)
- [ ] Tur N: Genişletilmiş analizler ve başarımlar

## Bilinen sınırlamalar

- Küçük yerel model (`qwen3:14b`) çok sayıda araç arasından seçim yaparken bazen hiç araç çağırmadan yazıyor veya yanlış aracı seçiyor; bulut modellerinde daha güvenilir.
- Kod imzalama sertifikası yok; kurulum dosyası Windows SmartScreen uyarısı verebilir.
- Otomatik güncelleme yok; yeni sürüm elle kurulur (veri klasörü korunur).
