import { promises as fs } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

/**
 * `target`'ın gerçekten `root`'un altında olup olmadığını kontrol eder. Salt `startsWith` metin
 * karşılaştırması kardeş klasörlere kanar (ör. kök "C:\Users\ysfll" iken "C:\Users\ysfll2\gizli.txt"
 * yanlışlıkla içeride sayılır); burada `path.relative` ile gerçek bir alt yol olduğu doğrulanır.
 */
export function isWithinRoot(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target))
  return rel !== '' && rel !== '.' && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * `target`'ın (symlink/junction çözülmüş gerçek hâliyle) `root` altında kaldığını doğrular;
 * değilse `message` ile hata fırlatır. `target`'ın önceden var olduğu bilinmelidir (realpath
 * var olmayan yolda hata verir) — çağıran taraf önce `fs.stat` ile kontrol etmelidir.
 */
export async function assertWithinRoot(
  root: string,
  target: string,
  message: string
): Promise<string> {
  let realTarget: string
  try {
    realTarget = await fs.realpath(target)
  } catch {
    throw new Error(message)
  }
  const realRoot = await fs.realpath(root).catch(() => resolve(root))
  if (!isWithinRoot(realRoot, realTarget)) throw new Error(message)
  return realTarget
}
