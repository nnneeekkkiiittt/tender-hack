import { create } from 'zustand'

interface ChatUiState {
  pendingQuestion: string | null
  setPendingQuestion: (q: string | null) => void
}

// Lets sidebar "Недавнее" items and home-screen suggestion cards pre-fill
// the chat input / auto-send a question without prop drilling through routes.
export const useChatUiStore = create<ChatUiState>((set) => ({
  pendingQuestion: null,
  setPendingQuestion: (q) => set({ pendingQuestion: q }),
}))
