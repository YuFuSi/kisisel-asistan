import { Bell, CalendarDays, CheckSquare, CloudSun, FileText } from 'lucide-react'
import type { ToolCard } from '@shared/api'

interface ResultCardProps {
  card: ToolCard
}

// Bağlamsal kart: Jarvis'in bir araçla bulduğu/yaptığı şeyin kısa, okunur hâli (hava, takvim,
// dosya, görev, hatırlatma). Tüm kartlar aynı iskeleti paylaşır: ikonlu başlık + en fazla 5 satır.
function ResultCard({ card }: ResultCardProps): React.JSX.Element {
  return (
    <div className="animate-fade w-full rounded-xl border border-line bg-elevated px-4 py-3 text-left">
      {card.kind === 'weather' && (
        <>
          <Header icon={CloudSun} title={card.place} />
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-medium text-ink tabular-nums">{card.temperature}°</span>
            <span className="text-sm text-muted">{card.condition}</span>
          </div>
          {card.days.length > 1 && (
            <div className="mt-2 flex gap-4 text-xs text-muted">
              {card.days.map((day) => (
                <span key={day.day} className="tabular-nums">
                  <span className="text-faint">{day.day.slice(0, 3)}</span> {day.min}°/{day.max}°
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {card.kind === 'events' && (
        <>
          <Header icon={CalendarDays} title="Takvim" />
          {card.items.length === 0 ? (
            <p className="mt-1 text-sm text-muted">Bu aralıkta etkinlik yok.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {card.items.map((item, index) => (
                <li key={index} className="flex gap-3 text-sm">
                  <span className="w-28 shrink-0 truncate text-muted tabular-nums">
                    {item.time}
                  </span>
                  <span className="min-w-0 truncate text-ink">{item.title}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {card.kind === 'files' && (
        <>
          <Header
            icon={FileText}
            title={card.total > card.items.length ? `${card.total} dosya bulundu` : 'Dosyalar'}
          />
          <ul className="mt-1 space-y-1">
            {card.items.map((file) => (
              <li key={file.path} className="min-w-0 text-sm" title={file.path}>
                <span className="text-ink">{file.name}</span>
                <span className="ml-2 truncate text-xs text-faint">{file.path}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {card.kind === 'task' && (
        <>
          <Header icon={CheckSquare} title="Görev eklendi" />
          <p className="mt-1 text-sm text-ink">{card.title}</p>
          {card.due && <p className="text-xs text-muted">{card.due}</p>}
        </>
      )}

      {card.kind === 'reminder' && (
        <>
          <Header icon={Bell} title="Hatırlatma kuruldu" />
          <p className="mt-1 text-sm text-ink">{card.message}</p>
          <p className="text-xs text-muted">
            {card.when}
            {card.repeat && ` · ${card.repeat}`}
          </p>
        </>
      )}
    </div>
  )
}

function Header({
  icon: Icon,
  title
}: {
  icon: typeof CloudSun
  title: string
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <Icon className="h-4 w-4 text-accent" aria-hidden />
      {title}
    </div>
  )
}

export default ResultCard
