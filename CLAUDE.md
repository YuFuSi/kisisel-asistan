# Kişisel Asistan: Proje Notları

> Bu dosya projenin hafızası. Claude Code her oturumun başında otomatik okur.
> Her aşama bitince **Nerede kaldık** ve **Yol haritası** bölümleri güncellenir.

## Nerede kaldık

- **Son güncelleme:** 2026-09-12
- **Tamamlanan:** Aşama 0-4. Aşama 5'in (Gmail ve Takvim) kodu yazıldı ve commit'lendi, ama kullanıcı Google hesabını bağlayana kadar uçtan uca test edilemedi.
- **Sıradaki adım:** Kullanıcı Google Cloud'da OAuth istemcisi oluşturup Ayarlar'a girecek, hesabı bağlayacak. Sonra Gmail ve Takvim uçtan uca test edilip Aşama 6'ya (ses) geçilecek.
- **Uygulamanın durumu:**
  - Ayarlar: sağlayıcı Ollama, model `qwen3:14b`. Kapatınca tepside kalma açık, kısayol `Ctrl+Shift+Space`, Windows ile başlama kapalı.
  - **Tavily anahtarı girilmedi.** Kullanıcı anahtarı sohbete yazdı; kimlik bilgilerini ben uygulamaya girmiyorum, kullanıcı Ayarlar > Servisler bölümünden kendisi girecek. O zamana kadar internette arama Türkçe bir hata döndürür.
  - **Google hesabı bağlı değil.** Gmail ve Takvim araçları kullanıcıyı Ayarlar'a yönlendiren hata veriyor.
  - `dist/win-unpacked` içinde Aşama 3'ün test paketi duruyor (git'e girmez).
  - Tepsi simgesi ve sağ tık menüsü otomatik test edilemedi; kullanıcının gözle kontrol etmesi istendi.
  - Sohbet listesinde kullanıcının kendi başlattığı bir sohbet var; test sohbetleri silindi.

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
- [x] **Aşama 3: Tepsi, kısayol, başlangıç.** Kodlar `src/main/system/` altında.
  - **Tepsi** (`tray.ts`): simge ve menü (Aç, Yeni sohbet, Windows açılınca başlat, Çıkış). Tek tık pencereyi açar.
  - **Kapatınca tepside kalma** (`window.ts`): X'e basınca pencere gizlenir (ayar: `closeToTray`, varsayılan açık). İlk seferde bir kez bilgi bildirimi çıkar (`flag:trayHintShown`). Gerçek çıkış için `markQuitting()` çağrılır (tepsi Çıkış, `before-quit`, Windows kapanışı / `session-end`).
  - **Global kısayol** (`shortcut.ts`): varsayılan `CommandOrControl+Shift+Space`. Pencere öndeyse gizler, değilse gösterir ve `focus-chat` komutuyla sohbet kutusuna odaklanır. Ayarlar'da tuşlara basarak kaydedilir; kayıt sırasında mevcut kısayol askıya alınır. Alınamayan kısayolda eski kısayol korunur ve Türkçe hata verilir.
  - **Windows ile başlama** (`startup.ts`): `app.setLoginItemSettings({ openAtLogin, args: ['--hidden'] })`. `--hidden` ile başlarsa pencere açılmaz. Sadece `app.isPackaged` iken etkin, geliştirme modunda arayüzde pasif görünür.
  - **Tek kopya** (`index.ts`): `requestSingleInstanceLock`. İkinci açılışta mevcut pencere öne gelir.
  - **Ayar uygulama** (`appSettings.ts`): `applySettingsPatch` ayarı kaydedip sisteme uygular ve `data:changed('settings')` gönderir. Tepsi menüsünden yapılan değişiklik Ayarlar sayfasına da yansır.
  - **Arayüz komutları:** `app:command` kanalıyla `focus-chat` ve `new-chat` gider (`AppCommand`).
- [x] **Aşama 4: İnternet ve bilgisayar kontrolü.**
  - Araçlar: `hava_durumu` (Open-Meteo, anahtarsız), `web_ara` (Tavily, anahtar gerekir), `sistem_bilgisi` (`systeminformation`), `url_ac`, `uygulama_ac` (onaylı), `dosya_bul`, `dosya_ac` (onaylı).
  - **Onay akışı:** riskli araç, `requireApproval` ile arayüze onay kartı gönderip cevabı bekler (`src/main/tools/approval.ts`). Kullanıcı reddederse veya 2 dakika cevap gelmezse araç hata fırlatır ve işlem yapılmaz. Sohbet durdurulunca bekleyen onaylar iptal edilir.
  - **Neden AI SDK'nın kendi onayı değil:** v7'de `needsApproval` var ama akışı onay cevabıyla yeniden kurmayı gerektiriyor. Araç içinde beklemek daha basit ve sağlayıcıdan bağımsız.
  - Araç hangi sohbette çalıştığını `AsyncLocalStorage` ile öğrenir (`src/main/tools/context.ts`); böylece aynı anda birden fazla sohbet cevap yazsa da onay kartı doğru pencereye gider.
  - **Uygulama açma:** Windows 11'de Not Defteri gibi Mağaza uygulamalarının Başlat menüsünde `.lnk` dosyası yok. Bu yüzden uygulamalar `Get-StartApps` listesinden bulunur ve `explorer.exe shell:AppsFolder\<AppID>` ile açılır (`src/main/lib/apps.ts`). Çalıştırılan komut sabittir, modelin yazdığı metin komuta girmez; kimlik listeden gelir ve karakter kontrolünden geçer.
  - Gizli anahtarlar artık sadece AI sağlayıcıları için değil: `SecretId` (`openai`, `google`, `anthropic`, `tavily`) ve `settings.setSecret` kullanılıyor. Ayarlar'daki "Servisler" bölümü Tavily anahtarını alır.
- [ ] **Aşama 5: Gmail ve Google Takvim.** Kod yazıldı; hesap bağlanınca test edilecek.
  - **Bağlantı** (`src/main/google/auth.ts`): PKCE'li OAuth. Tarayıcıda Google giriş sayfası açılır, cevap `127.0.0.1` üzerindeki geçici sunucuda alınır (port işletim sisteminden istenir, `state` doğrulanır).
  - Yenileme anahtarı `google-refresh-token` gizli anahtarı olarak şifreli saklanır; erişim anahtarı bellekte tutulup süresi dolunca yenilenir. `invalid_grant` gelirse kayıt silinir ve kullanıcıya yeniden bağlanması söylenir.
  - İzinler: `gmail.readonly`, `gmail.compose`, `gmail.send`, `calendar.events`.
  - **İstek katmanı** (`src/main/google/api.ts`): erişim anahtarı, zaman aşımı, 401/403/429 için Türkçe mesajlar.
  - **Araçlar:** `epostalari_ozetle`, `eposta_ara`, `eposta_oku`, `taslak_olustur`, `eposta_gonder` (onaylı), `takvim_listele`, `etkinlik_ekle` (onaylı).
  - E-posta metni `src/main/lib/mime.ts` ile kurulur: Türkçe başlıklar encoded-word, gövde base64, tamamı base64url. Başlıklardaki satır sonları temizlenir (başlık enjeksiyonu önlenir).
  - Ayarlar'daki "Google hesabı" bölümü istemci kimliği ile gizli anahtarı alır, bağla/bağlantıyı kes düğmelerini gösterir.
  - **Kullanıcının yapması gerekenler:** Google Cloud'da proje, Gmail + Calendar API etkinleştirme, OAuth izin ekranı (Harici + kendi adresi test kullanıcısı), "Masaüstü uygulaması" türünde OAuth istemcisi.
- [ ] **Aşama 6: Ses.** Mikrofon, Whisper (OpenAI/Groq) ile yazıya çevirme; `speechSynthesis` veya OpenAI TTS ile sesli okuma.
- [ ] **Aşama 7: Paketleme.** `npm run build:win` ile .exe kurulum dosyası.
  - Aşama 3'te `npm run build:unpack` ile paketli uygulama denendi. Uygulama açılıyor; "Windows ile başlat" kaydı ekleniyor ve siliniyor.
  - **Dikkat 1, bozuk asar:** İlk paketleme, geliştirme sunucusu ve testler çalışırken arka planda yapıldı. Çıkan `app.asar` bozuktu: dosya konumları 1011 bayt kaymıştı ve uygulama 0,3 saniyede kod 1 ile, hiç log yazmadan kapanıyordu. Temiz derlemede sorun çıkmadı, ama kesin neden kanıtlanmadı. **Kural:** paketlemeden önce uygulamayı kapat, `out` ve `dist` klasörlerini sil, paketleme sürerken başka derleme veya test çalıştırma.
  - **Elenen yanlış tahminler:** ESM paketleri (`ai`, `@ai-sdk/*`) asar içinden sorunsuz yükleniyor. Türkçe karakterli klasör yolu da sorun değil. Bunlar tekrar araştırılmasın.
  - **Dikkat 2, sürüm düzleştirme:** electron-builder aynı paketin iki sürümünü tek yola yazıyor (ör. `escape-string-regexp` v4 ve v5). Temiz derlemede de asar'daki yaklaşık 100 dosya diskteki kopyadan farklı. Kurulum dosyasında sohbetin (ai, @ai-sdk, undici) gerçekten çalıştığı ayrıca test edilmeli.
  - `out/renderer/assets` eski derlemelerin dosyalarını biriktiriyor. Paketlemeden önce `out` silinmeli.
  - Paketli uygulamayı CDP ile test etmek için: `kisisel-asistan.exe --remote-debugging-port=9223`, ardından `$env:CDP_PORT='9223'; node scripts/cdp.mjs ...`

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
│  │  └─ appSettings.ts     applySettingsPatch (ayarı kaydet ve uygula), getSettingsView
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
│  │  ├─ context.ts         Aracın hangi sohbette çalıştığını taşıyan bağlam (AsyncLocalStorage)
│  │  ├─ approval.ts        requireApproval: onay kartı gönderir ve cevabı bekler (+ testi)
│  │  └─ tasks.ts, reminders.ts, notes.ts, memory.ts, weather.ts, websearch.ts, system.ts, computer.ts
│  ├─ scheduler/reminders.ts  Zamanı gelen hatırlatmaları Windows bildirimi olarak gösterir
│  ├─ lib/                  Elektron'a bağlı olmayan, test edilebilir yardımcılar
│  │  ├─ datetime.ts        Yerel tarih/saat okuma ve biçimlendirme (+ testi)
│  │  ├─ weather.ts         Open-Meteo sorguları ve WMO kodları (+ testi)
│  │  ├─ files.ts           Dosya arama (+ testi)
│  │  └─ apps.ts            Başlat menüsü uygulama listesi, eşleştirme ve açma (+ testi)
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
- **Riskli araç eklerken:** aracın `execute` fonksiyonunda işi yapmadan önce `await requireApproval({ toolName, label, summary, details })` çağrılır. Onay verilmezse fonksiyon hata fırlatır ve iş yapılmaz.
- **Komut çalıştırma:** rastgele shell komutu çalıştırılmaz. Gerekirse sabit komut + sabit argümanlar kullanılır (`execFile`), modelden gelen metin doğrudan komuta girmez.
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
   - **Onay kartı testi:** `document.body.innerText.includes('açılsın mı')` ile kart beklenir, sonra metni "Onayla" veya "İptal" olan butona tıklanır. Uygulamanın gerçekten açıldığı `tasklist` ile doğrulanır ve test sonunda kapatılır.
   - **Ters bölü tuzağı:** Bash heredoc veya python ile dosya yazarken `\` işaretleri teke iniyor. Ters bölü içeren içerik (Windows yolları, regex) Write aracıyla yazılmalı.
   - Test için oluşturulan veriler (görev, hatırlatma, hafıza vb.) test sonunda **silinir**. Gerçek hatırlatmalar bildirim gösterir, sahte hafıza kayıtları asistanı yanıltır.
   - **Tepsiye gizleme:** sayfada `window.close()` çalıştırılır.
   - **Görünürlük ölçümü:** hiç gösterilmemiş pencerede (`--hidden`) `document.visibilityState` yanıltıcı biçimde `visible` olabilir. Gerçek görünürlük `Get-Process kisisel-asistan | Where-Object MainWindowHandle -ne 0` ile kontrol edilir.
   - **Global kısayol:** gerçek tuş basımıyla test edilir: `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^+ ')` (Ctrl+Shift+Space).
   - **Tek kopya:** uygulama açıkken `node_modules\electron\dist\electron.exe .` başlatılır. İkinci kopya hemen kapanmalı, mevcut pencere öne gelmeli.
   - **Tepsi simgesi ve menüsü** otomatik test edilemiyor, gözle kontrol gerekir.
   - PowerShell komutunda JavaScript metni (`'/'` gibi) ile `Remove-Item` bir arada olursa güvenlik denetimi komutu "sistem yolu siliniyor" diye engelliyor. Silme işlemi ayrı ve sade bir komutla yapılır.
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
