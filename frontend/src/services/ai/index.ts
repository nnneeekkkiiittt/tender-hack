import { isDemoMode } from '@/config/env'
import type { AiService } from './AiService'
import { DemoAiService } from './DemoAiService'

// The real backend will likely expose this as a streaming endpoint;
// the interface stays the same, only the implementation changes.
export const aiService: AiService = isDemoMode ? new DemoAiService() : new DemoAiService()

export type { AiService, AskResult } from './AiService'
