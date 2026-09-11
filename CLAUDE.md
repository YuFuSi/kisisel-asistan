# Kişisel Asistan: Proje Notları

> Bu dosya projenin hafızası. Claude Code her oturumun başında otomatik okur.
> Her aşama bitince **Nerede kaldık** ve **Yol haritası** bölümleri güncellenir.

## Nerede kaldık

- **Son güncelleme:** 2026-09-11
- **Tamamlanan:** Aşama 0, 1 ve 2. Son commit "Aşama 2: Araç sistemi, görevler, hatırlatmalar, notlar, hafıza".
- **Sıradaki adım:** Aşama 3 (sistem tepsisi, global kısayol, Windows ile başlama).
- **Uygulamanın durumu:**
  - Ayarlarda sağlayıcı Ollama, model `qwen3:14b` seçili.
  - Test verileri temizlendi. Aşama 1'den kalan 2 örnek sohbet duruyor, kullanıcı isterse silebilir.

## Proje özeti

Windows için yapay zeka destekli kişisel masaüstü asistanı. Asistan sohbet eder. Görev, hatırlatma, not, hafıza, Gmail/Takvim, ses ve bilgisayar kontrolü gibi yetenekleri **araç (tool)** olarak kullanır.

- Kullanıcı Türkçe konuşuyor ve programlamaya yeni başlıyor. Açıklamalar sade Türkçe ve adım adım olmalı.
- Teknoloji kararları bize bırakıldı. Öneri sunulur, kullanıcının kararı gereken yerde sorulur.
- Özellik listesi sınırlı değil. Yeni yetenekler kolayca eklenebilmeli.
- Çalışma şekli: aşama aşama ilerlenir. Her aşamanın sonunda çalışan bir uygulama, doğrulama ve commit olur.

## Yol haritası

- [x] **Aşama 0: İskelet.** Electron + React + TS + Tailwind, yan menü ve sayfalar.
- [x] **Aşama 1: AI sohbet ve Ayarlar.** Seçilebilir sağlayıcı (Ollama/OpenAI/Gemini/Claude), akışlı cevap, durdurma, Markdown, SQLite'ta sohbet geçmişi, şifreli API anahtarı, bağlantı testi.
- [x] **Aşama 2: Araç sistemi, görevler, hatırlatmalar, notlar, hafıza.**
  - `src/main/tools/` araç modülleri. Sohbette `streamText({ tools, stopWhen: isStepCount(6) })` kullanılıyor.
  - Araçlar: `gorev_ekle`, `gorevleri_listele`, `gorev_tamamla`, `hatirlatma_kur`, `hatirlatmalari_listele`, `hatirlatma_iptal`, `not_kaydet`, `notlarda_ara`, `hafizaya_kaydet`
  - Hafıza kayıtları her sohbette sistem talimatına eklenir. Şu anki tarih ve saat de talimatta verilir.
  - Zamanlayıcı her 15 saniyede zamanı gelen hatırlatmayı Windows bildirimi olarak gösterir. Uygulama kapalıyken kaçırılanlar açılışta "Kaçırılan hatırlatma" başlığıyla gelir.
  - Sayfalar:
    - Görevler: ekleme, tarih seçme, tamamlama, çift tıkla düzenleme, silme, hatırlatmalar.
    - Notlar: otomatik kayıt, arama, "Asistanın hafızası" sekmesi.
  - Veri değişince (asistan eklese bile) sayfalar `data:changed` olayıyla kendiliğinden yenilenir.
  - Sohbette kullanılan araçlar "✓ Görev ekleme" gibi etiketlerle görünür ve mesajla birlikte saklanır.
- [ ] **Aşama 3: Tepsi, kısayol, başlangıç.**
  - Tepsi ikonu ve menüsü (Aç, Yeni sohbet, Çıkış). Pencere kapatılınca uygulama tepside kalır. Hatırlatmaların uygulama açık değilken de çalışması için bu gerekli.
  - `Ctrl+Shift+Space` global kısayol (ayarlardan değiştirilebilir), `app.setLoginItemSettings` ile Windows ile başlama, `requestSingleInstanceLock` ile tek kopya çalışma.
  - Şu an `src/main/index.ts` içinde `window-all-closed` uygulamayı kapatıyor. Aşama 3'te değişecek.
- [ ] **Aşama 4: İnternet ve bilgisayar kontrolü.**
  - Hava durumu (Open-Meteo, anahtarsız), web arama (Tavily), sistem bilgisi (`systeminformation`), uygulama/URL açma, dosya bulma.
  - Riskli araçlar onay kartı ister (AI SDK v7'nin `toolApproval`/`needsApproval` desteğine bakılacak). Rastgele shell komutu çalıştırılmaz.
- [ ] **Aşama 5: Gmail ve Google Takvim.** OAuth (Desktop app, loopback). Mail özetleme/arama/taslak, gönderme (onaylı), takvim listeleme/ekleme (onaylı).
- [ ] **Aşama 6: Ses.** Mikrofon, Whisper (OpenAI/Groq) ile yazıya çevirme; `speechSynthesis` veya OpenAI TTS ile sesli okuma.
- [ ] **Aşama 7: Paketleme.** `npm run build:win` ile .exe kurulum dosyası.

Ayrıntılı ilk plan: `C:\Users\ysfll\.claude\plans\imdi-bana-bir-ki-isel-memoized-wadler.md`

### Bilinen sınırlamalar ve sonraya kalan fikirler

- Modele sohbet geçmişinden sadece metinler gider. Araç çağrılarının ayrıntısı gönderilmez; asistan gerekirse listeleme araçlarıyla bakar.
- Görevlerde sadece gün var, saat yok. Saatli işler için hatırlatma kullanılıyor.
- Hatırlatmalar 15 saniyelik kontrol aralığı yüzünden en fazla bu kadar gecikebilir.
- `qwen3:14b` Türkçede ara sıra küçük dil bilgisi hataları yapıyor.

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
├─ shared/api.ts            Main, preload ve renderer'ın ortak tipleri ve Api arayüzü
├─ main/                    Arka plan (Node/Electron)
│  ├─ index.ts              Pencere, uygulama yaşam döngüsü, veritabanı ve zamanlayıcıyı başlatma
│  ├─ ipc.ts                Tüm ipcMain.handle kayıtları
│  ├─ events.ts             notifyDataChanged: "veri değişti" olayını pencerelere gönderir
│  ├─ settings.ts           Ayarlar ve şifreli API anahtarları (safeStorage)
│  ├─ db/index.ts           SQLite bağlantısı (initDatabase/getDb) ve migration listesi
│  ├─ data/                 Veritabanı işlemleri. electron import ETMEZ, bu yüzden test edilebilir.
│  │  ├─ conversations.ts, tasks.ts, reminders.ts, notes.ts, memories.ts
│  │  └─ data.test.ts
│  ├─ tools/                AI araçları (her yetenek bir modül)
│  │  ├─ types.ts           ToolModule = { tools, labels }
│  │  ├─ index.ts           Modül listesi, assistantTools, toolLabel
│  │  └─ tasks.ts, reminders.ts, notes.ts, memory.ts
│  ├─ scheduler/reminders.ts  Zamanı gelen hatırlatmaları Windows bildirimi olarak gösterir
│  ├─ lib/datetime.ts       Yerel tarih/saat okuma ve biçimlendirme (+ testi)
│  └─ ai/                   providers.ts (model seçimi, Ollama listesi, bağlantı testi),
│                           chat.ts (sistem talimatı, akışlı cevap, araç takibi), errors.ts (Türkçe hatalar)
├─ preload/index.ts         window.api köprüsü (sadece tanımlı işlemler)
└─ renderer/src/            Arayüz
   ├─ App.tsx               Sayfa geçişi. Sohbet sayfası hep mount'lu kalır, sadece gizlenir.
   ├─ pages/                ChatPage, TasksPage, NotesPage, SettingsPage
   ├─ components/           Sidebar; chat/*, tasks/*, notes/*, settings/*
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
  4. Araç açıklamaları ve alan açıklamaları Türkçe ve net olmalı. Küçük yerel modeller boş bırakılması gereken isteğe bağlı alanları doldurmaya meyilli, bu yüzden "SADECE kullanıcı söylediyse doldur" gibi yazılır.
- **Veri değişim olayı:** IPC'deki değiştirici işlemler `changing(scope, ...)` ile sarılır. Sayfalar veriyi `useLiveData(load, scope)` ile alır ve kendiliğinden yenilenir.
- **`data/` klasörü** `electron` import etmez. Electron'a bağlı işler `events.ts`, `scheduler/`, `settings.ts`, `ai/` içinde durur.
- **Renderer**, Node/Electron'a doğrudan erişmez, sadece `window.api` kullanır. Ham `ipcRenderer` açılmaz.
- **Veritabanı migration:** `src/main/db/index.ts` içindeki `migrations` dizisinin **sonuna** yeni eleman eklenir. Mevcut elemanlar asla değiştirilmez (`PRAGMA user_version` ile takip edilir). Şu an sürüm 2.
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
   node scripts/cdp.mjs key Enter
   node scripts/cdp.mjs shot cikti.png        # ekran görüntüsü
   ```
   - Browser pane'de `window.api` yok (preload yüklenmez), bu yüzden gerçek test CDP ile yapılır.
   - `window.confirm` gerekiyorsa önce `window.confirm = () => true` yapılır.
   - PowerShell 5.1, programlara giden argümanlardaki çift tırnakları bozar. JS ifadelerinde tek tırnak kullanılır, gerekirse `\'` ile kaçırılır.
   - React kontrollü `<input type="date">` değeri, native value setter ve ardından `input` olayıyla değiştirilir.
   - Test için oluşturulan veriler (görev, hatırlatma, hafıza vb.) test sonunda **silinir**. Gerçek hatırlatmalar bildirim gösterir, sahte hafıza kayıtları asistanı yanıltır.
4. Aşama tamamlanınca commit atılır. Commit mesajı Türkçe olur ve `Co-Authored-By` satırı eklenir.

## Ortam

- Windows 11, Node 24, npm 11. Electron'un içindeki Node sürümü 22.22.
- RTX 4080 Laptop (12 GB VRAM), 32 GB RAM, i9-14900HX
- Ollama modelleri:
  - `qwen3:14b`: genel amaçlı, **seçili**. Araç çağırma iyi; cevap yaklaşık 2-15 saniye.
  - `qwen2.5-coder:14b`: kodlama modeli.
  - `qwen3-coder:30b`: 12 GB'a sığmıyor, ilk yükleme yaklaşık 1 dakika sürüyor.
- Uygulama verisi: `%APPDATA%\kisisel-asistan\asistan.db`

## Kullanıcıdan gerekecekler (zamanı gelince)

- Aşama 4: Tavily API anahtarı (web arama)
- Aşama 5: Google Cloud OAuth istemcisi (Desktop app). Ekran ekran rehber verilecek.
- Aşama 6: Ses tanıma için OpenAI veya Groq API anahtarı
- İsteğe bağlı: OpenAI, Gemini veya Claude API anahtarı (bulut modelleri için)
