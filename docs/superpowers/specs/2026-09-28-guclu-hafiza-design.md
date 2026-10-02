# Güçlü hafıza (tek Pıtır zihninin temeli)

Tarih: 2026-09-28. Durum: kullanıcı onayladı.

## Sorun

- Kalıcı hafızaya sadece model `hafizaya_kaydet` aracını çağırmaya karar verirse bir şey yazılıyor. 34 mesajlık Gemini sohbetinden 5 kayıt kaldı.
- Her sohbet ayrı bir ada: yeni sohbette (hangi model olursa olsun) eski konuşmalar görünmüyor. Kullanıcı bunu "Gemini'den Qwen'e geçince hiçbir şey hatırlamıyor" diye yaşadı.
- Hatırlama sabit "en fazla 30 kayıt" ile yapılıyor; konuyla alakalı geçmiş konuşma hiç gelmiyor.

Hedef: kullanıcı unutsa bile Pıtır unutmasın; hangi model seçili olursa olsun aynı Pıtır.

## Kullanıcı kararları

- Çıkarma (hafıza işleyici) **her zaman yerel modelle** (Ollama) yapılır; kişisel bilgi buluta gitmez. Ollama yoksa işleyici bekler, sonra dener.
- Yeni öğrenilenler **sessiz ama görünür**: bildirim yok, Hafıza Merkezi'nde "yeni öğrenilenler" olarak işaretli, kullanıcı gözden geçirip düzeltebilir.
- Eski sohbetlerin **hepsi** işlenir.
- Bulut veritabanı (Supabase vb.) yok; her şey yerel SQLite. Boyut hesabı: 10 yıl yoğun kullanım ~350 MB.

## Tasarım

### Veri (migration 11)

- `memories` genişler: `kind` (`profil | bilgi | tercih | kisi | olay | plan`), `source` (`arac | otomatik | kullanici`), `source_conversation_id` (yabancı anahtar değil: sohbet silinse de öğrenilen bilgi kalır), `updated_at`, `last_used_at`, `reviewed` (otomatik öğrenilen kayıt 0 başlar).
- Yeni `conversation_digests`: sohbet başına tarihli kısa özet, `processed_until` (son işlenen mesaj kimliği), embedding. Sohbet silinince özeti de silinir (CASCADE).

### Öğrenme

- `scheduler/memory.ts`: dakikada bir, son mesajı ≥10 dk önce olan ve `processed_until`'dan yeni mesajı bulunan sohbetleri sırayla işler (eski sohbetlerin geriye dönük işlenmesi de doğal olarak buradan olur). Sesli oturum bitince o sohbet hemen sıraya alınır.
- `ai/memoryProcessor.ts`: yerel modelden JSON ister: `{ ozet, bilgiler: [{ tur, metin }] }`. Ayrıştırma ve doğrulama saf fonksiyon (`lib/memoryExtraction.ts`, testli); bozuk JSON'da o tur atlanır, veri bozulmaz.
- Tekilleştirme: anlam benzerliği (embedding) ≥0,85 ise yeni kayıt açılmaz, mevcut güncellenir; embedding yoksa mevcut kök benzerliği (`findSimilarMemory`).
- Asla kaydedilmez: şifre, kart/hesap numarası, kimlik numarası, API anahtarı (çıkarma talimatı + desen filtresi).

### Hatırlama (modelden bağımsız)

- Her mesajda talimata: çekirdek profil (`kind = profil`, her zaman) + konuyla en alakalı ~12 bilgi + en alakalı ~3 geçmiş konuşma özeti (tarihiyle). Anlamsal arama kapalıysa/embedding yoksa mevcut anahtar kelime sıralamasına düşer.
- Kullanılan kayıtların `last_used_at`'i güncellenir.
- Yeni araç `gecmiste_ara`: konuşma özetlerinde ve mesajlarda arar ("geçen hafta ne konuşmuştuk").

### Arayüz

- Hafıza Merkezi: tür rozeti, "şu sohbetten öğrenildi" bağlantısı, "yeni öğrenilenler" (gözden geçirilmemiş) bölümü ve "tamam" ile onaylama.

## Adımlar

H1 şema + veri katmanı · H2 çıkarma ayrıştırıcısı + işleyici · H3 zamanlayıcı + eski sohbetler · H4 hatırlama + `gecmiste_ara` · H5 arayüz · H6 canlı model değiştirme senaryosu.

## Doğrulama

Birim testleri (veri, ayrıştırma, tekilleştirme, hassas bilgi filtresi). Canlı: Gemini ile bir sohbette bilgi ver → işleyici çalışsın → Qwen ile yeni sohbette sor → hatırlasın.
