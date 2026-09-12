# Kişisel Asistan: Proje Notları

> Bu dosya projenin hafızası. Claude Code her oturumun başında otomatik okur.
> Her aşama bitince **Nerede kaldık** ve **Yol haritası** bölümleri güncellenir.

## Nerede kaldık

- **Son güncelleme:** 2026-09-12
- **Tamamlanan:** Aşama 0-4 ve 6. Aşama 5'in kodu hazır (hesap bağlanınca test edilecek). Bölüm 2'de **Tur A (arayüz)**, **Tur B (sohbet deneyimi)** ve **Tur C (yeni yetenekler)** bitti.
- **Sıradaki adım:** Tur D (asistanın zekası). Kullanıcı isterse D ve E'den önce Tur F'ye (kurulum) geçilebilir; bu seçenek kendisine sunuldu.
- Bekleyen iki test: Google hesabı bağlanınca Gmail/Takvim (Tur C'deki yanıtlama, arşivleme, etkinlik güncelleme/silme dahil), Groq anahtarı girilince mikrofonla yazma.
- **Google bağlantı denemesi:** Kullanıcı 2026-09-12'de hesabı bağlamayı denedi, "Gmail hesabı bilgisi alınamadı" hatası aldı (Gmail profil isteği başarısız). Olası nedenler: Cloud projesinde Gmail API etkin değil veya giriş ekranında izin kutucukları işaretlenmedi. Hata mesajları artık bu iki durumu Türkçe açıklıyor (`src/main/google/errors.ts`); profil alınamazsa yarım bağlantı kaydedilmiyor.
- **Veritabanı ve gizli anahtar olayı (2026-09-12/13):** Uygulamanın gördüğü veritabanı içeriği iki kez beklenmedik şekilde değişti.
  - Tur C sonunda (22:33) sohbetler, görevler, notlar ve hafıza boştu ama sayaçlar yüksekti (satırlar silinmiş). O sırada `asistan.db` 4 KB, `-wal` 3,1 MB idi; yani veri hiç ana dosyaya aktarılmamış, tamamı WAL'deydi. Geliştirme sunucusu her seferinde süreç ağacı öldürülerek kapatıldığı için `closeDb` hiç çalışmamış olabilir.
  - 23:11'de geliştirme sunucusu açılınca bambaşka bir geçmiş göründü: sayaçlar 1-3, 19:59'da açılmış bir "Merhaba sohbeti", `googleAccount` dolu, gizli anahtarlar yeniden kayıtlı. Önceki 22:33 okumasında bu kayıtlar yoktu. Kesin neden bulunamadı.
  - Bu yeni kayıttaki Google istemci bilgileri, yenileme anahtarı ve Tavily anahtarı çözülemiyor (`safeStorage.decryptString` hatası). Aynı uygulamada yeni yazılan geçici bir değer yazılıp okunabildi; yani şifreleme çalışıyor, eski anahtarlar farklı bir şifreleme kimliğiyle yazılmış. Kullanıcı Google istemci bilgilerini, Tavily anahtarını yeniden girmeli ve Google'ı yeniden bağlamalı.
  - **Yapılacak (Tur E):** WAL'i düzenli aktarmak (`PRAGMA wal_checkpoint`), kapanışta temiz kapatma, otomatik yedek. Test sırasında süreç öldürmeden önce uygulamayı düzgün kapatmayı araştır.
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
- [ ] **Tur E: Güvenilirlik.** Hata günlüğü dosyası, yedekleme, arayüz testleri.
- [ ] **Tur F (eski Aşama 7): Paketleme ve otomatik güncelleme.**

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
- **Veritabanı migration:** `src/main/db/index.ts` içindeki `migrations` dizisinin **sonuna** yeni eleman eklenir. Mevcut elemanlar asla değiştirilmez (`PRAGMA user_version` ile takip edilir). Şu an sürüm 6.
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
