# Kişisel Asistan: Proje Notları

> Bu dosya projenin hafızası. Claude Code her oturumun başında otomatik okur.
> Her aşama bitince **Nerede kaldık** ve **Yol haritası** bölümleri güncellenir.

## Nerede kaldık

> Ayrıntılı geçmiş (her turun kararları, ölçümleri, canlı testte bulunan hatalar): [docs/gecmis.md](docs/gecmis.md).
> Bir özellik hakkında "neden böyle yapıldı" sorusu varsa önce orada ara.

- **Son güncelleme:** 2026-10-01
- **Sürüm:** **v1.2.0** yayınlandı ve kullanıcının bilgisayarına kuruldu (`git tag v1.2.0`). Kurulum dosyaları açık **`YuFuSi/jarvis-releases`** deposunun GitHub sürümlerinde; kaynak kod gizli `YuFuSi/kisisel-asistan`'da.
- **Otomatik güncelleme var** (`system/updater.ts`, `electron-updater`): paketli uygulama açılıştan 1 dk sonra ve 6 saatte bir jarvis-releases'a bakar, arka planda indirir, bildirim gösterir, çıkışta kurar. Günlükte `Checking for update` / `Update for version ... is not available` satırları görünür.
- **Uygulamada neler var:** sohbet + ~45 araç (görev, hatırlatma, not, hafıza, Gmail/Takvim, web, dosya, pano, ekranı görme, pencere taşıma, rutinler), Ana Sayfa (küre, kişisel özet, komut kutusu), Görevler, Takvim, Hafıza Merkezi (liste + 3B hafıza haritası, `bge-m3` anlamsal arama), Otomasyonlar, Analizler, Başarımlar, Ayarlar; yerel ses (Hey Jarvis, whisper.cpp, Piper), Jarvis Çentiği (ekranın üst ortası, `Ctrl+Shift+J` aç/kapat; eski HUD kaldırıldı), kamera ile el kontrolü (Ana Sayfa'da iki alkışla açılır), proaktif bildirimler, sabah özeti, pil uyarısı, model yönlendirici (`lib/toolCategories.ts`). Tema "sakin premium": grafit zemin, tek vurgu lila `#8b9bff`.
- **2026-09-28 genel bakım turu (PR #73-#84):** son `window.confirm` → `ConfirmDialog`; el takibi modeli (`HandLandmarker.close()`) ve ses dinleme zamanlayıcısı sızıntısı; modelin düşünce metninin sohbet başlığı olması (`cleanTitle`); `.gitattributes` ile LF (lint'teki 25 bin sahte uyarı bitti); güvenlik taraması (zamanlayıcılar DB hatasında takılmıyor, `dosya_ac` .exe/.bat/.ps1/.lnk açmıyor, kamera/mikrofon izni sadece uygulamanın kendi sayfalarına, `hud:navigate` doğrulaması); pencereler `sandbox: true`; MediaPipe wasm + el modeli uygulamayla geliyor (CDN ve CSP istisnaları kaldırıldı, internetsiz çalışır); düğme stilleri tek kaynak (`components/ui/buttonStyles.ts`); yeni simge (grafit + lila); paket 262 MB küçüldü (arayüz-yalnız paketler devDependencies'te, onnxruntime'ın başka platform dosyaları hariç); "Kamera (deneme)" menüden kalktı (komut paletinde duruyor).
- **Güçlü hafıza turu (2026-09-29, PR #86-#90, tasarım `docs/superpowers/specs/2026-09-28-guclu-hafiza-design.md`):** Kullanıcı "Gemini'den Qwen'e geçince hiçbir şey hatırlamıyor" dedi. **Asıl sebep Ollama'nın bağlamıydı:** varsayılan 4096 token, Jarvis'in talimat+araç isteği ~7000 token; Ollama `server.log`'da `truncating input prompt limit=2050 prompt=7112` → talimatın çoğu, hafıza ve araç tanımları Qwen'e hiç ulaşmıyordu (bu, "tam performans çalışmıyor" hissinin de ana sebebiydi). Düzeltme: Ollama için varsayılan `num_ctx` 16384 (`DEFAULT_OLLAMA_CONTEXT`), yerel modele giden TÜM çağrılar aynı değeri gönderiyor (farklı değer modeli her seferinde yeniden yüklüyordu); kullanıcı onayıyla Windows kullanıcı ortam değişkenleri `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0` → 16K bağlam 41/41 katman GPU'da (10,4 GB). Hafıza: migration 11 (`memories.kind/source/source_conversation_id/reviewed/last_used_at`, `conversation_digests`); `ai/memoryProcessor.ts` bitmiş sohbetlerden **her zaman yerel modelle** bilgi + tarihli özet çıkarır (hassas bilgi filtresi, anlam benzerliğiyle tekilleştirme); `scheduler/memory.ts` kullanıcı ≥2 dk boştayken çalışır, eski sohbetler de işlendi; `ai/recall.ts` her mesajda profil + konuyla ilgili bilgiler + başka sohbetlerin son 2 özetini verir; `gecmiste_ara` aracı; Hafıza Merkezi'nde "Yeni öğrendiklerim", "Şimdi işle", tür seçici. Canlı doğrulandı: Gemini'ye yeni sohbette anlatılan bilgi Qwen'e başka yeni sohbette soruldu, doğru cevaplandı.
- **Tasarım turu (2026-09-29 → 10-01, Claude + Codex birlikte):** plan `docs/superpowers/specs/2026-09-29-tasarim-turu.md` + Codex'in "Smooth Jarvis" raporu. Birleşenler (main, **henüz yayınlanmadı**): 6 sayfalık menü; F0 ortak durum modeli + her sayfada onay (ApprovalDock, `approval` durumu, sonuç türleri); F1 erişilebilirlik (Codex); F2 kürenin yüzü (ışıktan gözler, küçük boyutta gözlü damla, küre hep lila, Ayarlar'da yüz aç/kapa); F3 sakin Ana Sayfa (Codex); F4 Activity Surface (Codex); F5 gezinme/dar pencere (Codex); F6 Jarvis Çentiği (ekranın üst ortası, onay/sonuç/kart, belge bırakma, tam ekranda gizlenir; HUD kaldırıldı, Ctrl+Shift+J çentik); F7 bağlamsal kartlar (`ToolCard`, `ResultCard`); F8 sayfalar (Codex); cevap sonucu veritabanında (migration 12); veritabanı dayanıklılığı (yedek doğrulama, yedek özeti).
- **Sıradaki adım:** performans ölçümü (boşta/konuşurken/tepside CPU-GPU), tam ekran gizlemesini gerçek videoyla denemek, sonra **v1.2.2**: kurulum paketini derleyip test klasörüyle baştan sona denemek, kullanıcı onaylayınca yayın. **Kullanıcının yapacakları:** Google'ı Ayarlar > Google'dan yeniden bağlamak (anahtarlar 30 Eylül olayında okunamaz oldu), Tavily anahtarı. **Açık soru:** 30 Eylül'de gerçek veritabanı bozuldu ve iki farklı geçmiş (A: geliştirme testleri, B: kullanıcının gerçek verisi) aynı klasörde karıştı; sebebi bulunamadı. B korunuyor, A'dan kullanıcı hafızaları eklendi.
- **Kullanıcının yapması gerekenler:** mikrofon giriş seviyesi düşük (~0.01), Windows Ses Ayarları'ndan yükseltilmeli. Dahili kamera 2026-09-28'de Windows'ta "Unknown" (bağlı değil/kapalı) görünüyordu; el kontrolü için açılmalı. Tavily anahtarı eski kayıttan çözülemiyorsa Ayarlar > Servisler'den yeniden girilmeli.
- **Çalışma kuralları (kullanıcı kararları):** her iş ayrı dal + PR; CI geçince onay beklemeden birleştirilir. İndirme (model, büyük paket) ve dışarıya dönük işlemler (açık depo, yayın) önce kullanıcıya sorulur.

### Kalıcı dersler (tekrar yaşanmasın)

- **Geliştirme ayrı veri klasörü kullanır (2026-09-30):** `npm run dev` artık `%APPDATA%\kisisel-asistan-dev` kullanıyor; gerçek veri (`kisisel-asistan`) sadece kurulu uygulamada ya da `JARVIS_REAL_DATA=1` ile. O gün gerçek veritabanı bozuldu ve iki farklı geçmiş karıştı (bozuk dosya `asistan-bozuk-2026-09-30-2245.db`). **Kurulu Jarvis'i kendi kabuğundan başlatma veya zorla kapatma**: senin başlattığın kopya açıkken kullanıcının kısayolu sessizce kapanıyor. CDP artık ana pencereye bağlanır; çentik/HUD için `CDP_HASH=notch` / `CDP_HASH=hud`.
- **Yerel `main`'i güncellemeden iş yapma:** 2026-09-28'de yerel `main` 89 commit gerideydi, ilk analiz eski koda yapıldı. Oturum başında `git fetch && git status` ile kontrol et.
- **Merge'den önce CI kontrollerinin kaydolmasını bekle:** `gh pr checks <no> --watch` kontroller henüz yokken hemen çıkıyor. Kullan: `until [ -n "$(gh pr checks N)" ]; do sleep 5; done; gh pr checks N --watch --fail-fast && gh pr merge N --merge --delete-branch`.
- **Stacked PR tuzağı:** taban dalı silinmezse sonraki PR'ın tabanı `main`'e dönmez; "MERGED" görünse de `main`'e ulaşmamış olabilir (`git log origin/main` ile doğrula).
- **`gh` izin ekleme:** `gh auth refresh -s` bu ortamda tamamlanmıyor; `gh auth login --hostname github.com --git-protocol https --web --skip-ssh-key --scopes <izin>` çalışıyor. `.github/workflows/` göndermek `workflow` izni ister. PowerShell'de `git push` ilerleme çıktısı hata sayılır, ayrı komutla gönder.
- **Paketleme:** önce uygulamayı kapat, `out` ve `dist` sil, paketleme sürerken başka derleme/test çalıştırma (bir kez bozuk asar üretti). Native modüle (onnxruntime) verilen `?asset` yolları paketlide `app.asar.unpacked`'a çevrilmeli (`voice/engines.ts`). Sadece arayüzde kullanılan paket `devDependencies`'e konur (Vite gömüyor, `dependencies` pakete kopyalanır).
- **Yeni sürüm çıkarma:** `npm version X --no-git-tag-version` (PR) → birleşince `main`'den `rm -rf out dist && npm run build:win` → `dist`'teki `setup.exe`, `.blockmap`, `latest.yml` dosyalarını `gh release create vX --repo YuFuSi/jarvis-releases ...` ile yükle → kaynakta `git tag vX`. Kurulu uygulama aynı veri klasörünü kullanır.
- **Ollama:** model dosyası değişince Ollama yeniden başlatılır (eski bilgiyi önbellekte tutuyor). Sohbet "Bad Request" verirse önce Ollama'yı doğrudan dene. **Model "unutkan"/araç seçemiyor gibiyse önce `%LOCALAPPDATA%\Ollama\server.log`'da `truncating input prompt` ara** (istek bağlama sığmıyor demektir). Yerel modele giden her çağrı `getModelOptions()`/`getLocalModelOptions()` kullanmalı; farklı `num_ctx` modeli yeniden yükletir. Yüklü modelin bağlamı ve GPU katmanları: `server.log`'da `n_ctx` ve `offloaded N/41 layers`.
- **CDP:** HUD açıkken `scripts/cdp.mjs` yanlış pencereye bağlanabilir (sayfa değişkeni "kaybolur"). Global kısayollar (`SendKeys`) bu ortamda her zaman uygulamaya ulaşmıyor.
- **İndirmeyi sormadan yapma:** Tur I'de ses paketi ve model önce sorulmadan indirildi; kullanıcı sonradan onayladı, tekrarlanmasın.

## Proje özeti

Windows için yapay zeka destekli kişisel masaüstü asistanı. Asistan sohbet eder. Görev, hatırlatma, not, hafıza, Gmail/Takvim, ses ve bilgisayar kontrolü gibi yetenekleri **araç (tool)** olarak kullanır.

- Kullanıcı Türkçe konuşuyor ve programlamaya yeni başlıyor. Açıklamalar sade Türkçe ve adım adım olmalı.
- Teknoloji kararları bize bırakıldı. Öneri sunulur, kullanıcının kararı gereken yerde sorulur.
- Özellik listesi sınırlı değil. Yeni yetenekler kolayca eklenebilmeli.
- Çalışma şekli: aşama aşama ilerlenir. Her aşamanın sonunda çalışan bir uygulama, doğrulama ve commit olur.

## Yol haritası

Her maddenin ayrıntısı (mimari kararlar, dosyalar, doğrulama) [docs/gecmis.md](docs/gecmis.md) içinde.

- [x] **Aşama 0-4, 6:** iskelet; AI sohbet (Ollama/OpenAI/Gemini/Claude) ve Ayarlar; araç sistemi, görev/hatırlatma/not/hafıza; tepsi, global kısayol, Windows ile başlama; internet ve bilgisayar kontrolü (onay akışı `tools/approval.ts`); ses.
- [x] **Aşama 5: Gmail ve Google Takvim.** Hesap bağlı, okuma/özetleme gerçek hesapla doğrulandı; yanıtlama/arşivleme/etkinlik güncelleme-silme henüz gerçek hesapla denenmedi.
- [x] **Tur A-D, F:** arayüz yenilemesi, sohbet deneyimi (arama, sabitleme, yeniden üretme, başlık üretme), yeni yetenekler (belge okuma, tekrarlayan hatırlatma, pano, sabah özeti), asistanın zekası (araç geçmişi, uzun sohbet özeti, kişiselleştirme, hafıza yönetimi), paketleme. Tur E, Tur G'ye taşındı.
- [x] **Tur G: Sağlam temel.** WAL aktarma, bütünlük kontrolü, günlük yedek ve geri yükleme, `electron-log`, seviyeli araç izinleri (`tools/permissions.ts`), `activity_log`.
- [x] **Tur H: Jarvis arayüzü.** Ad "Jarvis", küre, Ana Sayfa, Takvim sayfası (2026-09-21'de "sakin premium" olarak yeniden tasarlandı).
- [x] **Tur I: Jarvis sesi.** Yerel "Hey Jarvis" (openWakeWord), whisper.cpp, Piper Türkçe, Silero VAD, eller serbest sesli sohbet, söz kesme.
- [x] **Tur J: Otomasyon motoru.** Zaman tabanlı, serbest metin talimatlı rutinler; izni yetmeyen araç atlanıp kaydedilir.
- [x] **Tur K: Hafıza Merkezi 2.0 ve proaktif Jarvis.** `bge-m3` anlamsal arama, 3B hafıza haritası, 4 proaktif kural.
- [~] **Tur L: Bilgisayarı yönetme.** Yapıldı: ekranı görme (`qwen2.5vl:7b`), pencere taşıma/boyutlandırma (araç + el ile sürükleme, kalıcı PowerShell `lib/windowDaemon.ts`). Kalan: geri dönüşüm kutusuna dosya işleri, ayrı profilli tarayıcı otomasyonu, fare/klavye ajanı, uzun görev kuyruğu.
- [ ] **Tur M: Her yerde Jarvis.** MCP istemcisi, Telegram botu, Home Assistant, Spotify, toplantı yardımcısı. **Sıradaki.**
- [x] **Tur N: Analizler ve Başarımlar.** `activity_log` üzerinden istatistik ve rozet sayfaları.
- [x] **Tur O: Kamera ile el kontrolü.** MediaPipe (uygulamayla birlikte gelir), yörünge, pinch, iki alkışla açma, pencere sürükleme, iki elle büyütme.
- [x] **Sürümler:** v1.0.0-beta, v1.1.0-beta, **v1.2.0** (otomatik güncellemeli ilk sürüm).

### Bilinen sınırlamalar ve sonraya kalan fikirler

- Modele sohbet geçmişinden sadece metinler gider. Araç çağrılarının ayrıntısı gönderilmez; asistan gerekirse listeleme araçlarıyla bakar.
- Görevlerde sadece gün var, saat yok. Saatli işler için hatırlatma kullanılıyor.
- Hatırlatmalar 15 saniyelik kontrol aralığı yüzünden en fazla bu kadar gecikebilir.
- `qwen3:14b` Türkçede ara sıra küçük dil bilgisi hataları yapıyor.
- **Uzun belgede otomatik devam okuma güvenilmez:** Ekli uzun belgenin sonu sorulunca `qwen3:14b` bazen `belge_oku` aracını çağırmak yerine "belge_oku 132" gibi düz metin yazıyor veya "okumam gerekiyor" deyip duruyor. Açıkça "10. bölümü belge_oku ile oku" denince aracı doğru çağırıyor (onay kartı dahil test edildi). Bulut modellerinde veya Tur D'deki iyileştirmelerle yeniden denenmeli.
- **Sohbetten tekrarlayan hatırlatma:** Esnek şemadan sonra "Her gün sabah 9'da vitamin almamı hatırlat" isteğiyle hatırlatma hatasız kuruluyor, ama `qwen3:14b` `tekrar` alanını boş bırakıp tek seferlik kurdu. Tekrar, Görevler sayfasındaki seçimle elle ayarlanabilir; bulut modellerinde yeniden denenmeli.
- **Sohbetten rutin (otomasyon) kurma belirsiz olabilir:** "Her gün X saatinde rutin kur" gibi doğal bir istekte `qwen3:14b` bazen `rutin_olustur` yerine `hatirlatma_kur`'u seçiyor veya "böyle bir yeteneğim yok" deyip reddediyor. Açıkça "rutin_olustur aracını kullanarak ... oluştur" denince doğru çağırıyor (Tur J / J5'te test edildi). Bulut modellerinde yeniden denenmeli.
- Araç hataları terminale `Araç hatası (araç_adı): mesaj, girdi` olarak yazılır (`chat.ts` → `tool-error`); modelin araca yanlış girdi gönderdiği durumlar buradan görülür.

## Teknoloji

| Katman | Seçim |
|---|---|
| Masaüstü | Electron 39 + electron-vite 5 |
| Arayüz | React 19 + TypeScript + Tailwind CSS 4 (+ typography), ikonlar `lucide-react` |
| Yapay zeka | Vercel AI SDK **v7** (`ai`), `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/anthropic`, `ollama-ai-provider-v2`, `zod` 4 |
| Veritabanı | SQLite, `better-sqlite3` |
| Markdown | `react-markdown` + `remark-gfm` |
| Test | Vitest 5 (Electron'un Node'u ile), `cross-env` |
| Paketleme | electron-builder (NSIS) |

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Uygulamayı geliştirme modunda açar |
| `npm run typecheck` | TypeScript kontrolü (main + web) |
| `npm run lint` | ESLint + Prettier kuralları |
| `npm run test` | Vitest birim testleri (`src/**/*.test.ts`) |
| `npx prettier --write src scripts` | Kodu biçimlendirir |
| `npx electron-vite build` | Derleme kontrolü (paketlemeden) |
| `npm run build:win` | Windows kurulum dosyası üretir |

## Klasör yapısı

```
src/
├─ shared/
│  ├─ api.ts                Main, preload ve renderer'ın ortak tipleri ve Api arayüzü
│  └─ shortcut.ts           Kısayol yazımı ve klavye olayından accelerator üretme (+ testi)
├─ main/                    Arka plan (Node/Electron)
│  ├─ index.ts              Başlangıç: tek kopya kilidi, veritabanı, pencere, tepsi, kısayol, zamanlayıcı
│  ├─ system/               İşletim sistemiyle ilgili kısımlar
│  │  ├─ window.ts          Ana pencere, kapatınca tepsiye gizleme, showMainWindow, sendCommand
│  │  ├─ tray.ts            Tepsi simgesi ve menüsü
│  │  ├─ shortcut.ts        Global kısayol kaydı, değiştirme, askıya alma
│  │  ├─ startup.ts         Windows ile başlama (--hidden)
│  │  ├─ appSettings.ts     applySettingsPatch (ayarı kaydet ve uygula), getSettingsView
│  │  ├─ database.ts        Güvenli açılış (bütünlük + yedekten geri yükleme), günlük yedek, geri yükleme
│  │  └─ logger.ts          electron-log: günlük dosyası, arayüz hataları, günlük klasörünü açma
│  ├─ activity.ts           recordActivity: etkinlik kaydına yaz ve sayfalara haber ver
│  ├─ ipc.ts                Tüm ipcMain.handle kayıtları
│  ├─ events.ts             notifyDataChanged: "veri değişti" olayını pencerelere gönderir
│  ├─ settings.ts           Ayarlar ve şifreli API anahtarları (safeStorage)
│  ├─ db/index.ts           SQLite bağlantısı (initDatabase/getDb), migration listesi, WAL aktarma, bütünlük
│  ├─ db/backup.ts          Yedek alma, saklama kuralı, dosyayı yedekle değiştirme (+ testi)
│  ├─ scheduler/maintenance.ts  Bakım: 5 dk WAL aktarma, günlük yedek, eski etkinlik kaydı silme
│  ├─ data/                 Veritabanı işlemleri. electron import ETMEZ, bu yüzden test edilebilir.
│  │  ├─ conversations.ts, tasks.ts, reminders.ts, notes.ts, memories.ts, activity.ts
│  │  └─ data.test.ts
│  ├─ tools/                AI araçları (her yetenek bir modül)
│  │  ├─ types.ts           ToolModule = { tools, labels }
│  │  ├─ index.ts           Modül listesi, assistantTools, toolLabel
│  │  ├─ context.ts         Aracın hangi sohbette çalıştığını taşıyan bağlam (AsyncLocalStorage)
│  │  ├─ approval.ts        requireApproval: onay kartı gönderir ve cevabı bekler (+ testi)
│  │  ├─ permissions.ts     needsApproval: risk + kaynak + rutin izni → onay gerekir mi (+ testi)
│  │  └─ tasks.ts, reminders.ts, notes.ts, memory.ts, weather.ts, websearch.ts, system.ts, computer.ts
│  ├─ scheduler/reminders.ts  Zamanı gelen hatırlatmaları Windows bildirimi olarak gösterir
│  ├─ scheduler/brief.ts   Sabah özeti bildirimi (her dakika kontrol, günde bir kez)
│  ├─ google/errors.ts     Google 403 hatalarını Türkçe yol gösteren mesaja çevirir (+ testi)
│  ├─ lib/                  Elektron'a bağlı olmayan, test edilebilir yardımcılar
│  │  ├─ datetime.ts        Yerel tarih/saat okuma ve biçimlendirme (+ testi)
│  │  ├─ weather.ts         Open-Meteo sorguları ve WMO kodları (+ testi)
│  │  ├─ files.ts           Dosya arama (+ testi)
│  │  ├─ apps.ts            Başlat menüsü uygulama listesi, eşleştirme ve açma (+ testi)
│  │  ├─ markdownExport.ts  Sohbeti Markdown metnine çevirme ve dosya adı önerisi (+ testi)
│  │  ├─ documents.ts       PDF/Word/metin okuma ve parçalara bölme (+ testi)
│  │  ├─ repeat.ts          Tekrarlayan hatırlatmanın sonraki zamanı (+ testi)
│  │  ├─ brief.ts           Sabah özeti saati ve bildirim metni (+ testi)
│  │  ├─ toolHistory.ts     Mesajları araç çağrıları ve sonuçlarıyla model geçmişine çevirme (+ testi)
│  │  ├─ memoryRank.ts      Hafıza benzerliği ve alakaya göre sıralama (+ testi)
│  │  └─ title.ts           Modelin ürettiği başlığı temizleme (+ testi)
│  ├─ voice/                Jarvis sesi: pack (+testi), packManager, engines, whisper (+testi), piper,
│  │                        wakeword, vad, session (sesli sohbet), voice.integration.test.ts
│  └─ ai/                   providers.ts (model seçimi, Ollama listesi, bağlantı testi),
│                           chat.ts (sistem talimatı, akışlı cevap, araç takibi), errors.ts (Türkçe hatalar)
├─ preload/index.ts         window.api köprüsü (sadece tanımlı işlemler)
└─ renderer/src/            Arayüz
   ├─ App.tsx               Sayfa geçişi. Sohbet sayfası hep mount'lu kalır, sadece gizlenir.
   ├─ pages/                HomePage, ChatPage, TasksPage, CalendarPage, NotesPage (Hafıza Merkezi), AutomationsPage,
   │                        AnalyticsPage, AchievementsPage, GesturesPage (menüde yok, komut paletinde), SettingsPage
   ├─ components/jarvis/    Orb (canvas küre), Logo
   ├─ components/home/      CommandBox, FloatingTile, AuroraBackground
   ├─ components/activity/  ActivityList (Ayarlar ve Ana Sayfa)
   ├─ components/           Sidebar, TitleBar, CommandPalette, SystemStatusIcons; chat/*, tasks/*, notes/*,
   │                        automations/*, settings/*, ui/* (Button + buttonStyles, Modal, ConfirmDialog, Toggle, Select...)
   └─ lib/                  useLiveData.ts (veri yükle ve değişince yenile), dates.ts,
                            errors.ts (IPC hata öneki temizleme), styles.ts (ortak Tailwind sınıfları)
scripts/cdp.mjs             Electron penceresini test için uzaktan süren yardımcı
vitest.config.ts            Test ayarları
```

## Mimari kurallar

- **IPC:** Yeni bir işlem 3 yere eklenir:
  1. `src/shared/api.ts` içindeki `Api` arayüzü ve tipler
  2. `src/main/ipc.ts` içinde `ipcMain.handle`
  3. `src/preload/index.ts` içinde `ipcRenderer.invoke`

  Kanal adları `alan:işlem` biçiminde. Main'den renderer'a olaylar `webContents.send` ile gider (`chat:event`, `data:changed`).
- **Yeni yetenek (araç) ekleme:**
  1. `src/main/tools/<ad>.ts` dosyasında `ToolModule` yaz: `tools` içinde `tool({ description, inputSchema: z.object(...), execute })`, `labels` içinde arayüz etiketi.
  2. `src/main/tools/index.ts` içindeki `modules` listesine ekle.
  3. Veri gerekiyorsa `src/main/data/<ad>.ts` ekle, `db/index.ts` migration listesine yeni eleman koy, gerekiyorsa `DataScope`'a yeni değer ekle. Veriyi değiştiren araç `notifyDataChanged(scope)` çağırır.
  4. Modülde **her araç için `risks`** (`read`/`write`/`dangerous`) yazılır; eksikse `tools/modules.test.ts` başarısız olur ve sarmalayıcı aracı güvenlik için `dangerous` sayar. Kendi ayrıntılı onay kartını gösteren araç `selfApproval` listesine eklenir; listede olmayan write/dangerous araçlara gerektiğinde genel onay kartı sarmalayıcıda gösterilir. Etkinlik kaydı sarmalayıcıda otomatik yapılır, araç içinde ayrıca yazılmaz.
  5. Araç açıklamaları ve alan açıklamaları Türkçe ve net olmalı. Küçük yerel modeller boş bırakılması gereken isteğe bağlı alanları doldurmaya meyilli, bu yüzden "SADECE kullanıcı söylediyse doldur" gibi yazılır.
- **Riskli araç eklerken:** aracın `execute` fonksiyonunda işi yapmadan önce `await requireApproval({ toolName, label, summary, details })` çağrılır. Onay verilmezse fonksiyon hata fırlatır ve iş yapılmaz.
- **Komut çalıştırma:** rastgele shell komutu çalıştırılmaz. Gerekirse sabit komut + sabit argümanlar kullanılır (`execFile`), modelden gelen metin doğrudan komuta girmez.
- **Veri değişim olayı:** IPC'deki değiştirici işlemler `changing(scope, ...)` ile sarılır. Sayfalar veriyi `useLiveData(load, scope)` ile alır ve kendiliğinden yenilenir.
- **`data/` klasörü** `electron` import etmez. Electron'a bağlı işler `events.ts`, `scheduler/`, `settings.ts`, `ai/` içinde durur.
- **Renderer**, Node/Electron'a doğrudan erişmez, sadece `window.api` kullanır. Ham `ipcRenderer` açılmaz.
- **Veritabanı migration:** `src/main/db/index.ts` içindeki `migrations` dizisinin **sonuna** yeni eleman eklenir. Mevcut elemanlar asla değiştirilmez (`PRAGMA user_version` ile takip edilir). Şu an sürüm 12.
- **Veri güvenliği:** veritabanı dosyasına doğrudan dokunan kod (`db/backup.ts`) sadece veritabanı kapalıyken dosya değiştirir. Yeni zamanlayıcı veya uzun iş, çıkışta `will-quit` içinde durdurulur; `closeDb` en sonda çağrılır.
- **Hata ayıklama:** `console.*` günlük dosyasına da gider; kullanıcıya gösterilmeyen ama sonradan lazım olacak hatalar `console.error` ile yazılır.
- **Zaman:** Hatırlatma zamanı epoch ms (INTEGER), görev son tarihi yerel `YYYY-MM-DD`. Modele ve modelden gelen zamanlar yerel `YYYY-MM-DDTHH:mm` biçimindedir (`lib/datetime.ts`).
- **API anahtarları** sadece main süreçte, `safeStorage` ile şifreli tutulur. Renderer'a sadece `hasApiKey` gider.
- **Dış linkler:** sadece `http(s)` adresler `shell.openExternal` ile açılır. `will-navigate` engellenir.
- **Hatalar:** kullanıcıya Türkçe ve yol gösteren mesaj verilir (`src/main/ai/errors.ts`). Cevap yarıda kalırsa yazılan kısım ve araçlar yine kaydedilir.
- **Yeni AI sağlayıcısı:** `src/shared/api.ts` → `PROVIDERS`, `src/main/ai/providers.ts` → `getModel` switch.

## Kod stili

- Arayüz metinleri ve yorumlar Türkçe. Değişken, fonksiyon ve dosya adları İngilizce. İstisna: AI araç adları ve araç girdileri Türkçe (`gorev_ekle`, `baslik`).
- Prettier kuralları: tek tırnak, noktalı virgül yok, satır genişliği 100. Commit öncesi `npx prettier --write src scripts` çalıştırılır.
- ESLint her fonksiyonda **açık dönüş tipi** ister: `function x(): void`. `.mjs` betiklerinde bu kural kapalı.
- `react-hooks/set-state-in-effect` kuralı var. Effect içinde senkron setState çağrılmaz; veri yüklerken `promise.then(setState)` kullanılır.
- `useLiveData`'ya verilen `load` fonksiyonu **bileşenin dışında** tanımlanır. Aksi halde her render'da yeniden yükleme döngüsü olur.
- Renkler için `zinc-*` / `violet-*` değil, tasarım belirteçleri kullanılır: `bg-app`, `bg-surface`, `bg-elevated`, `border-line`, `text-ink`, `text-muted`, `text-faint`, `bg-accent`, `text-positive`, `text-caution`, `text-negative`.
- Kullanıcıya hata veya başarı bildirimi `useToast()` ile verilir (sohbetteki bağlamsal hata kutusu hariç).
- Tailwind'de aynı özelliği değiştiren iki sınıf (ör. `w-full` ve `w-40`) birlikte kullanılmaz. Bunun için `styles.ts` içinde `inputClass` ve `compactInputClass` ayrı tanımlı.

## AI SDK v7 notları

- `system` yerine `instructions`, `fullStream` yerine `result.stream` kullanılır. Adım sınırı `stopWhen: isStepCount(n)` ile verilir. Varsayılan tek adımdır, araç kullanılacaksa `stopWhen` şart.
- Akış parçaları: `text-delta` (`part.text`), `tool-call` / `tool-result` / `tool-error` (`part.toolCallId`, `part.toolName`), `finish-step`, `error`, `abort`, `finish`.
- **Tip tuzağı:** `tool({ inputSchema, execute })` içinde isteğe bağlı (`.optional()`) alanlar varsa `execute: async ({ a, b }) =>` diye parametre parçalanırsa "No overload matches this call" hatası çıkar. Çözüm: `execute: async (input) =>` yazıp `input.a` kullanmak.
- `APICallError.isInstance(err)` → `statusCode`, `responseBody`. Yeniden denemeler tükenince asıl hata `lastError` içinde durur.
- Ollama sağlayıcısı: `createOllama({ baseURL: 'http://localhost:11434/api' })`. `think: false` varsayılan. Araç desteklemeyen model 400 döner ("does not support tools"), `errors.ts` bunu Türkçeleştirir.

## Native modül: better-sqlite3

- Modül Electron ABI'sine göre derli. `npm install <paket>` postinstall adımını çalıştırmaz. Modül bozulursa `npx electron-builder install-app-deps` çalıştırılır.
- Klasör yolunda boşluk ve "ş" var, bu yüzden kaynaktan derleme (node-gyp) başarısız olabilir. Hazır derlenmiş (prebuilt) binary kullanılıyor.
- Aynı nedenle testler Electron'un Node'u ile çalışır: `cross-env ELECTRON_RUN_AS_NODE=1 electron ./node_modules/vitest/vitest.mjs run`.
- Paket kurduktan sonra hızlı kontrol:
  ```
  $env:ELECTRON_RUN_AS_NODE='1'; npx electron -e "new (require('better-sqlite3'))(':memory:'); console.log('ok')"
  ```

## Test ve doğrulama

1. `npm run typecheck`, `npm run lint`, `npm run test`, `npx electron-vite build`
2. **Birim testleri:** veri katmanı `initDatabase(':memory:')` ile test edilir (`src/main/data/data.test.ts`).
3. **Uçtan uca (E2E):** `.claude/launch.json` dev sunucusunu `--remoteDebuggingPort 9222` ile başlatır. Electron penceresi şöyle sürülür:
   ```
   node scripts/cdp.mjs eval "<js>"          # window.api dahil sayfada JS çalıştır (await destekli)
   node scripts/cdp.mjs waitfor "<js>" [ms]   # ifade doğru olana kadar bekle
   node scripts/cdp.mjs type "<seçici>" "<metin>"
   node scripts/cdp.mjs key Enter                # "Escape", "Ctrl+N" gibi birleşimler de olur
   node scripts/cdp.mjs shot cikti.png        # ekran görüntüsü
   node scripts/cdp.mjs upload "input[type=file]" C:/yol/belge.pdf   # dosya seçme kutusuna gerçek dosya ver
   CDP_HASH=notch node scripts/cdp.mjs drop 48 22 C:/yol/belge.txt   # çentiğe gerçek sürükle-bırak
   ```
   - Browser pane'de `window.api` yok (preload yüklenmez), bu yüzden gerçek test CDP ile yapılır.
   - `window.confirm` gerekiyorsa önce `window.confirm = () => true` yapılır.
   - PowerShell 5.1, programlara giden argümanlardaki çift tırnakları bozar. JS ifadelerinde tek tırnak kullanılır, gerekirse `\'` ile kaçırılır.
   - React kontrollü `<input type="date">` değeri, native value setter ve ardından `input` olayıyla değiştirilir.
   - **Onay kartı testi:** `document.body.innerText.includes('açılsın mı')` ile kart beklenir, sonra metni "Onayla" veya "İptal" olan butona tıklanır. Uygulamanın gerçekten açıldığı `tasklist` ile doğrulanır ve test sonunda kapatılır.
   - **Ters bölü tuzağı:** Bash heredoc veya python ile dosya yazarken `\` işaretleri teke iniyor. Ters bölü içeren içerik (Windows yolları, regex) Write aracıyla yazılmalı.
   - Test için oluşturulan veriler (görev, hatırlatma, hafıza vb.) test sonunda **silinir**. Gerçek hatırlatmalar bildirim gösterir, sahte hafıza kayıtları asistanı yanıltır.
   - `eval` verilen ifadeyi `(...)` içine alır; birden çok satır gerekiyorsa `(async () => { ... })()` yazılır.
   - `type` metni imlecin olduğu yere **ekler**. Dolu bir kutunun içeriğini değiştirmek için önce `eval` ile `el.focus(); el.select()` yapılır.
   - **Native pencereler** (ör. "Sohbeti kaydet" kaydetme penceresi) CDP ile sürülemez. Önce arka planda başlatılır (`window.__x = api...(); ` şeklinde beklenmeden), sonra PowerShell'den `(New-Object -ComObject WScript.Shell).AppActivate('Sohbeti kaydet')` ile öne alınıp `SendKeys` ile yol yazılır. AppActivate olmadan tuşlar başka pencereye gider.
   - **Tepsiye gizleme:** sayfada `window.close()` çalıştırılır.
   - **Görünürlük ölçümü:** hiç gösterilmemiş pencerede (`--hidden`) `document.visibilityState` yanıltıcı biçimde `visible` olabilir. Gerçek görünürlük `Get-Process kisisel-asistan | Where-Object MainWindowHandle -ne 0` ile kontrol edilir.
   - **Global kısayol:** gerçek tuş basımıyla test edilir: `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^+ ')` (Ctrl+Shift+Space).
   - **Tek kopya:** uygulama açıkken `node_modules\electron\dist\electron.exe .` başlatılır. İkinci kopya hemen kapanmalı, mevcut pencere öne gelmeli.
   - **Tepsi simgesi ve menüsü** otomatik test edilemiyor, gözle kontrol gerekir.
   - **Uzun komut tuzağı:** Çok uzun bash komutları (büyük heredoc'lar) kesilip "unexpected EOF" hatası veriyor. Büyük dosyaları Write aracıyla yaz; Write "file modified" derse dosyayı silip yeniden oluştur.
   - **Büyük harf tuzağı:** Ayarlar'daki bölüm başlıkları CSS `uppercase` kullanıyor; `innerText` "SON İŞLEMLER" döner. Metin beklerken başlık yerine içerikteki bir cümle veya `textContent` kullanılır.
   - **Yerel onay penceresi (dialog.showMessageBox):** CDP'den işlemi beklemeden başlat (`window.__x = api...()`), sonra `AppActivate('<pencere başlığı>')` + `SendKeys('{ESC}')` ile Vazgeç; ardından `await window.__x`.
   - **Sohbet "Bad Request" verirse** önce Ollama'nın kendisini dene: `curl http://localhost:11434/api/chat ...` ve `%LOCALAPPDATA%\Ollama\server.log`. 2026-09-14'te sebep eksik model dosyasıydı (kod değil).
   - **Geliştirme sunucusu ana süreci yeniden başlatmaz:** `src/main` değişince uygulama eski kodla çalışmaya devam eder (günlükte yeni "Jarvis başladı" satırı olmaz). Ana süreç değişikliğini denemek için `preview_stop` + `preview_start`.
   - **Sesli sohbeti mikrofonsuz test etme:** Piper ile WAV üret (`piper.exe --json-input`), geçici olarak `src/renderer/public/` altına koy (sunucu açılmadan önce; klasör test sonunda silinir). Sayfada önce `window.api.settings.update({ wakeWordEnabled: false })`, sonra `navigator.mediaDevices.getUserMedia = () => Promise.reject(...)` (gerçek mikrofonun parçaları araya karışmasın), `fetch('/x.wav')` → `new OfflineAudioContext(1, 1, 16000).decodeAudioData` (16 kHz'e çevirir) → 1280'lik parçalar 80 ms arayla `window.api.voice.pushAudio`. Uyandırmadan önce ~1,5 sn sessizlik ver (model 76 mel + 16 gömme penceresi doldurmalı). Olaylar `window.api.voice.onEvent` ile toplanır.
   - **Mikrofon gerçekten ses veriyor mu:** sayfada `getUserMedia` + `AnalyserNode.getFloatTimeDomainData` ile birkaç saniye tepe değeri ölç; tam 0 ise sorun uygulamada değil donanım/sürücüde. Hoparlörden ses çalmak için `(New-Object System.Media.SoundPlayer '<wav>').PlaySync()`.
   - PowerShell komutunda JavaScript metni (`'/'` gibi) ile `Remove-Item` bir arada olursa güvenlik denetimi komutu "sistem yolu siliniyor" diye engelliyor. Silme işlemi ayrı ve sade bir komutla yapılır.
4. Aşama tamamlanınca commit atılır. Commit mesajı Türkçe olur ve `Co-Authored-By` satırı eklenir.

## Ortam

- Windows 11, Node 24, npm 11. Electron'un içindeki Node sürümü 22.22.
- RTX 4080 Laptop (12 GB VRAM), 32 GB RAM, i9-14900HX
- Ollama modelleri:
  - `qwen3:14b`: genel amaçlı, **seçili**. Araç çağırma iyi; cevap yaklaşık 2-15 saniye.
  - `qwen2.5-coder:14b`: kodlama modeli.
  - `qwen3-coder:30b`: 12 GB'a sığmıyor, ilk yükleme yaklaşık 1 dakika sürüyor.
  - `qwen2.5vl:7b` (6 GB, Apache 2.0): görüntü modeli, sadece `ekrani_gor` aracı kullanıyor. `qwen3:14b` ile aynı anda VRAM'e sığmıyor; Ollama gerektiğinde değiştiriyor.
  - `bge-m3` (1,2 GB, MIT): gömme (embedding) modeli, anlamsal arama için (`ai/embeddings.ts`). 1024 boyutlu vektör üretiyor. Sohbet modelleriyle karışmaz, `/api/embed` üzerinden ayrı çağrılıyor.
- Windows'ta yüklü tek konuşma sesi: "Microsoft Tolga - Turkish (Turkey)" (tr-TR). Sesli okuma bunu kullanıyor.
- Mikrofon: Intel Smart Sound dijital mikrofon dizisi; Electron izni verildi.
- Uygulama verisi: `%APPDATA%\kisisel-asistan\asistan.db`

## Kullanıcıdan gerekecekler

- Tavily ve Google hesabı bağlı. Bulut modelleri (OpenAI/Gemini/Claude) ve Groq konuşma tanıma için anahtarlar isteğe bağlı; yerel whisper anahtarsız çalışıyor.
- Tur M (Telegram vb.) başlarsa: bot anahtarı gibi kimlik bilgilerini kullanıcı kendisi Ayarlar'a girer.
