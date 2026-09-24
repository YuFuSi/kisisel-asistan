import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const TIMEOUT_MS = 15_000
const PS_ARGS = ['-NoProfile', '-NonInteractive', '-Command']

export interface WindowInfo {
  /** Süreç kimliği (pid); pencereyi sonraki bir çağrıda bulmak için kullanılır */
  id: number
  title: string
  processName: string
}

interface RawWindow {
  Id: number
  ProcessName: string
  MainWindowTitle: string
}

/** Görünür başlığı olan (görev çubuğunda görünen) pencereleri listeler. Sabit bir komut çalıştırılır. */
export async function listWindows(): Promise<WindowInfo[]> {
  const script =
    "Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | " +
    'Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress'
  const { stdout } = await run('powershell.exe', [...PS_ARGS, script], {
    windowsHide: true,
    timeout: TIMEOUT_MS,
    maxBuffer: 2 * 1024 * 1024
  })
  const parsed = JSON.parse(stdout.trim() || '[]') as RawWindow | RawWindow[]
  return (Array.isArray(parsed) ? parsed : [parsed])
    .filter((item) => item?.MainWindowTitle)
    .map((item) => ({ id: item.Id, title: item.MainWindowTitle, processName: item.ProcessName }))
}

// user32.dll ShowWindow sabitleri
const SW_MINIMIZE = 6
const SW_RESTORE = 9

/** PowerShell komutuna gömülmeden önce kimliğin gerçekten bir pozitif tam sayı olduğunu doğrular */
export function isValidWindowId(id: number): boolean {
  return Number.isInteger(id) && id > 0
}

/** Pencereyi id (pid) ile bulup verilen Win32 eylemini uygular; komuta sadece doğrulanmış bir tam sayı gömülür. */
async function runWindowAction(id: number, action: string): Promise<void> {
  if (!isValidWindowId(id)) throw new Error('Geçersiz pencere kimliği.')
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -Namespace JarvisWin -Name Native -MemberDefinition '
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr hAfter, int x, int y, int cx, int cy, uint flags);
'
$p = Get-Process -Id ${id}
if ($p.MainWindowHandle -eq 0) { throw 'Bu sürecin görünür bir penceresi yok.' }
${action}
`
  await run('powershell.exe', [...PS_ARGS, script], { windowsHide: true, timeout: TIMEOUT_MS })
}

// SetWindowPos bayrakları: konum/boyut değişmeyen kısım korunur, öne getirme/odaklama yapılmaz
const SWP_NOSIZE = 0x0001
const SWP_NOMOVE = 0x0002
const SWP_NOZORDER = 0x0004
const SWP_NOACTIVATE = 0x0010

export function isValidCoordinate(n: number): boolean {
  return Number.isInteger(n) && Math.abs(n) < 20000
}

export function isValidSize(n: number): boolean {
  return Number.isInteger(n) && n > 0 && n < 20000
}

/** Pencereyi ekranda verilen konuma taşır; boyutu değişmez */
export function moveWindow(id: number, x: number, y: number): Promise<void> {
  if (!isValidCoordinate(x) || !isValidCoordinate(y)) throw new Error('Geçersiz konum.')
  const flags = SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE
  return runWindowAction(
    id,
    `[JarvisWin.Native]::SetWindowPos($p.MainWindowHandle, [IntPtr]::Zero, ${x}, ${y}, 0, 0, ${flags}) | Out-Null`
  )
}

/** Pencereyi verilen boyuta getirir; konumu (sol üst köşe) değişmez */
export function resizeWindow(id: number, width: number, height: number): Promise<void> {
  if (!isValidSize(width) || !isValidSize(height)) throw new Error('Geçersiz boyut.')
  const flags = SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE
  return runWindowAction(
    id,
    `[JarvisWin.Native]::SetWindowPos($p.MainWindowHandle, [IntPtr]::Zero, 0, 0, ${width}, ${height}, ${flags}) | Out-Null`
  )
}

/** Pencereyi öne getirir (önce simge durumundan çıkarır) */
export function focusWindow(id: number): Promise<void> {
  return runWindowAction(
    id,
    `[JarvisWin.Native]::ShowWindow($p.MainWindowHandle, ${SW_RESTORE}) | Out-Null
[JarvisWin.Native]::SetForegroundWindow($p.MainWindowHandle) | Out-Null`
  )
}

/** Pencereyi görev çubuğuna küçültür */
export function minimizeWindow(id: number): Promise<void> {
  return runWindowAction(
    id,
    `[JarvisWin.Native]::ShowWindow($p.MainWindowHandle, ${SW_MINIMIZE}) | Out-Null`
  )
}

// WM_CLOSE: programın kendi "kapat" mantığını çalıştırır (kaydetme sorusu vb. çıkabilir),
// süreci zorla öldürmez
const WM_CLOSE = 0x0010

/** Pencereye kapanma mesajı gönderir; program kendi kapatma akışını (ör. kaydetme sorusu) çalıştırır */
export function closeWindow(id: number): Promise<void> {
  return runWindowAction(
    id,
    `[JarvisWin.Native]::PostMessage($p.MainWindowHandle, ${WM_CLOSE}, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null`
  )
}
