# Tasarım turu

Tarih: 2026-09-29. Durum: kullanıcı onayladı (taslaklar sohbette gösterildi).

## Kararlar

- Sadece koyu tema (açık tema yok). Sakin premium kimlik korunur: grafit zemin, lila vurgu.
- Menü 9 → 6 sayfa + Ayarlar: **Ana Sayfa · Asistan · Planlama · Takvim · Hafıza · Analizler**, Ayarlar en altta.
  - Planlama = Görevler + Hatırlatmalar + Rutinler (sekmeler). Otomasyonlar ayrı sayfa olmaktan çıkar.
  - Başarımlar → Analizler'in içinde bir bölüm.
  - Kamera (deneme) zaten menüde yok (komut paletinde).
- Önemli sayfalar için taslak gösterilip onay alındı: Ana Sayfa, Planlama, Hafıza, "Her yerde Pıtır" katmanı.

## Aşamalar (her biri ayrı PR + ekran görüntüsüyle doğrulama)

1. **Hatalar ve teknik gürültü:** Ana Sayfa'da "İyi geceler" başlığı altında "Günaydın" diyen kişisel not; Otomasyonlar'da görünür "Rutini kapat" etiketi; Analizler'de kesilen kart yazıları; "Anlamsal arama açık, İndeksle" uyarıları (indeksleme arka planda kendiliğinden yapılır).
2. **Yapıyı sadeleştirme:** 6 sayfalık menü; Planlama sayfası iskeleti (sekmeler); Başarımlar'ın Analizler'e taşınması; Hafıza tek sekme sırası (Pıtır'ın bildikleri · Notlarım · Harita); başlık çubuğundaki 6 etiketsiz ikon yerine sadece saat/tarih, durumlar sadece sorun varken uyarı; sol menü altındaki "Sistem hazır" bloğu kalkar.
3. **Ortak sayfa iskeleti:** aynı başlık, genişlik, boş durum, yükleniyor ve hata görünümü her sayfada.
4. **Ana Sayfa ve Pıtır hissi:**
   - Anlamlı 3 kart (sıradaki iş geri sayımlı, bugünün görevleri, hava), selam adla.
   - Küre renk dili (uyarı, başarı, hata).
   - **"Her yerde Pıtır" katmanı:** (a) küre hiç kaybolmaz; Ana Sayfa dışında sol üstte küçük yaşar ve durumu gösterir; (b) "Hey Jarvis" (yakında Hey Pıtır) / küreye tıklama / Ctrl+Space ile hangi sayfada olursa olsun sayfa kararır, küre ortaya büyür, konuşma sinema altyazısı gibi akar, bitince köşeye döner; (c) cevaba eşlik eden kartlar (etkinlik, görev, hava; kullanılan araçtan seçilir, tıklanınca ilgili sayfa). Katman kullanıcı yazı yazarken araya girmez.
5. **Sayfa sayfa iyileştirme:** Planlama (tek kutudan hızlı ekleme, Gecikmiş/Bugün/Yaklaşan gruplama, tamamlananlar katlanır, "Yeni rutin" düğmeyle açılır), Takvim (seçili gün saat çizelgesi), Hafıza (profil kimlik kartı, yeni öğrenilenler şeridi, türe göre gruplar), Asistan (sohbet listesi daraltılabilir), Analizler.
6. **Cila:** sayfa geçiş animasyonları, tutarlılık kontrolü.
