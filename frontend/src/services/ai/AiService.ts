export interface AskResult {
  answer: string
  sources: string[]
}

export interface AiService {
  ask(question: string): Promise<AskResult>
}
