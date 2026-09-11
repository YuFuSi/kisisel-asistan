import { SendHorizontal, Sparkles } from 'lucide-react'

function ChatPage(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/15">
          <Sparkles className="h-7 w-7 text-violet-400" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Merhaba! Nasıl yardımcı olabilirim?
        </h1>
        <p className="max-w-md text-sm text-zinc-400">
          Yapay zeka sohbeti Aşama 1&apos;de aktif olacak. Önce Ayarlar&apos;dan bir sağlayıcı
          seçeceğiz.
        </p>
      </div>

      <div className="border-t border-zinc-800 p-4">
        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <input
            disabled
            placeholder="Bir mesaj yaz..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
          />
          <button disabled className="text-zinc-600" aria-label="Gönder">
            <SendHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatPage
