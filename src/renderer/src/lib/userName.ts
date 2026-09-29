// Karşılamadaki ad: profil hafızasından ("... Yusuf diye hitap edilmesini ister", "Kullanıcının adı
// Yusuf") çıkarılır. Emin olunamazsa null; karşılama adsız kalır.

const NAME = '([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)'
const PATTERNS = [
  new RegExp(`${NAME} diye (?:hitap|seslen|çağ)`),
  new RegExp(`Kullanıcının (?:tam )?(?:adı|ismi) ${NAME}(?:[.,'’ ]|$)`)
]

export function findUserName(profileTexts: string[]): string | null {
  for (const pattern of PATTERNS) {
    for (const text of profileTexts) {
      const match = pattern.exec(text)
      if (match) return match[1]
    }
  }
  return null
}
