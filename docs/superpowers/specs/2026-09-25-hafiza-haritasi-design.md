# Hafıza Haritası (3B beyin/mind-map görünümü) — Tasarım

## Bağlam

Kullanıcı bir YouTube videosunda (zubair-trabzada/holo-gestures ekosistemine ait "tam JARVIS"
ürününden bir kesit) notların/hafızanın 3B bir düğüm grafiği (bağlantılı bir "beyin haritası")
olarak gösterildiğini gördü ve bunun bu uygulamaya da eklenmesini istedi. Proje, Tur K'den beri
`bge-m3` ile notlar ve hafıza kayıtları için gömme (embedding) vektörü hesaplıyor ve bunları
kosinüs benzerliğiyle karşılaştırıyor (`lib/cosine.ts`, `lib/semanticSearch.ts`) — bu özellik o
altyapıyı görsel bir haritaya dönüştürüyor.

## Kapsam (v1)

- **Veri:** notlar (`notes`) ve hafıza kayıtları (`memories`) birlikte, tek haritada.
- **Bağlantılar:** sadece otomatik anlamsal benzerlik (embedding kosinüs benzerliği). Elle
  bağlantı kurma (iki kartı sürükleyip "ilişkili" demek) v1 dışı, sonraya bırakıldı.
- **Konum:** Hafıza Merkezi sayfası (`pages/NotesPage.tsx`) üstünde bir **"Liste / Harita"**
  geçiş düğmesi; liste mevcut haliyle kalır (arama, düzenleme, "Asistanın hafızası" sekmesi
  dokunulmadan), harita ayrı, isteğe bağlı bir görünüm.
- **Görsel tarz:** gerçek 3B (WebGL, three.js render — mevcut `orbit3d.ts`'in aksine bu kez sahne
  gerçekten çiziliyor).
- **Gezinme:** v1'de sadece fare/trackpad (three.js `OrbitControls`: döndür, yakınlaştır). El
  kontrolü entegrasyonu (pinch ile döndürme/seçme) kasıtlı olarak v1 dışı, ayrı bir sonraki adımda
  eklenecek.
- **Performans üst sınırı yok:** düğüm sayısı 50-100'ü geçerse simülasyon yavaşlayabilir; şimdilik
  önemsenmiyor, gerekirse ileride optimize edilecek (ör. düğüm sayısı üst sınırı, iterasyon
  azaltma).

## Mimari / veri akışı

- Yeni bir bileşen: `components/notes/MemoryGraph.tsx`. `NotesPage.tsx`'e görünüm anahtarıyla
  bağlanır (`view: 'list' | 'graph'`, sayfa içi state, kalıcı olmasına gerek yok).
- Benzerlik hesaplama **renderer'da** yapılır (main sürece ekstra yük binmesin diye). Bunun için
  embedding'i temizlemeden (`stripEmbedding` uygulanmadan) döndüren yeni bir IPC uç noktası
  gerekiyor: `memories:listWithEmbeddings` / `notes:listWithEmbeddings` (veya mevcut `list`'e
  `{ includeEmbedding: true }` gibi bir seçenek — üç dosyalık IPC deseni izlenerek `shared/api.ts`,
  `main/ipc.ts`, `preload/index.ts` güncellenir). Bu uç nokta sadece harita bileşeni tarafından,
  sadece harita görünümü açıkken çağrılır.
- Ana süreçteki mevcut arama/embedleme akışına (K3-K6) dokunulmaz.

## Yerleşim algoritması

- Yeni saf mantık dosyası: `lib/graphLayout.ts` (electron'suz, test edilebilir).
- Girdi: düğüm listesi (id, tür: not/hafıza, embedding varsa vektör) + önceden hesaplanmış kenar
  listesi (kosinüs benzerliği eşiği ör. 0.55 üstü, her düğüm için en fazla 4-5 en güçlü bağlantı).
- Basit 3B kuvvet yönlendirmeli (force-directed) simülasyon: düğümler birbirini iter (Coulomb
  benzeri), bağlı düğümler arasında yay çeker (Hooke benzeri), sabit sayıda iterasyon (~150-200)
  çalıştırılıp durur. Yeni bir npm bağımlılığı **eklenmiyor** — three.js zaten var, geri kalanı saf
  matematik.
- Konumlar **veri değiştiğinde bir kez** hesaplanıp önbelleğe alınır (`useMemo`/state), her karede
  yeniden hesaplanmaz.
- Embedding'i olmayan kayıtlar (anlamsal arama kapalıyken eklenmiş) bağlantısız, rastgele/sabit bir
  konumda tek başına durur.

## Render ve etkileşim

- Gerçek three.js sahnesi (`WebGLRenderer`), `OrbitControls` (three.js'in kendi paketinde gelir,
  ek bağımlılık yok) ile fare/trackpad döndürme-yakınlaştırma.
- Düğüm: küçük küre (`SphereGeometry`), tür bazlı renk (not = `accent`, hafıza = ikincil ton).
  Kenar: ince çizgi (`LineBasicMaterial`), benzerlik gücüne göre opaklık.
- Raycasting ile fare pozisyonundan hover/click: hover'da başlık/ilk birkaç kelime tooltip'te
  görünür; tıklayınca o kaydın mevcut düzenleme paneli açılır (`NotesView`'daki akış).
- Tema: mevcut "sakin premium" tema (koyu zemin, `accent`/`glow` tonları), abartısız parlaklık.

## Geri dönüş durumları

- `semanticSearchEnabled: false` **veya** embedding'i olan hiç kayıt yoksa: harita yerine
  "Haritayı görmek için önce Ayarlar > Asistan'dan 'Anlamsal arama'yı aç" mesajı + Ayarlar'a giden
  düğme.
- Hiç not/hafıza kaydı yoksa: "Henüz kayıt yok" mesajı.

## Test

- `lib/graphLayout.ts`: birim testli. Küçük sabit girdilerle (ör. 3 düğüm, bilinen benzerlik
  değerleri) beklenen göreli yerleşim doğrulanır: düğümler çakışmaz, güçlü bağlı olanlar zayıf
  bağlı olanlardan daha yakın durur.
- Three.js render/etkileşim (hover, tıklama, görünüm geçişi): her zamanki gibi CDP ile canlı test
  (`scripts/cdp.mjs`), gerçek not/hafıza verisiyle.
- Mevcut testler (liste görünümü, arama) bu değişiklikten etkilenmeyeceği için regresyon riski
  düşük — yine de tam suite (`npm run test`) çalıştırılır.

## Yapılmayacaklar (v1 dışı, belgelenmiş bilinçli kararlar)

- Elle bağlantı kurma (düğümleri sürükleyip ilişkilendirme).
- El kontrolüyle (kamera/pinch) haritada gezinme.
- Büyük veri seti performans optimizasyonu (düğüm sayısı üst sınırı, iterasyon azaltma).
