# Kişisel Asistan: Proje Notları

> Bu dosya projenin hafızası. Claude Code her oturumun başında otomatik okur.
> Her aşama bitince **Nerede kaldık** ve **Yol haritası** bölümleri güncellenir.

## Nerede kaldık

- **Son güncelleme:** 2026-09-15
- **Tamamlanan:** Aşama 0-4 ve 6. Aşama 5'in kodu hazır (hesap bağlanınca test edilecek). Bölüm 2'de **Tur A, B, C, D ve F** bitti. **v1.0.0-beta** kurulum dosyası çıktı ve kullanıcının bilgisayarına kuruldu (`git tag v1.0.0-beta`). **Bölüm 3 (Jarvis): Tur G, Tur H ve Tur I artık `main`'de** (2026-09-15, PR #5 ile). Uygulama artık "Jarvis" kimliğinde: küre, mavi tema, Ana Sayfa, Takvim sayfası, yerel ses (uyandırma kelimesi, whisper.cpp, Piper Türkçe TTS) hepsi `main`'de.
- **Stacked-PR tuzağı (2026-09-14/15, çözüldü):** PR #3 (Tur H) ve #4 (Tur I) GitHub'da "MERGED" görünüyordu ama tabanları sırasıyla `tur-g/saglam-temel` ve `tur-h/jarvis-arayuz` idi (`main` değil) — ara dallar silinmediği için GitHub tabanı otomatik `main`'e çevirmedi, zincir `main`'e hiç ulaşmamıştı. **Ders:** stacked PR'larda bir PR merge edildikten sonra taban dalı silinmezse (`--delete-branch` kullanılmazsa veya elle silinmezse) bir sonraki PR'ın tabanı otomatik güncellenmez; `main`'e gerçekten ulaştığını `git log origin/main --oneline` ile doğrulamadan "birleşti" varsayılmamalı. Çözüm: `tur-i/jarvis-sesi` (içerik olarak `tur-h`'nin GitHub'daki merge commit'iyle birebir aynı) üzerinden doğrudan `main`'e yeni bir PR (#5) açılıp CI sonrası birleştirildi.
- **GitHub:** gizli depo `YuFuSi/kisisel-asistan`. `gh` CLI kurulu (`C:\Program Files\GitHub CLI\gh.exe`, PATH'e yeni oturumda girer) ve hesaba bağlı (izinler: `repo`, `workflow`, `read:org`, `gist`). Her tur ayrı dalda yapılır ve PR açılır. **İzin ekleme tuzağı:** bu ortamda `gh auth refresh -s <izin>` kodu gösteriyor ama kullanıcı onaylasa da hiç tamamlanmıyor; çalışan yol `gh auth login --hostname github.com --git-protocol https --web --skip-ssh-key --scopes <izin>` (arka planda çalıştır, kodu kullanıcıya ver). `.github/workflows/` altındaki dosyaları göndermek `workflow` izni ister. PowerShell'de `git push` ilerleme çıktısı hata sayılır ve `if ($?)` zinciri durur; gönderimleri ayrı komutlarla yap. Uygulamanın PR çubuğu (`ccd_pr` bağlama) bu depoyu tanımıyor; CI `gh pr checks <no> --watch` ile arka planda izlenir. CI: `.github/workflows/ci.yml` (Windows koşucusu; typecheck, lint, test, build). **Kullanıcı kararı (2026-09-15): her işlem sonunda CI geçtiyse PR'lar onay beklemeden birleştirilebilir.**
- **Mikrofon sessiz (2026-09-14):** Uygulamada mikrofon açılıyor ama ses **tam sıfır** geliyor (ham ve işlenmiş `getUserMedia`, 48 kHz, tepe 0,0000). Windows gizlilik kayıtları `Allow` (genel ve masaüstü uygulamaları). Muhtemel neden donanım/sürücü düzeyinde kapalı mikrofon (klavyedeki mikrofon kapatma tuşu veya Ses ayarlarında giriş seviyesi 0). Kullanıcı açınca "Hey Jarvis" gerçek mikrofonla denenmeli. Sistem durumu kartındaki "Mikrofon: Hazır" sadece cihazın varlığına bakıyor, sessizliği görmüyor.
- **Sıradaki adım:** Basitleştirilmiş yol haritası (`C:\Users\ysfll\.claude\plans\imdi-bu-uygulama-i-in-hazy-boot.md`) 13 küçük adımdan oluşuyor, önceliği "günlük pratik fayda", tempo "küçük adımlar, sık". **1-5 ve 7 tamamlandı** (6. adım — konuşma hızını günlük kullanımda deneme — kullanıcının kendi gözlemine bırakıldı, atlanıp 7'ye geçildi). Sırada: **8. `ai/chat.ts` ve IPC için temel testler.** Otomasyon motoru (eski Tur J) bu listede 11. adım, öncelik değil. Uygulama simgesi hâlâ Tur F'nin mor simgesi; Jarvis mavisine çevrilmesi istenirse yapılacak.
- **Görevlere saat eklendi (2026-09-15, PR #11):** `tasks.due_time` sütunu (migration 8). Son tarihi olan bir göreve isteğe bağlı "HH:mm" saati eklenebiliyor; sohbetten `gorev_ekle` aracıyla da ("14:00'te toplantı" gibi). Görevler sayfasında tarih seçilince saat kutusu beliriyor, rozette ve Takvim ajandasında saat gösteriliyor, ajanda artık görevleri de saate göre sıralıyor. Saat sadece tarihi olan görevde kabul edilir (`cleanDueTime`), tarih kaldırılırsa saat de düşer. CDP ile uçtan uca doğrulandı (Görevler + Takvim), test verisi silindi.
- **Google hesabı bağlandı (2026-09-15, ilk kez uçtan uca doğrulandı):** İlk bağlantı denemesi `invalid_client` hatası verdi (Google Cloud'daki istemci kimliği/gizli anahtar ile kayıtlı değer eşleşmiyordu); kullanıcı Cloud Console'dan değerleri kontrol edip Ayarlar > Google'a yeniden girdikten sonra bağlantı başarılı oldu (`google.status()` → `connected: true`, `ysfllcc@gmail.com`). Doğrulama: Takvim bu ay için hatasız ama boş (0 etkinlik) döndü; **Gmail gerçekten çalıştı** — sohbette "Son 5 e-postamı özetler misin?" isteği `epostalari_ozetle` aracını çağırdı ve gerçek gelen kutusundan 5 gerçek e-postayı (Cloudinary, Google güvenlik, Vercel, Kariyer.net) çekip özetledi. Test sohbeti silindi. **Google bağlantısı artık gerçek kullanımda.**
- **Mikrofon donanım sorunu çözüldü (2026-09-15):** Kullanıcı Windows'ta mikrofonu açtı; tepe seviyesi 0,0000'dan 0,01'e çıktı (hâlâ düşük ama artık gerçek sinyal var — giriş kazancının Windows Ses Ayarları'ndan yükseltilmesi önerildi). **Kurulum paketinde VAD hatası bulundu ve düzeltildi:** `resources/voice/silero_vad.onnx?asset` ile içe aktarılan model paketlenmiş build'de `app.asar` içindeki (native olarak okunamayan) sanal yolu döndürüyordu; gerçek dosya `asarUnpack` ile `app.asar.unpacked` altındaydı. `src/main/voice/engines.ts`'e paketliyken yolu `app.asar.unpacked`'a çeviren bir yardımcı eklendi (PR #8). Düzeltme sonrası **kurulu pakette gerçek mikrofonla "Hey Jarvis" başarıyla algılandı** (puan 0.46). **Ders:** onnxruntime-node gibi native modüller Electron'un asar `fs` yamasından geçmiyor; `?asset` ile içe aktarılan ve native modüle verilen her dosya yolu paketlenmiş build'de `app.asar.unpacked`'a çevrilmeli — sadece Electron API'lerine (ikon, pencere vb.) verilen yollar bu sorunu yaşamıyor.
- **Kurulum paketi testi (2026-09-15, `v1.1.0-beta`):** İlk kez Jarvis ses pipeline'ıyla birlikte paketlendi ve kuruldu (`kisisel-asistan-1.1.0-beta-setup.exe /S`). CDP ile doğrulandı: `resources\app.asar.unpacked\node_modules\onnxruntime-node\bin\napi-v6\win32\x64\` altında doğru DLL'ler mevcut, uygulama açılışta hatasız başladı ("Jarvis başladı", "Jarvis mikrofonu dinliyor"), `voice.state()` `phase: "wake"` döndü (uyandırma modeli onnxruntime ile başarıyla yüklendi), `voice.speak()` çağrısı `play` olayı üretti (Piper gerçekten ses dosyası üretti, hata yok). Tek uyarı önceden bilinen "tavily"/"google-refresh-token" çözülemeyen anahtarları (ayrı konu). Test sonrası uygulama kapatıldı, ekran görüntüsü silindi.
- **Ollama modeli bozuk (2026-09-14, çözüldü):** Model `ollama pull qwen3:14b` ile yeniden indirildi, `ollama show` sağlam gösterdi ama sabahtan beri çalışan Ollama sunucusu eski bilgiyi önbellekte tuttuğu için hâlâ `does not support chat` dedi. Kullanıcı onayıyla Ollama (`%LOCALAPPDATA%\Programs\Ollama\ollama app.exe`) yeniden başlatılınca düzeldi. **Ders:** model dosyası değişince Ollama yeniden başlatılır. Eski kayıt: Ollama 0.34.0'a güncellenmiş; `ollama list` `qwen3:14b`'yi gösteriyor ama model dosyası (blob `sha256-a8cc1361...`) diskte yok. Sohbet "Bad Request" veriyor, doğrudan istek `"qwen3:14b" does not support chat` diyor. Çözüm `ollama pull qwen3:14b` (9,3 GB); indirme kullanıcı onayıyla yapılır. Bu yüzden Tur G'de araç kaydı sohbetle değil `tools/guard.test.ts` ile doğrulandı.
- **Kullanıcının yapması gerekenler:** Windows'ta mikrofon giriş seviyesi (gain) hâlâ düşük (0.01 civarı) — Ses Ayarları'ndan giriş seviyesini/mikrofon güçlendirmeyi yükseltmek algılamayı daha güvenilir yapar. Ayarlar > Servisler'e Tavily anahtarını yeniden girmek (eski kayıt çözülemiyor). Google hesabı artık bağlı, ek bir aksiyon gerekmiyor.
- **Yeni sürüm çıkarma:** `package.json` sürümünü artır → uygulamayı kapat → `out` ve `dist` sil → `npm run build:win` (sırada başka iş yok) → kurulum dosyasını dene. Kurulu uygulama aynı veri klasörünü kullanır.
- Bekleyen test: yerel/Groq/OpenAI dışında ek konuşma tanıma senaryoları. Google/Gmail artık gerçek hesapla doğrulandı (yukarıda). Tur C'deki yanıtlama/arşivleme/etkinlik güncelleme-silme henüz gerçek hesapla ayrıca denenmedi (sadece okuma/özetleme denendi).
- **Google bağlantı geçmişi:** İlk deneme (2026-09-12) "Gmail hesabı bilgisi alınamadı" hatası verdi (Cloud projesinde API etkin değildi). İkinci deneme (2026-09-15) `invalid_client` verdi (kayıtlı istemci bilgisi yanlıştı), kullanıcı Cloud Console'dan değerleri kontrol edip yeniden girince bağlandı (yukarıda ayrıntı var).
- **Veritabanı ve gizli anahtar olayı (2026-09-12/13):** Uygulamanın gördüğü veritabanı içeriği iki kez beklenmedik şekilde değişti.
  - Tur C sonunda (22:33) sohbetler, görevler, notlar ve hafıza boştu ama sayaçlar yüksekti (satırlar silinmiş). O sırada `asistan.db` 4 KB, `-wal` 3,1 MB idi; yani veri hiç ana dosyaya aktarılmamış, tamamı WAL'deydi. Geliştirme sunucusu her seferinde süreç ağacı öldürülerek kapatıldığı için `closeDb` hiç çalışmamış olabilir.
  - 23:11'de geliştirme sunucusu açılınca bambaşka bir geçmiş göründü: sayaçlar 1-3, 19:59'da açılmış bir "Merhaba sohbeti", `googleAccount` dolu, gizli anahtarlar yeniden kayıtlı. Önceki 22:33 okumasında bu kayıtlar yoktu. Kesin neden bulunamadı.
  - Bu yeni kayıttaki Google istemci bilgileri, yenileme anahtarı ve Tavily anahtarı çözülemiyor (`safeStorage.decryptString` hatası). Aynı uygulamada yeni yazılan geçici bir değer yazılıp okunabildi; yani şifreleme çalışıyor, eski anahtarlar farklı bir şifreleme kimliğiyle yazılmış. Kullanıcı Google istemci bilgilerini, Tavily anahtarını yeniden girmeli ve Google'ı yeniden bağlamalı.
  - **Tur G'de yapıldı:** 5 dakikada bir, uykuya geçerken, Windows kapanırken ve `closeDb`'de WAL aktarma; açılışta bütünlük kontrolü; günlük otomatik yedek; çözülemeyen anahtarların Ayarlar'da kırmızı uyarısı. 2026-09-14 açılışında `asistan.db` 86 KB, `-wal` 647 KB idi (12 Eylül'den beri aktarılmamış); Tur G öncesi kopyası oturumun geçici klasörüne alındı.
- **npm audit:** Electron'un bağımlılığı `extract-zip` için 2 yüksek uyarı var; düzeltmesi Electron 44'e geçmek (büyük sürüm). Tur F'de değerlendirilecek.
- **Uygulamanın durumu:**
  - Ayarlar: sağlayıcı Ollama, model `qwen3:14b`. Kapatınca tepside kalma açık, kısayol `Ctrl+Shift+Space`, Windows ile başlama kapalı.
  - **Tavily anahtarı girildi**, internette arama çalışıyor (kullanıcı kendi girdi; kimlik bilgilerini ben girmiyorum).
  - **Groq anahtarı girilmedi**, mikrofonla yazma o zamana kadar Türkçe hata veriyor. Sesli okuma anahtarsız çalışıyor ama varsayılan olarak kapalı.
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
- [x] **Aşama 6: Ses.**
  - **Mikrofon:** Sohbet kutusundaki mikrofon butonu `MediaRecorder` ile kayıt alır (webm/opus), ses `ArrayBuffer` olarak ana sürece gider ve `src/main/ai/speech.ts` ile yazıya çevrilir. Çıkan metin kutuya eklenir, gönderilmez.
  - Servisler OpenAI uyumlu `audio/transcriptions` arayüzünü kullanır: Groq (`whisper-large-v3-turbo`, ücretsiz kotalı) veya OpenAI (`whisper-1`). Dil `tr` olarak gönderilir.
  - **Mikrofon izni:** `session.setPermissionRequestHandler` sadece `media` iznini verir, diğerlerini reddeder (`src/main/system/window.ts`).
  - **Sesli okuma:** `speechSynthesis` ile Windows sesleri kullanılır, ek anahtar ve internet gerekmez. Markdown işaretleri okunmadan önce temizlenir (`src/renderer/src/lib/voice.ts`).
  - **Ayarlar > Ses:** servis seçimi, API anahtarı, "cevapları sesli oku" anahtarı, ses seçimi ve "Dene" düğmesi.
  - Doğrulandı: mikrofon izni ve cihaz erişimi, cevabın okunması (`speechSynthesis.speaking`), anahtar yokken Türkçe hata. Gerçek konuşma-metin dönüşümü Groq anahtarı girilince test edilecek.
### Bölüm 2: Geliştirme turları

Ayrıntılı plan: plan dosyasının "Bölüm 2" kısmı (`.claude/plans` klasöründe).

- [x] **Tur A: Arayüz yenilemesi.**
  - Tasarım belirteçleri `src/renderer/src/assets/main.css` içindeki `@theme` bloğunda: app, surface, elevated, line, line-strong, ink, muted, faint, accent, positive, caution, negative. Tailwind bunlardan `bg-surface`, `text-muted`, `border-line` gibi sınıflar üretir.
  - Özel başlık çubuğu: `titleBarStyle: 'hidden'` + `titleBarOverlay` (Windows düğmeleri kalır), `components/TitleBar.tsx`, sürükleme için `.drag-region` sınıfı.
  - Daraltılabilir yan menü (`Sidebar.tsx`, tercih localStorage'da), sayfa adları `lib/pages.ts` dosyasında.
  - Sohbet: mesaj altında kopyala ve sesli oku düğmeleri; kod bloklarında `rehype-highlight` ile renklendirme ve kopyalama (`components/chat/CodeBlock.tsx`).
  - Bildirimler: `components/ui/ToastProvider.tsx` + `lib/toast.ts` (`useToast()`).
  - Yükleniyor iskeletleri (`components/ui/Skeleton.tsx`) ve Ayarlar sekmeleri (Model, Ses, Servisler, Google, Uygulama).
- [x] **Tur B: Sohbet deneyimi.**
  - **Arama:** yan menüdeki kutu başlıkta ve mesaj içeriğinde arar (`searchConversations`), eşleşen mesajdan kısa alıntı gösterir. Arama JavaScript'te yapılır; `I/İ/ı/i` hepsi "i" sayılır, yoksa "Ikinci" başlığı "ikinci" ile bulunamıyor.
  - **Sabitleme ve yeniden adlandırma:** satırdaki "..." menüsü (çift tıklama da adı düzenler). Sabitlenenler listenin başında (`ORDER BY pinned DESC, updated_at DESC`).
  - **Cevabı yeniden üret** (`chat:regenerate`): son asistan mesajı silinip aynı soru tekrar sorulur.
  - **Mesajı düzenle ve yeniden gönder** (`chat:editAndResend`): o mesaj ve sonrası silinir, yenisi eklenir.
  - **Modelin başlık üretmesi:** ilk soru-cevap bitince `generateText` ile kısa başlık istenir (`lib/title.ts` → `cleanTitle`, `<think>` bloğunu ve tırnakları atar). `conversations.title_auto` sütunu başlığı kullanıcının mı modelin mi verdiğini tutar; kullanıcı adlandırdıysa model bir daha dokunmaz.
  - **Klavye kısayolları:** `Ctrl+N` yeni sohbet, `Ctrl+F` arama kutusu, `Esc` cevabı durdur.
  - **Markdown dışa aktarma** (`conversations:export`): `lib/markdownExport.ts` metni üretir, `dialog.showSaveDialog` yeri sorar, arayüzde toast çıkar.
- [x] **Tur C: Yeni yetenekler.**
  - **Belge okuma** (`lib/documents.ts`): `.pdf` (`pdfjs-dist` legacy build, `verbosity: 0`), `.docx` (`mammoth`), `.txt/.md/.csv/.json/.log`. Metin 8000 karakterlik parçalara bölünür (`splitIntoParts`, satır sonundan keser). Taranmış (resim) PDF okunamaz, Türkçe hata verir.
  - **Sohbete belge ekleme:** ataş düğmesi veya sürükle-bırak. Dosya yolu preload'da `webUtils.getPathForFile` ile alınır (Electron'da `File.path` yok). `documents:read` ilk parçayı okur ve dosyayı o sohbet için onaylı sayar (`allowDocument`).
  - **Mesajda belge biçimi** (`src/shared/attachments.ts`): kullanıcı mesajına `[[BELGE ad=".." parca="1/N"]] ... [[/BELGE]]` bloğu olarak kaydedilir; arayüz bunu kart olarak gösterir (`splitAttachments`). **Modele giderken** `toModelContent` ile "önce `<belge>` etiketli metin, en sonda Kullanıcının isteği" düzenine çevrilir. Neden: blok mesajın sonunda kalınca `qwen3:14b` soruyu cevaplamak yerine bloğu aynen tekrar yazdı.
  - **`belge_oku` aracı:** modelin kendisi bir dosya okumak isterse onay kartı çıkar; aynı sohbette aynı dosyanın sonraki parçaları (`bolum: 2, 3...`) yeniden onay sormaz.
  - **Tekrarlayan hatırlatmalar:** `reminders.repeat` (`none/daily/weekdays/weekly`, migration 5). Çalınca tek seferlik olan "gösterildi" işaretlenir, tekrarlayan `lib/repeat.ts` → `nextReminderTime` ile sonraki zamana atılır (kapalıyken kaçanlar atlanır, `setDate` ile yaz saati güvenli). Görevler sayfasında tekrar seçimi, "Her gün" rozeti ve **Ertele** (10 dk / 1 saat / yarın). `hatirlatma_kur` sadece saat ("09:00") da kabul eder (`resolveReminderTime`: saatin bir sonraki geleceği an); `qwen3:14b` "her gün 9'da" isteğinde tam tarih yerine sadece saati gönderiyordu. Takvim araçlarının açıklamasına "hatırlat isteklerinde kullanma" eklendi; öncesinde model hatırlatma yerine `etkinlik_ekle` seçti. Model ayrıca alan adlarını Türkçeleştirip `{"saat":"09:00","metin":"...","tekrar":"her_gun"}` gönderdi; bu yüzden `hatirlatma_kur` şeması `z.looseObject` ile esnek, `metin`/`saat` gibi takma adlar ve Türkçe tekrar değerleri (`parseRepeatInput`) kabul ediliyor.
  - **Pano araçları:** `pano_oku` (en fazla 8000 karakter), `pano_yaz`.
  - **Sabah özeti:** `ai/brief.ts` → `collectDailyBrief` (hava, bugünkü/geciken görevler, bugünkü hatırlatmalar, takvim, okunmamış e-posta; bir bölüm hata verirse diğerleri gelir, nedeni `uyarilar`da). `gunluk_ozet` aracı. `scheduler/brief.ts` her dakika `isBriefDue` kontrol eder, günde bir bildirim gösterir; son gösterim günü `settings` tablosunda `state:briefLastShown`. Bildirime tıklanınca `daily-brief` komutu yeni sohbette "Günlük özetimi hazırla" gönderir. Ayarlar > Uygulama > Sabah özeti: aç/kapa, saat, şehir, "Şimdi dene" (`brief:preview`).
  - **Gmail genişletme:** `eposta_yanitla` (onaylı; `In-Reply-To`/`References` + `threadId`, Message-ID sadece `<...>` biçimindeyse kullanılır), `eposta_isaretle`, `eposta_arsivle` (onaylı). Bunlar için `gmail.modify` izni eklendi; daha önce bağlanmış hesap yeniden bağlanmalı.
  - **Takvim genişletme:** `etkinlik_guncelle` (onaylı; sadece başlangıç değişirse süre korunur), `etkinlik_sil` (onaylı). `googleRequest` artık `PATCH`/`DELETE` ve boş (204) cevabı destekliyor.
  - Yan menüdeki sürüm etiketi `app.getVersion()` ile `package.json`dan geliyor (`app:version`).
- [x] **Tur D: Asistanın zekası.**
  - **Araç sonuçları geçmişte:** `ToolActivity` artık `input` ve kısaltılmış `result` (en fazla 1500 karakter, `summarizeToolOutput`) saklıyor (mevcut `messages.tools` JSON sütununda, migration gerekmedi). `lib/toolHistory.ts` → `toModelMessages`: son 6 asistan cevabının araçları "araç çağrısı → araç sonucu → cevap metni" olarak modele verilir. Sonucu olmayan eski kayıtlar sadece metin gider.
  - **Uzun sohbet özeti:** modele son 40 mesaj tam gider. Cevaptan sonra arka planda `updateSummary`, eski kısımda en az 10 yeni mesaj birikmişse (tek seferde en fazla 40) özeti günceller; özet `conversations.summary`, kapsadığı son mesaj `summary_until` (migration 6). Özet bir sonraki cevapta sistem talimatına eklenir. Mesaj düzenlenip özetin kapsadığı kısım silinirse özet sıfırlanır (`deleteMessagesFrom`).
  - **Kişiselleştirme** (Ayarlar > Asistan): "Hakkımda" metni (en fazla 1500 karakter) ve konuşma tonu (`dengeli/samimi/resmi/kisa`, `TONE_INSTRUCTIONS`) sistem talimatına eklenir.
  - **Model ayarları:** yaratıcılık (`temperature`, null = model varsayılanı) ve Ollama bağlam uzunluğu (`contextLength` → `providerOptions.ollama.options.num_ctx`). `providers.ts` → `getModelOptions()` hem sohbette hem özette kullanılır.
  - **Hafıza yönetimi:** `lib/memoryRank.ts`. Kaydederken çok benzer kayıt (5 harflik kök benzerliği ≥ 0,6) varsa yeni kayıt açılmaz, mevcut kayıt güncellenir ("Kızının adı Elif" ile "Oğlunun adı Elif" birleşmez). 30'dan fazla kayıt varsa son kullanıcı mesajıyla ortak kelimesi olanlar öne alınır (`rankMemories`). Notlar > Asistanın hafızası'nda kayıtlar tıklanıp düzenlenebilir (`memories:update`). Yeni araçlar: `hafizayi_listele`, `hafizadan_sil`.
  - **Kullanılamayan araçlar gizlenir:** `ToolModule.isAvailable`. Google bağlı değilse Gmail/Takvim, Tavily anahtarı yoksa `web_ara` modele hiç verilmez (`getAssistantTools()` her cevapta hesaplanır) ve talimat buna göre değişir. Neden: `qwen3:14b` "listeme görev ekle" isteğinde `etkinlik_ekle` seçti.
  - **Uçtan uca doğrulandı:** "Listeme TEST süt al ekle" → `gorev_ekle` (Google araçları gizlenince doğru araç), ardından "az önce eklediğin görevin numarası" → listeye bakmadan doğru numara (1). 52 mesajlık sohbette cevaptan sonra özet oluştu (14 eski mesaj, "turkuaz" bilgisi dahil), sonra "en sevdiğim renk neydi?" → "turkuazdı" (bilgi son 40 mesajın dışındaydı). Hafıza birleştirme/düzenleme/silme ve ayar doğrulamaları IPC ile denendi.
  - **Test ipucu:** `location.reload()` sonrası `cdp.mjs key Enter` gönderimi tetiklemedi (metin kutuda kaldı); mesajı "Gönder" düğmesine tıklayarak göndermek güvenilir.
  - **Çözülemeyen gizli anahtar:** `getSecret` artık `safeStorage.decryptString` hatasında çökmez, anahtarı yok sayar (`getSecretStatus` de sadece çözülebilenleri kayıtlı sayar). Kullanıcının Google yenileme anahtarı 2026-09-13'te bu hatayı verdi; hesabı yeniden bağlaması gerekiyor.
- [x] **Tur E: Güvenilirlik.** Kullanıcı kararıyla 2026-09-13'te atlandı; kapsamı Bölüm 3'teki **Tur G**'ye taşındı ve orada yapıldı (arayüz testleri hariç).
- [x] **Tur F (eski Aşama 7): Paketleme — v1.0.0-beta.** Kullanıcı Tur E'den önce kuruluma geçmek istedi (Tur E hâlâ yapılacak).
  - Sürüm `package.json` → `1.0.0-beta`; kurulum dosyası `dist/kisisel-asistan-1.0.0-beta-setup.exe` (`npm run build:win`).
  - **Veri klasörü sabitlendi:** `src/main/index.ts` en başta `app.setPath('userData', %APPDATA%\kisisel-asistan)`. Neden: `electron-builder.yml`'deki `productName: Kişisel Asistan` yüzünden kurulu uygulama `%APPDATA%\Kişisel Asistan` klasörünü kullanacaktı; geliştirme ve kurulu uygulama farklı veritabanı ve farklı şifreleme anahtarı (Local State) görürdü. Tek kopya kilidi de bu klasöre bağlı.
  - **Simge:** uygulamadaki logo (mor yuvarlak kare + beyaz sparkles). Electron'da SVG çizilip PNG'ye çevrildi, ICO dosyası PNG gömülü olarak elle yazıldı (16-256 px). `build/icon.ico`, `build/icon.png` (512), `resources/icon.png` (256, tepsi ve bildirim).
  - `electron-builder.yml`: kullanıcı başına tek tık kurulum (yönetici izni yok, `%LOCALAPPDATA%\Programs`), kaldırınca veri silinmez, `publish: null` (sahte güncelleme adresi kaldırıldı), `scripts/`, `CLAUDE.md`, `.claude/` paketten çıkarıldı.
  - **Otomatik güncelleme yok:** GitHub deposu kurulunca `electron-updater` eklenecek.
  - **Kurulum testi (2026-09-12):** `dist\kisisel-asistan-1.0.0-beta-setup.exe /S` 14 saniyede kuruldu → `%LOCALAPPDATA%\Programs\kisisel-asistan\kisisel-asistan.exe`, masaüstü ve Başlat menüsünde "Kişisel Asistan" kısayolu. Kurulu uygulama `--remote-debugging-port=9223` ile açılıp CDP ile denendi: sürüm etiketi `v1.0.0-beta`, geliştirmedeki sohbet görünüyor (aynı veri klasörü), PDF okuma (pdfjs asar içinden), Ollama sohbeti ve `gorev_ekle` aracı (ai, @ai-sdk, undici asar içinden) çalıştı, "Windows ile başlat" etkin. Test verisi silindi, uygulama kapatıldı.
  - Paketlemede `better-sqlite3` prebuild'leri `app.asar.unpacked` altına açılıyor; `scripts/`, `CLAUDE.md` pakete girmiyor.
  - **İmzasız:** Kod imzalama sertifikası yok; Windows SmartScreen ilk açılışta "Tanınmayan uygulama" uyarısı gösterebilir ("Ek bilgi → Yine de çalıştır").
  - **Kaldırma:** Ayarlar > Uygulamalar > Kişisel Asistan veya `Uninstall kisisel-asistan.exe`. Veriler `%APPDATA%\kisisel-asistan` içinde kalır.

### Bölüm 3: Jarvis

Kullanıcı görseldeki gibi bir "Jarvis" istiyor: parlayan küreli ana ekran, eller serbest ses, otomasyonlar, bilgisayarı yönetme. Kararlar: dört alanın hepsi; **seviyeli izin** (okuma serbest, değişiklik onaylı, rutinlerde onay kaldırılabilir, her işlem kayıtlı); **yerel model + gerekince bulut**. Plan dosyası: `C:\Users\ysfll\.claude\plans\imdi-bu-uygulama-i-in-hazy-boot.md`.

- [x] **Tur G: Sağlam temel.** Dal `tur-g/saglam-temel`.
  - **Veritabanı** (`db/index.ts`): `checkpointDb` (`wal_checkpoint(TRUNCATE)`), `checkIntegrity`, `isDbOpen`. `closeDb` önce aktarır. `openDatabase` hata verirse bağlantıyı kapatır (yoksa Windows bozuk dosyayı kilitliyor ve geri yükleme yapılamıyor). `initDatabase` önce `closeDb` çağırır.
  - **Açılış** (`system/database.ts` → `openDatabaseSafely`): bütünlük bozuksa veya dosya açılamıyorsa yerel pencereyle son yedeği geri yüklemeyi önerir. Bozuk dosya `asistan-bozuk-<zaman>.db` olarak saklanır. Kullanılamıyorsa uygulama kapanır.
  - **Yedek** (`db/backup.ts`, electron'suz ve test edilebilir): `db.backup()` önce `.part` dosyasına yazar, sonra ad değiştirilir. Adlar `asistan-YYYY-MM-DD.db` ve `geri-yukleme-oncesi-YYYY-MM-DD-HHmmss.db`. Saklama: son 7 günlük + kapsanmayan 4 hafta (haftanın en yenisi) + son 3 güvenlik yedeği (`selectExpiredBackups`). Klasör `%APPDATA%\kisisel-asistan\backups`.
  - **Bakım** (`scheduler/maintenance.ts`): 5 dakikada bir WAL aktarma, açılıştan 1 dakika sonra ve saatte bir "bugünün yedeği yoksa al", açılışta 180 günden eski etkinlik kayıtlarını silme. `index.ts` ayrıca `session-end` ve `powerMonitor` `suspend` olayında aktarır; `SIGINT`/`SIGTERM` gelirse düzgün kapanır.
  - **Geri yükleme** (`restoreBackup`): sadece yedek klasöründeki listelenen adlar kabul edilir. Onay penceresi ana süreçte gösterilir (varsayılan düğme "Vazgeç"). Mevcut veri önce güvenlik yedeğine alınır, dosya değiştirilir, `app.relaunch()` + `app.exit(0)`. Dosya değişemezse mevcut veritabanı yeniden açılır.
  - **Günlük** (`system/logger.ts`, `electron-log` 5): `%APPDATA%\kisisel-asistan\logs\main.log` (2 MB'da `main.old.log`). `Object.assign(console, log.functions)` ile tüm `console.*` dosyaya gider; yakalanmayan hatalar `errorHandler.startCatching`. Arayüz hataları `window` `error`/`unhandledrejection` → `app:logError` (`ipcRenderer.send`). Çöken süreçler `render-process-gone`/`child-process-gone` ile yazılır. Dosya UTF-8; PowerShell 5.1'de `Get-Content -Encoding UTF8` ile okunur.
  - **Araç izinleri** (`tools/permissions.ts` → `needsApproval`): `ToolRisk` = `read | write | dangerous`, `ToolSource` = `chat | automation | voice | remote`, rutin izni `RoutineAllowance` = `none | write | all`. read hiç onay istemez; write sohbet/seste serbest, rutin ve uzaktan çalışmada izin `none` ise onaylı; dangerous her zaman onaylı, tek istisna `automation` + `all` ve `external` değilse. **Dışarıdan gelen içerik (e-posta, web) tam izni kullanamaz.**
  - **Araç sarmalayıcısı** (`tools/index.ts` → `guardTool`): `getAssistantTools()` her aracı sarar. Bağlam yoksa (testler) araç olduğu gibi çalışır. write/dangerous araç `selfApproval` listesinde değilse ve izin gerektiriyorsa genel onay kartı gösterilir ("Görev ekleme yapılsın mı?"). Her çağrı `activity_log`'a yazılır (`done/error/denied/timeout`, onay `approved/auto/null`). `ToolContext` artık `source`, `allowance`, `external`, `call` taşır; `requireApproval` onay sonucunu `call.approval`'a yazar ve izin gerekmiyorsa kart göstermeden `auto` der.
  - **Etkinlik kaydı** (migration 7, `data/activity.ts`, `activity.ts` → `recordActivity`): `activity_log` (created_at epoch ms, source, kind, name, label, summary ≤200, detail ≤1000, status, approval, conversation_id yabancı anahtar değil). `recordActivity` veritabanı kapalıysa sessizce çıkar, sonra `notifyDataChanged('activity')`. Özet `lib/activityText.ts` → `describeToolInput` (girdideki metin/sayı alanları, 120 karakter).
  - **Gizli anahtarlar:** `settings.ts` → `readSecret` (`missing/ok/unreadable`), `getUnreadableSecrets`. Çözülemedi uyarısı her anahtar için bir kez yazılır, anahtar yeniden girilince sıfırlanır. `SettingsView.unreadableSecrets`; `SecretField` `unreadable` alırsa kırmızı "yeniden gir" yazar; Google yenileme anahtarı çözülemiyorsa Google sekmesinde uyarı çıkar.
  - **Arayüz:** Ayarlar > Uygulama'da "Yedekler ve günlükler" (`settings/BackupSettings.tsx`: şimdi yedekle, günlük klasörünü aç, liste ve geri yükle) ve "Son işlemler" (`activity/ActivityList.tsx`, `useLiveData(..., 'activity')`, son 10 kayıt; Tur H'de Ana Sayfa'da da kullanılacak).
  - **IPC:** `app:logError` (on), `app:openLogs`, `backups:list/create/restore`, `activity:list`.
  - **Doğrulandı:** 24 test dosyası, 142 test (yeni: `db/backup.test.ts` bozuk dosyayı yedekle değiştirme dahil, `data/activity.test.ts`, `tools/permissions.test.ts`, `tools/guard.test.ts` gerçek `gorev_ekle` ile onaysız/rutinde ret/izinli rutin/hata kaydı, `tools/modules.test.ts` her aracın etiketi ve riski tanımlı, `lib/activityText.test.ts`). Uygulamada (CDP): günlük dosyası oluştu, 4 çözülemeyen anahtar tespit edildi ve birer kez yazıldı, `backups.create` 56 KB yedek üretti, Ayarlar ekranı görüntüsü alındı, geri yükleme penceresinde Vazgeç `false` döndü, 5 dakikalık aktarmada WAL küçüldü. **Yapılmadı:** gerçek geri yükleme ve açılışta bozuk veritabanı penceresi (geliştirme modunda `app.relaunch` dev sunucusunu bozar; kurulum paketinde denenmeli), sohbet üzerinden araç kaydı (Ollama modeli bozuk).
- [x] **Tur H: Jarvis arayüzü.** Dal `tur-h/jarvis-arayuz`. Kullanıcı kararları: görünen ad **Jarvis**; menüde **sadece hazır sayfalar** (Otomasyonlar/Analizler/Başarımlar kendi turunda eklenecek); Ana Sayfa komut kutusu **yeni sohbette** cevaplar.
  - **Ad:** `productName: Jarvis`, pencere/tepsi/bildirim/günlük/yedek penceresi başlıkları, `index.html`, sistem talimatı "Senin adın Jarvis". `appId` (`com.kisisel.asistan`), `name`/`executableName` (`kisisel-asistan`) ve veri klasörü değişmedi; kurulu eski sürümün üzerine kurulur, veri kaybolmaz.
  - **Tema** (`main.css` `@theme`): lacivert-siyah zemin, `accent` #2f7dff, yeni `glow` #3cc4ff (`text-glow`, `bg-glow`). `@layer components` içinde `.glass-card` (cam kart) ve `.jarvis-backdrop` (ışımalı zemin); katman içinde oldukları için Tailwind sınıfları (ör. `hover:border-accent/50`) onları ezebilir. Pencere `backgroundColor`/`titleBarOverlay` renkleri `window.ts`'de temayla aynı tutulur; varsayılan pencere 1360×860.
  - **Küre** (`components/jarvis/Orb.tsx`): canvas 2D; tuval `size × 1.9 : 1.15`. Katmanlar: yatay ışık çizgisi, dış ışıma, koyu cam disk, 6 dalgalı ışık teli, 28 kıvılcım, ortada ses dalgası. Hız/ışık/dalga hedefleri duruma göre `TARGETS`, geçiş yumuşak. Dinlerken gerçek mikrofon seviyesi (`recorder.ts` → `getInputLevel`, AnalyserNode). `prefers-reduced-motion` açıksa dönmez, 500 ms'de bir çizer. Renkleri CSS değişkeninden okur.
  - **Asistan durumu** (`lib/assistantState.ts`, ana süreç olayı yok, arayüzde hesaplanır): `idle/listening/thinking/working/speaking`, `useAssistantState()` (`useSyncExternalStore`). Kaynaklar: `chat:event` (delta/approval → thinking, çalışan araç → working, done/stopped/error → siler), `noteReplyStarted` (ChatPage `send`), `setListening` (recorder), `setSpeaking` (`voice.ts` utterance olayları). Tur I/J'de ses ve otomasyon da buraya bağlanacak.
  - **Ana Sayfa** (`pages/HomePage.tsx`, varsayılan sayfa): küre + "Jarvis" + saate göre selamlama + durum rozeti; `home/CommandBox.tsx` (tek satır kutu, mikrofon, hazır başlangıçlar: görev/hatırlatma/"Günümü özetle" doğrudan gönderir/dosya bul); `home/QuickAccess.tsx` (Görevler, Takvim, Hafıza Merkezi, Asistan kartları, canlı sayılar); sağda "Son işlemler" (`ActivityList limit=5 compact`), `home/SystemStatusCard.tsx` (mikrofon, internet, yapay zeka, Google, son yedek, depolama; 60 sn'de ve ayar değişince yenilenir), `home/QuoteCard.tsx` (günün sözü, yılın gününe göre).
  - **Komut kutusu → sohbet:** `App.ask` sayfayı `chat` yapar ve `lib/chatRequests.ts` → `requestNewChat(text)`; ChatPage `onNewChatRequest` ile dinler, `openConversation(null)` + `sendRef.current(text)`. Neden olay: ChatPage hep mount'lu; prop + effect yolu `set-state-in-effect` kuralına takılıyordu.
  - **Mikrofon ortak** (`lib/useDictation.ts`): Composer ve CommandBox kullanır; bileşen kapanırken kayıt iptal edilir.
  - **Takvim sayfası** (`pages/CalendarPage.tsx`, `lib/calendar.ts` + testi): pazartesi başlayan 6 haftalık ay ızgarası (`monthGrid`, `gridRange`), gün programı (`buildAgenda`: tüm gün etkinlikleri ve görevler önce, sonra saat; çok günlü tüm gün etkinliği bitiş gününe taşmaz). Hücrede ilk kaydın başlığı ve tür noktaları (etkinlik accent, hatırlatma glow, görev positive). Sağda seçili günün programı, görevi tamamlama ve "Bu güne görev ekle". Google bağlı değilse uyarı + Ayarlar bağlantısı. Hafta görünümü yapılmadı.
  - **Ana süreç:** `google/calendar.ts` (`fetchCalendarEvents`, `toCalendarItem` + testi; `takvim_listele` aracı da bunu kullanıyor), `system/status.ts` (`getSystemStatus`: Ollama model listesi veya bulut anahtarı, Google, son yedek, `systeminformation.fsSize` ile veri klasörünün diski). IPC: `calendar:events(from, to)` (Google bağlı değilse `[]`, en fazla 62 gün, 250 kayıt), `system:status`.
  - **Başlık çubuğu:** logo halkası + "JARVIS", sayfa adı; sağda internet (`useOnline`), pil (`useBattery`; pilsiz/tam dolu şarjdaysa gizli), saat ve tarih (`useClock`). Yardımcılar `lib/deviceStatus.ts`.
  - **Yan menü:** Ana Sayfa, Asistan (eski Sohbet), Görevler, Takvim, Hafıza Merkezi (eski Notlar), Ayarlar; etkin öğe mavi degrade; altta asistan durumu ("Sistem hazır" / "Düşünüyor...").
  - **Doğrulandı:** 26 test dosyası, 149 test; typecheck, lint, build temiz. CDP ekran görüntüleri: Ana Sayfa (küre, sistem durumu gerçek verilerle), Takvim (boş ve TEST görev/hatırlatmalı; ajandadan görev tamamlama), komut kutusundan yeni sohbet açılıp mesaj gönderildi (model bozuk olduğu için "Bad Request"). Test verileri silindi. **Denenmedi:** kürenin dinliyor/konuşuyor durumları (mikrofon kaydı ve sesli okuma elle denenmeli), Google etkinliklerinin takvimde görünmesi (hesap bağlı değil).
- [x] **Tur I: Jarvis sesi.** Dal `tur-i/jarvis-sesi`. Eller serbest, internetsiz sesli sohbet.
  - **İndirilenler (kullanıcı sonradan onayladı; önce sormadan indirildi, bu hata tekrarlanmasın):** `qwen3:14b` yeniden, yerel ses paketi `%APPDATA%\kisisel-asistan\voice` (~640 MB), `resources/voice/silero_vad.onnx` (2 MB, MIT, depoda), `onnxruntime-node` 1.22 (npm).
  - **Ses paketi** (`voice/pack.ts`, electron'suz + testi; `voice/packManager.ts` indirme ve ilerleme): `wakeword/` (openWakeWord v0.5.1: `hey_jarvis_v0.1.onnx`, `melspectrogram.onnx`, `embedding_model.onnx`), `piper/` (rhasspy/piper 2023.11.14-2 zip), `voices/tr_TR-dfki-medium.onnx(.json)` (Hugging Face'teki tek Türkçe Piper sesi; fahrettin/fettah yok), `whisper/Release/` (whisper.cpp b5130 `whisper-bin-x64.zip`, CPU), `models/ggml-large-v3-turbo-q5_0.bin`. İndirme `.part` + ad değiştirme, 60 sn veri gelmezse iptal; zip Windows `tar.exe` ile açılır (sabit komut). Ayarlar > Ses'ten "İndir ve kur".
  - **Motorlar** (`voice/engines.ts`, tek kopya, ilk kullanımda yüklenir; `disposeVoiceEngines` `will-quit`'te):
    - `voice/whisper.ts` → `WhisperServer`: `whisper-server.exe -m .. -l tr --host 127.0.0.1 --port <boş port> -t min(16, çekirdek-4)`, hazır olana kadar `GET /` yoklanır, `POST /inference` (file, json, temperature 0, language tr, **`audio_ctx`**), 10 dk kullanılmazsa kapanır. **Hız ölçümü (3 sn cümle):** 8 iş parçacığı tam pencere 8,2 sn; 16 iş parçacığı 6,5 sn; istek başına `audio_ctx` (`audioContextFor`: süre×50+64, en az 512, en çok 1500) ile **1,9 sn**, metin aynı.
    - `voice/piper.ts` → `PiperVoice`: `piper.exe --model .. --json-input --quiet` sürekli açık; her satır `{text, output_file}`, program yolu yazınca dosya okunur. İlk cümle 4,6 sn (model yükleme), sonrakiler ~175 ms. İstekler sıralı.
    - `voice/wakeword.ts` → `WakeWordDetector` (onnxruntime-node, 1 iş parçacığı): 80 ms (1280 örnek) parça → 480 örnek bağlamla mel (32 bant, `/10+2`) → 76 mel penceresi → 96 boyutlu gömme → son 16 gömme → puan. Ölçüm: sessizlik 0,000, ilgisiz cümle 0,000, Piper'ın Türkçe sesiyle "Hey Carvis" 0,98-0,998; sayfaya verilen seste 0,88.
    - `voice/vad.ts` → `SileroVad` (v5: girişler `input` [1,576] = 64 bağlam + 512, `state` [2,1,128], `sr` **skaler** int64; çıkış `output`, `stateN`).
  - **Saf mantık (lib, testli):** `endpointer.ts` (konuşma başı 120 ms, bitişi 800 ms sessizlik, 320 ms ön kayıt, en fazla 15 sn, 7 sn konuşma yoksa zaman aşımı, konuşurken eşik 0,15 düşük), `sentences.ts` (akıştaki cevabı en az 24 karakterlik cümlelere böler), `voiceCommands.ts` (`parseConfirmation` evet/hayır, ret önce; `isStopRequest` ≤4 kelime, "durum" hariç, "yeter/görüşürüz/bitir" kelime içinde de aranır: whisper "Tamam, yeter"i "Taman diyeterli" yazdı), `transcript.ts` (`[BLANK_AUDIO]`, (müzik) siler; kısa uydurma altyazı cümlelerini Türkçe küçük harfle yakalar: "İ" `/i` ile "i" sayılmıyor). `shared/wav.ts` (16 bit WAV kodla/çöz, yeniden örnekle), `shared/speechText.ts` (`plainForSpeech`, eskiden renderer'daydı).
  - **Sesli sohbet** (`voice/session.ts`): aşamalar `off → wake → capturing → transcribing → responding`, `sessionActive` iken cevaptan sonra uyandırma beklemeden yeniden dinler. Arayüzden gelen parçalar kuyrukta (en fazla 25) sırayla işlenir. Uyanınca `wake` olayı (arayüz iki notalı ses çalar), whisper/Piper/VAD önceden ısıtılır. Yazıya çevrilen metin: onay bekleniyorsa evet/hayır; "dur/yeter" ise "Görüşmek üzere" ve biter; değilse `sendMessage(..., { source: 'voice', onDelta, onFinish })` (sohbet `ReplyOptions` aldı, sesli kaynakta talimata "kısa konuş, Markdown yok" eklenir). Cümleler üretildikçe `play` olayıyla sırayla gönderilir (Piper yoksa `audio: null` → Windows sesi); `generation` her iptalde artar, geç gelen eski sesler çalınmaz; arayüz `playbackEnded` bildirmezse tahmini süre + 8 sn sonra bitmiş sayılır. Araç onayı istenince (`onApprovalRequested`) soru sesli sorulur, sonra dinlenir. "Anlaşılamadı" 2 kez olursa biter. **Dinleme süresi saatle de sınırlı** (7 sn + 1,5 sn): sadece gelen parçalarla sayınca mikrofon ses göndermediğinde sohbet sonsuza kadar dinlemede takıldı. **Söz kesme** (`voiceBargeIn`, varsayılan kapalı): Jarvis konuşurken VAD ≥0,9 ve 500 ms → susup dinler; hoparlörde kendi sesini duyabileceği için kulaklık önerilir (yankı iptali Piper/Windows sesini iptal etmeyebilir, denenmedi).
  - **Ayarlar:** `sttProvider` artık `local | groq | openai` (`SPEECH_PROVIDERS.local` anahtarsız), `ttsEngine` (`windows | piper`), `wakeWordEnabled`, `wakeWordThreshold` (0,2-0,9, varsayılan 0,5), `voiceBargeIn`. `applySettingsPatch` uyandırma değişince `refreshVoiceSession`.
  - **IPC** (`voice:` ön eki): `packStatus`, `installPack`, `state`, `pushAudio` (on, Float32Array IPC'de Float32Array olarak geliyor), `startTurn`, `stopSession`, `speak`, `stopSpeaking`, `playbackEnded` (on); olaylar `voice:event` (`pack`, `phase`, `wake`, `caption`, `play`, `stop-playback`, `error`).
  - **Arayüz:** `lib/voiceClient.ts` (tek kopya, `initVoiceClient` App'te): aşama `off` değilse mikrofon açık; `getUserMedia` (yankı iptali, gürültü engelleme, otomatik kazanç) → `lib/voiceCaptureWorklet.ts` (AudioWorklet, `?worker&url` ile yüklenir, ortalamayla 16 kHz'e indirir, 1280 örnek gönderir; çıkışa sıfır kazançla bağlı olmalı) → `voice.pushAudio`. Oynatıcı `play` kuyruğunu sırayla çalar (WAV → `decodeAudioData`, yoksa `speechSynthesis`), `useVoice()` altyazılar/hata/paket durumu. `lib/audioLevel.ts`: giriş ve çıkış seviyesi; küre dinlerken mikrofona, konuşurken Jarvis'in sesine tepki verir. `assistantState` → `setVoicePhase` (capturing = dinliyor, transcribing = düşünüyor). Ana Sayfa: küreye dokun = başlat/bitir, ipucu metni, "Sen / Jarvis" altyazı kartı, "Sohbette aç" (`chatRequests.requestOpenConversation`), "Sesli sohbeti bitir". Sohbetteki "sesli oku" ve `speakReplies` artık ana süreçte seçili motorla (`voice.speak`). `recorder.ts` kaydı 16 kHz WAV'a çevirir (yerel whisper için; bulut servisleri de kabul ediyor). Ayarlar > Ses baştan yazıldı: paket listesi ve indirme ilerlemesi, "Hey Jarvis" + eşik kaydırıcısı (bırakınca kaydeder), söz kesme, üç konuşma tanıma seçeneği, iki ses seçeneği, "Sesi dene".
  - **Simge:** `scripts/make-icon.mjs` (`npx electron scripts/make-icon.mjs`): lacivert yuvarlak kare, ışıyan mavi halka ve ses dalgası → `build/icon.png`, `build/icon.ico` (16-256, PNG gömülü), `resources/icon.png`.
  - **Paketleme:** `electron-builder.yml` `asarUnpack`'e `node_modules/onnxruntime-node/**` eklendi. **Kurulum paketinde denenmedi** (AudioWorklet'in `file://` altından yüklenmesi, onnxruntime'ın asar dışından yüklenmesi, Silero'nun `?asset` yolu).
  - **Doğrulandı:** 34 test dosyası, 178 test (yeni: wav, endpointer, sentences, voiceCommands, transcript, pack, whisper `audioContextFor`; `voice/voice.integration.test.ts` gerçek modellerle Piper → VAD → whisper ve uyandırma puanları, paket yoksa/CI'da atlanır). Uygulamada (CDP, gerçek mikrofon sıfır ses verdiği için Piper sesleri sayfadan `voice.pushAudio` ile verildi): "Hey Carvis" 0,88 ile uyandı → "Listeme test ekmek al görevine ekli." → `gorev_ekle` (etkinlik kaydında kaynak `voice`) → Piper ile "Görevinizi 'Test ekmek al' başlığıyla listeme ekledim." → yeniden dinleme; sessiz dinleme 8,75 sn'de bitti. Test verileri silindi, ayarlar eski haline döndü. **Denenmedi:** gerçek mikrofonla uyandırma, sesli onay, söz kesme, HUD penceresi (yapılmadı, sonraya).
- [ ] **Tur J: Otomasyon motoru.** `automations` / `automation_runs`, tetikleyici → koşul → eylem, hazır rutinler, sohbetten rutin kurma, kuru çalıştırma, model yönlendirici (`ai/router.ts`). Tur G'deki `source: 'automation'`, `allowance`, `external` burada kullanılacak.
- [ ] **Tur K: Hafıza Merkezi 2.0 ve proaktif Jarvis.** `bge-m3` + `sqlite-vec` anlamsal arama, kişisel bilgi tabanı, proaktif gözlemler.
- [ ] **Tur L: Bilgisayarı yönetme.** Ekranı görme, pencere/sistem kontrolü, geri dönüşüm kutusuna dosya işleri, ayrı profilli tarayıcı otomasyonu, deneysel fare/klavye ajanı, uzun görev kuyruğu.
- [ ] **Tur M: Her yerde Jarvis.** MCP istemcisi, Telegram botu, Home Assistant, Spotify, toplantı yardımcısı.
- [ ] **Tur N: Analizler ve Başarımlar.** `activity_log` üzerinden istatistikler, rozetler, haftalık rapor.

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
- **Uzun belgede otomatik devam okuma güvenilmez:** Ekli uzun belgenin sonu sorulunca `qwen3:14b` bazen `belge_oku` aracını çağırmak yerine "belge_oku 132" gibi düz metin yazıyor veya "okumam gerekiyor" deyip duruyor. Açıkça "10. bölümü belge_oku ile oku" denince aracı doğru çağırıyor (onay kartı dahil test edildi). Bulut modellerinde veya Tur D'deki iyileştirmelerle yeniden denenmeli.
- **Sohbetten tekrarlayan hatırlatma:** Esnek şemadan sonra "Her gün sabah 9'da vitamin almamı hatırlat" isteğiyle hatırlatma hatasız kuruluyor, ama `qwen3:14b` `tekrar` alanını boş bırakıp tek seferlik kurdu. Tekrar, Görevler sayfasındaki seçimle elle ayarlanabilir; bulut modellerinde yeniden denenmeli.
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
   ├─ pages/                HomePage, ChatPage, TasksPage, CalendarPage, NotesPage (Hafıza Merkezi), SettingsPage
   ├─ components/jarvis/    Orb (canvas küre), Logo
   ├─ components/home/      CommandBox, QuickAccess, SystemStatusCard, QuoteCard, HomeCard
   ├─ components/activity/  ActivityList (Ayarlar ve Ana Sayfa)
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
  4. Modülde **her araç için `risks`** (`read`/`write`/`dangerous`) yazılır; eksikse `tools/modules.test.ts` başarısız olur ve sarmalayıcı aracı güvenlik için `dangerous` sayar. Kendi ayrıntılı onay kartını gösteren araç `selfApproval` listesine eklenir; listede olmayan write/dangerous araçlara gerektiğinde genel onay kartı sarmalayıcıda gösterilir. Etkinlik kaydı sarmalayıcıda otomatik yapılır, araç içinde ayrıca yazılmaz.
  5. Araç açıklamaları ve alan açıklamaları Türkçe ve net olmalı. Küçük yerel modeller boş bırakılması gereken isteğe bağlı alanları doldurmaya meyilli, bu yüzden "SADECE kullanıcı söylediyse doldur" gibi yazılır.
- **Riskli araç eklerken:** aracın `execute` fonksiyonunda işi yapmadan önce `await requireApproval({ toolName, label, summary, details })` çağrılır. Onay verilmezse fonksiyon hata fırlatır ve iş yapılmaz.
- **Komut çalıştırma:** rastgele shell komutu çalıştırılmaz. Gerekirse sabit komut + sabit argümanlar kullanılır (`execFile`), modelden gelen metin doğrudan komuta girmez.
- **Veri değişim olayı:** IPC'deki değiştirici işlemler `changing(scope, ...)` ile sarılır. Sayfalar veriyi `useLiveData(load, scope)` ile alır ve kendiliğinden yenilenir.
- **`data/` klasörü** `electron` import etmez. Electron'a bağlı işler `events.ts`, `scheduler/`, `settings.ts`, `ai/` içinde durur.
- **Renderer**, Node/Electron'a doğrudan erişmez, sadece `window.api` kullanır. Ham `ipcRenderer` açılmaz.
- **Veritabanı migration:** `src/main/db/index.ts` içindeki `migrations` dizisinin **sonuna** yeni eleman eklenir. Mevcut elemanlar asla değiştirilmez (`PRAGMA user_version` ile takip edilir). Şu an sürüm 8.
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
- Windows'ta yüklü tek konuşma sesi: "Microsoft Tolga - Turkish (Turkey)" (tr-TR). Sesli okuma bunu kullanıyor.
- Mikrofon: Intel Smart Sound dijital mikrofon dizisi; Electron izni verildi.
- Uygulama verisi: `%APPDATA%\kisisel-asistan\asistan.db`

## Kullanıcıdan gerekecekler (zamanı gelince)

- Aşama 4: Tavily API anahtarı (web arama)
- Aşama 5: Google Cloud OAuth istemcisi (Desktop app). Ekran ekran rehber verilecek.
- Aşama 6: Mikrofonla yazmak için Groq (ücretsiz) veya OpenAI API anahtarı. Sesli okuma için gerekmiyor.
- İsteğe bağlı: OpenAI, Gemini veya Claude API anahtarı (bulut modelleri için)
