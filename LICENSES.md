# Üçüncü taraf lisanslar

Bu belge, projeye paketlenen veya çalışma zamanında indirilen model/ikili dosyaların lisanslarını
listeler. npm bağımlılıklarının tam listesi için `npx license-checker --summary` çalıştırılabilir
(proje kodu kendisi henüz açık kaynak olarak lisanslanmadı; bu belge sadece paketlenen/indirilen
üçüncü taraf içerik içindir).

## Depoya dahil edilenler

| Dosya                             | Kaynak                                                        | Lisans |
| --------------------------------- | ------------------------------------------------------------- | ------ |
| `resources/voice/silero_vad.onnx` | [snakers4/silero-vad](https://github.com/snakers4/silero-vad) | MIT    |

## Uygulama tarafından indirilenler (Ayarlar > Ses > "İndir ve kur")

Bu dosyalar depoda durmaz; kullanıcının onayıyla ilk kullanımda `%APPDATA%\kisisel-asistan\voice`
klasörüne indirilir.

| Bileşen                                                                  | Kaynak                                                                            | Lisans     |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ---------- |
| whisper.cpp (`whisper-server.exe`, konuşma tanıma)                       | [ggerganov/whisper.cpp](https://github.com/ggerganov/whisper.cpp)                 | MIT        |
| Piper (`piper.exe`, Türkçe seslendirme)                                  | [rhasspy/piper](https://github.com/rhasspy/piper)                                 | MIT        |
| Piper Türkçe ses modeli (`tr_TR-dfki-medium`)                            | [Hugging Face: rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) | MIT        |
| openWakeWord uyandırma modeli (`hey_jarvis_v0.1.onnx` ve bağlı modeller) | [dscripka/openWakeWord](https://github.com/dscripka/openWakeWord)                 | Apache 2.0 |
| Whisper `ggml-large-v3-turbo-q5_0.bin` modeli                            | OpenAI Whisper (ggml biçimine dönüştürülmüş)                                      | MIT        |

## Ollama üzerinden çalıştırılan yerel modeller

Kullanıcının kendi isteğiyle `ollama pull` ile indirilir, projeye dahil değildir.

| Model                                                 | Kaynak             | Lisans     |
| ----------------------------------------------------- | ------------------ | ---------- |
| `qwen3:14b`, `qwen2.5-coder:14b`, `qwen3-coder:30b`   | Alibaba Qwen ekibi | Apache 2.0 |
| `qwen2.5vl:7b` (görüntü/ekran görme)                  | Alibaba Qwen ekibi | Apache 2.0 |
| `bge-m3` (anlamsal arama için gömme/embedding modeli) | BAAI               | MIT        |

Bu tablo iyi niyetle, modellerin kendi kart/depo sayfalarındaki bilgiye göre hazırlanmıştır; kesin
ve güncel lisans metni için ilgili modelin resmi sayfasına bakılmalıdır. Bir model ticari kullanım
için düşünülüyorsa lisans şartları ayrıca doğrulanmalıdır.

## Native npm bağımlılıkları (öne çıkanlar)

| Paket              | Amaç                               | Lisans       |
| ------------------ | ---------------------------------- | ------------ |
| `better-sqlite3`   | Veritabanı                         | MIT          |
| `onnxruntime-node` | Uyandırma kelimesi ve VAD çıkarımı | MIT          |
| `electron`         | Masaüstü çatısı                    | MIT          |
| `pdfjs-dist`       | PDF okuma                          | Apache 2.0   |
| `mammoth`          | Word (.docx) okuma                 | BSD-2-Clause |
