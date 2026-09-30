// İki kısa satır kadar pay, akış sırasında ufak kaydırmaları takipten çıkarmasın.
export function isNearScrollEnd(
  scroll: { scrollHeight: number; scrollTop: number; clientHeight: number },
  threshold = 80
): boolean {
  return scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight <= threshold
}
