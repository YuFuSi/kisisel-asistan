import { tabClass } from '../../lib/styles'

export interface TabItem<T extends string> {
  id: T
  label: string
  /** Etiketin yanında soluk sayı (ör. açık görev sayısı); bilinmiyorsa null */
  count?: number | null
}

interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
}

// Ortak sekme sırası (Planlama, Hafıza, Ayarlar)
function Tabs<T extends string>({ items, value, onChange }: TabsProps<T>): React.JSX.Element {
  return (
    <div className="flex gap-1 border-b border-line" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={tabClass(value === item.id)}
        >
          {item.label}
          {item.count !== undefined && item.count !== null && (
            <span className="ml-1.5 text-faint">{item.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export default Tabs
