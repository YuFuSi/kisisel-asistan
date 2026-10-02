import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface, type Interface } from 'node:readline'

// Her pencere taşıma çağrısı ayrı bir PowerShell süreci başlatmak ~100-300ms sürüyor (Add-Type'ın
// derlenmesi dahil); elle sürüklerken bu gözle görülür bir gecikme yaratıyordu. Bunun yerine tek,
// kalıcı bir PowerShell süreci açık tutulup komutlar JSON satırlarıyla stdin/stdout üzerinden
// gönderiliyor — Add-Type sadece bir kez derleniyor, her komut yalnızca gerçek SetWindowPos
// çağrısı kadar sürüyor (birkaç milisaniye).
const DAEMON_SCRIPT_PATH = join(tmpdir(), 'jarvis-window-daemon.ps1')
const COMMAND_TIMEOUT_MS = 5000

const DAEMON_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -Namespace JarvisWin -Name Native -MemberDefinition '
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr hAfter, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
'
Add-Type -AssemblyName System.Windows.Forms
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $reqId = $null
  try {
    $cmd = $line | ConvertFrom-Json
    $reqId = $cmd.id
    switch ($cmd.op) {
      'move' {
        $p = Get-Process -Id $cmd.pid_ -ErrorAction Stop
        if ($p.MainWindowHandle -eq 0) { throw 'Bu sürecin görünür bir penceresi yok.' }
        [JarvisWin.Native]::SetWindowPos($p.MainWindowHandle, [IntPtr]::Zero, [int]$cmd.x, [int]$cmd.y, 0, 0, 0x0015) | Out-Null
        Write-Output (@{ ok = $true; id = $reqId } | ConvertTo-Json -Compress)
      }
      'foreground' {
        $h = [JarvisWin.Native]::GetForegroundWindow()
        $procId = 0
        [JarvisWin.Native]::GetWindowThreadProcessId($h, [ref]$procId) | Out-Null
        Write-Output (@{ ok = $true; id = $reqId; pid_ = $procId } | ConvertTo-Json -Compress)
      }
      'fullscreen' {
        # Öndeki pencere bulunduğu ekranı tamamen kaplıyor mu (oyun, video, sunum)?
        # Masaüstü ve görev çubuğu da ekranı kaplar ama tam ekran sayılmaz.
        $h = [JarvisWin.Native]::GetForegroundWindow()
        $full = $false
        if ($h -ne [IntPtr]::Zero) {
          $sb = New-Object System.Text.StringBuilder 64
          [JarvisWin.Native]::GetClassName($h, $sb, 64) | Out-Null
          $cls = $sb.ToString()
          if ($cls -ne 'Progman' -and $cls -ne 'WorkerW' -and $cls -ne 'Shell_TrayWnd') {
            $r = New-Object JarvisWin.Native+RECT
            if ([JarvisWin.Native]::GetWindowRect($h, [ref]$r)) {
              $b = [System.Windows.Forms.Screen]::FromHandle($h).Bounds
              $full = ($r.Left -le $b.Left -and $r.Top -le $b.Top -and $r.Right -ge $b.Right -and $r.Bottom -ge $b.Bottom)
            }
          }
        }
        Write-Output (@{ ok = $true; id = $reqId; full = $full } | ConvertTo-Json -Compress)
      }
      'info' {
        # Öndeki pencerenin başlığı, program adı ve tam ekran olup olmadığı (masaüstü arkadaş için)
        $h = [JarvisWin.Native]::GetForegroundWindow()
        $title = ''; $proc = ''; $full = $false
        if ($h -ne [IntPtr]::Zero) {
          $sb = New-Object System.Text.StringBuilder 512
          [JarvisWin.Native]::GetWindowText($h, $sb, 512) | Out-Null
          $title = $sb.ToString()
          $procId = 0
          [JarvisWin.Native]::GetWindowThreadProcessId($h, [ref]$procId) | Out-Null
          try { $proc = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch { $proc = '' }
          $cb = New-Object System.Text.StringBuilder 64
          [JarvisWin.Native]::GetClassName($h, $cb, 64) | Out-Null
          $cls = $cb.ToString()
          if ($cls -ne 'Progman' -and $cls -ne 'WorkerW' -and $cls -ne 'Shell_TrayWnd') {
            $r = New-Object JarvisWin.Native+RECT
            if ([JarvisWin.Native]::GetWindowRect($h, [ref]$r)) {
              $b = [System.Windows.Forms.Screen]::FromHandle($h).Bounds
              $full = ($r.Left -le $b.Left -and $r.Top -le $b.Top -and $r.Right -ge $b.Right -and $r.Bottom -ge $b.Bottom)
            }
          }
        }
        Write-Output (@{ ok = $true; id = $reqId; title = $title; proc = $proc; full = $full } | ConvertTo-Json -Compress)
      }
      default {
        Write-Output (@{ ok = $false; id = $reqId; error = 'Bilinmeyen komut.' } | ConvertTo-Json -Compress)
      }
    }
  } catch {
    Write-Output (@{ ok = $false; id = $reqId; error = $_.Exception.Message } | ConvertTo-Json -Compress)
  }
}
`

interface PendingRequest {
  resolve: (value: Record<string, unknown>) => void
  reject: (err: Error) => void
}

let daemon: ChildProcessWithoutNullStreams | null = null
let daemonReader: Interface | null = null
let requestCounter = 0
const pending = new Map<number, PendingRequest>()

function handleLine(line: string): void {
  let message: { id?: number; ok?: boolean; error?: string; [key: string]: unknown }
  try {
    message = JSON.parse(line)
  } catch {
    return
  }
  if (typeof message.id !== 'number') return
  const waiter = pending.get(message.id)
  if (!waiter) return
  pending.delete(message.id)
  if (message.ok) waiter.resolve(message)
  else waiter.reject(new Error(message.error ?? 'Bilinmeyen hata.'))
}

function startDaemon(): ChildProcessWithoutNullStreams {
  writeFileSync(DAEMON_SCRIPT_PATH, DAEMON_SCRIPT, 'utf-8')
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', DAEMON_SCRIPT_PATH],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
  )
  daemonReader = createInterface({ input: child.stdout })
  daemonReader.on('line', handleLine)
  child.stderr.on('data', () => {}) // hatalar JSON içinde stdout'a yazılıyor, stderr sessizce yutulur
  child.on('exit', () => {
    daemon = null
    daemonReader?.close()
    daemonReader = null
    for (const waiter of pending.values()) waiter.reject(new Error('Pencere süreci kapandı.'))
    pending.clear()
  })
  daemon = child
  return child
}

function sendCommand(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const child = daemon && !daemon.killed ? daemon : startDaemon()
  const id = ++requestCounter
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    child.stdin.write(JSON.stringify({ ...payload, id }) + '\n')
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error('Pencere işlemi zaman aşımına uğradı.'))
    }, COMMAND_TIMEOUT_MS)
  })
}

/** Pencereyi ekranda verilen konuma taşır (daemon üzerinden, hızlı — sürükleme için) */
export async function daemonMoveWindow(id: number, x: number, y: number): Promise<void> {
  await sendCommand({ op: 'move', pid_: id, x, y })
}

/** O anda öndeki (odaklanmış) pencerenin pid'si (daemon üzerinden, hızlı) */
export async function daemonForegroundWindowId(): Promise<number | null> {
  const result = await sendCommand({ op: 'foreground' })
  const pid = result.pid_
  return typeof pid === 'number' && pid > 0 ? pid : null
}

/** Öndeki pencere ekranı tamamen kaplıyor mu (tam ekran oyun/video/sunum) */
export async function daemonForegroundIsFullscreen(): Promise<boolean> {
  const result = await sendCommand({ op: 'fullscreen' })
  return result.full === true
}

export interface ForegroundInfo {
  title: string
  process: string
  fullscreen: boolean
}

/** Öndeki pencerenin başlığı, program adı ve tam ekran olup olmadığı (tek çağrıda) */
export async function daemonForegroundInfo(): Promise<ForegroundInfo> {
  const result = await sendCommand({ op: 'info' })
  return {
    title: typeof result.title === 'string' ? result.title : '',
    process: typeof result.proc === 'string' ? result.proc : '',
    fullscreen: result.full === true
  }
}

/** Uygulama kapanırken çağrılır; kalıcı süreç açık kalmasın */
export function disposeWindowDaemon(): void {
  daemonReader?.close()
  daemonReader = null
  daemon?.kill()
  daemon = null
  pending.clear()
}
