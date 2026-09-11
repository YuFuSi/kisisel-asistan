// ipcRenderer.invoke hataları "Error invoking remote method 'x': Error: ..." önekiyle gelir; kullanıcıya sade mesajı göster
export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
}
