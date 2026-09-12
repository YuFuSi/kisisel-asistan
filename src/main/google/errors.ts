// Google'ın izin (403) hatalarını kullanıcıya ne yapması gerektiğini söyleyen Türkçe mesaja çevirir.
// electron import etmez; bu yüzden test edilebilir.

/** Bilinen bir izin sorunu varsa Türkçe açıklamasını, yoksa null döndürür. */
export function describeGooglePermissionError(body: string): string | null {
  const text = body.toLowerCase()

  const apiDisabled =
    text.includes('service_disabled') ||
    text.includes('accessnotconfigured') ||
    text.includes('has not been used in project')
  if (apiDisabled) {
    const api = text.includes('calendar')
      ? 'Google Calendar API'
      : text.includes('gmail')
        ? 'Gmail API'
        : 'gerekli Google API'
    return `Google Cloud projende ${api} etkin değil. Google Cloud Console'da "API'ler ve Hizmetler > Kitaplık" bölümünden Gmail API ve Google Calendar API'yi etkinleştir, birkaç dakika bekleyip tekrar dene.`
  }

  const scopeMissing =
    text.includes('access_token_scope_insufficient') ||
    text.includes('insufficientpermissions') ||
    text.includes('insufficient authentication scopes')
  if (scopeMissing) {
    return "Google giriş ekranında istenen izinlerin hepsi onaylanmadı. Ayarlar'dan hesabı yeniden bağla ve izin kutucuklarının hepsini işaretle."
  }

  return null
}
