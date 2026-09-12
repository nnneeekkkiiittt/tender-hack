import { isDemoMode } from '@/config/env'
import type { KnowledgeService } from './KnowledgeService'
import { DemoKnowledgeService } from './DemoKnowledgeService'

// API-backed implementation can be added the same way as other services
// once the backend exposes a knowledge-base endpoint.
export const knowledgeService: KnowledgeService = isDemoMode
  ? new DemoKnowledgeService()
  : {
      async list() {
        throw new Error('База знаний пока недоступна')
      },
    }

export type { KnowledgeService } from './KnowledgeService'
