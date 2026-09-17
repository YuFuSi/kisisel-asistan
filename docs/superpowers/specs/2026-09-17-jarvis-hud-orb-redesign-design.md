# Jarvis HUD Yeniden Tasarımı — Ana Sayfa ve Küre (Orb)

**Tarih:** 2026-09-17
**Kapsam:** Bu turda sadece Ana Sayfa (`pages/HomePage.tsx`) ve Küre bileşeni (`components/jarvis/Orb.tsx`). Sohbet ekranı, yan menü, diğer sayfalar bu turun kapsamı dışında; aynı görsel dil onaylandıktan sonra ayrı bir turda taşınacak.

## Bağlam ve motivasyon

Tur H'de kurulan mevcut Jarvis kimliği (koyu lacivert zemin, tek renkli mavi vurgu, cam kart bileşenleri, canvas tabanlı dalga+kıvılcım küre) kullanıcı tarafından "aşırı basit, profesyonel hissettirmiyor" olarak değerlendirildi. Tarayıcı tabanlı görsel beyin fırtınası (superpowers brainstorming) ile alternatif yönler karşılaştırıldı; kullanıcı Instagram'daki "sinematik Jarvis HUD" videolarından ve Pinterest'teki iridesan parçacık küre/halka referanslarından ilham alarak net bir yön onayladı.

## Onaylanan görsel yön: Sinematik HUD

- Koyu, neredeyse siyah zemin (`#05070c` civarı), tek renkli mavi vurgu yerine **çok renkli, sürekli akan bir palet** (mavi → mor → magenta → altın döngüsü).
- İnce ışıklı çizgiler, **monospace** veri etiketleri (`GÖREVLER · 3 AKTİF` gibi büyük harf, harf aralıklı).
- Bilgi kartları yerine **sayfa üzerinde serbest duran metin blokları** (köşelerde HUD paneli hissi), gerekirse ince bir ayraç çizgisiyle ayrılmış.
- Köşelerde ince HUD çerçeve işaretleri (isteğe bağlı, ileride ince ayar).
- Arka planda çok hafif, sabit bir yıldız/parçacık dokusu (hareket etmeyen, sadece doku).

Bu doküman kapsamında **kesinleşmeyen** ama gelecekte ele alınacak öğeler: köşe HUD çerçeveleri, tarama çizgisi (scanline), ızgara zemin, film greni — bunlar demo aşamasında "çok fazla" bulunup gerçek tasarımdan çıkarıldı; sade tutulacak.

## Küre (Orb) — davranış tasarımı

Mevcut `Orb.tsx` canvas 2D yaklaşımı korunur (yeni bir render teknolojisi/kütüphane eklenmez), ama iç render mantığı gerçek bir **parçacık sistemine** (fibonacci sphere dağılımlı nokta bulutu) geçirilir; düz gradyan disk yaklaşımı bırakılır.

### Durumlar ve hareket

| Durum | Form | Hareket | Renk |
|---|---|---|---|
| **idle (beklemede)** | Dolgun küre | **Dönmez.** Sadece nefes alır gibi çok hafif büyüyüp küçülür (ölçek pulsu, ör. 4 sn periyot). | Yavaş, sürekli çok renkli akış (temel döngü) |
| **listening (dinliyor)** | Küre → halkaya açılır (yumuşak morph) | Parçacıklar **40 frekans bandına** bölünür, her bant gerçek mikrofon giriş seviyesine (mevcut `getInputLevel`/AnalyserNode altyapısı) göre içe/dışa hareket eder — gerçek bir ekolayzer gibi. | Temel akışa ek olarak dinlerken hafif canlanma |
| **thinking/working (düşünüyor/çalışıyor)** | Halka | Parçacıklar **kaotik şekilde savrulup geri toplanır** (ilk tercih; ince ayara açık — uygulama sırasında gerçek üründe hissi kötü gelirse "akan veri çizgileri" alternatifine dönülebilir). | Temel akışa ek olarak daha sıcak/turuncu-kehribar tonlara hafif kayma |
| **speaking (konuşuyor)** | Halka | Parçacıklar gerçek **TTS çıkış ses seviyesine** (mevcut oynatma seviyesi altyapısı) göre nabız atar. | Temel akışa ek olarak daha canlı/doygun |

### Renk sistemi

- **Taban katman:** durum ne olursa olsun sürekli çalışan, yavaş bir çok-renkli döngü (hue döngüsü: ~205°(mavi) → 255°(mor) → 300°(magenta) → 335°(pembe) → 45°(altın) → başa dön).
- **Durum katmanı:** taban döngüye durum bazlı bir renk sıcaklığı/doygunluk eğilimi eklenir (ör. düşünürken sıcak uca, konuşurken doygunluğa kayma). İki katman birbirini geçersiz kılmaz, üst üste biner.

### Performans ve erişilebilirlik

- `prefers-reduced-motion` açıkken (mevcut davranış) parçacık hareketi ve renk döngüsü büyük ölçüde durur/yavaşlar, sadece durum değişimi statik olarak yansır.
- Parçacık sayısı ve çizim sıklığı, mevcut `Orb.tsx`'teki performans kısıtlarıyla (görünürlük, düşük öncelik) uyumlu tutulur; bu üründe geliştirme sırasında gerçek FPS ölçülüp gerekirse parçacık sayısı ayarlanır.

## Ana Sayfa — düzen tasarımı

- Küre çok daha büyük ve sayfaya hakim, ortada.
- Karşılama metni (`İyi akşamlar, Yusuf`) ve durum etiketi kürenin üstünde, ortalanmış.
- Sistem/görev/takvim/hafıza özet bilgileri artık kutu kartlar değil, ekranın dört köşesine yakın **serbest duran HUD metin blokları** (etiket + değer, monospace etiket + normal font değer).
- Başlık çubuğunda marka + tarih/saat + çevrimiçi durumu monospace etiketlerle.
- "Son işlemler" ve "Sistem durumu" mevcut bilgi içeriği korunur, sadece görsel sunumu (kutu kart → HUD paneli) değişir.

## Kapsam dışı (bu tur)

- Sohbet ekranı, yan menü/başlık çubuğu diğer sayfalar, Takvim/Görevler/Ayarlar/Hafıza Merkezi sayfaları — aynı HUD diline geçiş ayrı bir sonraki turda ele alınacak.
- Sesli/STT kalite iyileştirmesi (whisper doğruluğu, downsample düzeltmesi, cevap kişiliği) — bu konuşmada ayrıca tasarlandı ama **ayrı bir tur**, bu dokümanın kapsamında değil.
- "Jarvis sizi arasın" tarzı gelen-arama bildirimi konsepti — roadmap'e not düşüldü, ayrı bir tur.

## Test/doğrulama planı

- Birim testi gerekmiyor (görsel/canvas kodu); mevcut `Orb.tsx` testleri varsa (yoksa gerekmez) bozulmamalı.
- CDP ile gerçek uygulamada dört durumun (idle/listening/thinking/speaking) manuel tetiklenip ekran görüntüsü alınması (mevcut test yöntemi: `assistantState` sahte tetikleme veya gerçek sesli oturum simülasyonu).
- `prefers-reduced-motion` açıkken davranış kontrolü.
- Performans: geliştirici araçlarıyla FPS gözlemi, düşük performans durumunda parçacık sayısını azaltma notu.
