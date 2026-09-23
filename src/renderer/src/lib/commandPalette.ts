export interface Command {
  id: string
  label: string
  group: string
  /** Aranırken etikete ek olarak eşleşsin diye (ör. sayfa adının eşanlamlıları) */
  keywords?: string
}

const norm = (value: string): string => value.toLocaleLowerCase('tr-TR')

/** Türkçe büyük/küçük harf duyarlı, boşluk kırpılmış alt dize arama */
export function filterCommands<T extends Command>(commands: T[], query: string): T[] {
  const q = norm(query.trim())
  if (!q) return commands
  return commands.filter((command) =>
    norm(`${command.label} ${command.keywords ?? ''}`).includes(q)
  )
}
