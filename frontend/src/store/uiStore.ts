import { create } from 'zustand'

interface UiState {
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  toggleMobileSidebar: () => void
}

export const useUiStore = create<UiState>((set) => ({
  mobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  toggleMobileSidebar: () => set((s) => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
}))
