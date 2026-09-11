import { MessageSquarePlus, Trash2 } from 'lucide-react'
import type { Conversation } from '@shared/api'

interface ConversationListProps {
  conversations: Conversation[]
  activeId: number | null
  onSelect: (id: number) => void
  onNew: () => void
  onDelete: (id: number) => void
}

function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete
}: ConversationListProps): React.JSX.Element {
  return (
    <div className="flex w-56 shrink-0 flex-col border-r border-zinc-800">
      <div className="p-3">
        <button
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-800"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Yeni sohbet
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <p className="px-3 py-2 text-xs text-zinc-600">Henüz sohbet yok.</p>
        ) : (
          conversations.map((conversation) => {
            const isActive = conversation.id === activeId
            const title = conversation.title || 'Yeni sohbet'
            return (
              <div
                key={conversation.id}
                className={`group flex items-center rounded-lg ${isActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/60'}`}
              >
                <button
                  onClick={() => onSelect(conversation.id)}
                  title={title}
                  className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-sm ${isActive ? 'text-white' : 'text-zinc-400'}`}
                >
                  {title}
                </button>
                <button
                  onClick={() => onDelete(conversation.id)}
                  aria-label="Sohbeti sil"
                  title="Sohbeti sil"
                  className="mr-1 rounded p-1.5 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400 focus:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default ConversationList
