import { create } from 'zustand'
import type { DateRangeKey } from '@/types'

interface AnalyticsUiState {
  range: DateRangeKey
  setRange: (range: DateRangeKey) => void
}

// Shared between /admin (Overview) and /admin/analytics so the selected
// period stays in sync as the admin moves between the two screens.
export const useAnalyticsUiStore = create<AnalyticsUiState>((set) => ({
  range: '30d',
  setRange: (range) => set({ range }),
}))
