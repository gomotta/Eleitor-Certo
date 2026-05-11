import api from './client';

export interface AiFilterIntent {
  estado?: string;
  partido?: string;
  ideologia?: string;
  cargo?: string;
  ano?: number;
  candidatoNomeUrna?: string;
  candidatoSequencial?: string;
}

export interface AiQueryContext {
  uf?: string;
  ano?: number;
  cargo?: string;
  partido?: string;
  nomeUrna?: string | null;
}

export type MapAction =
  | { type: 'apply_filter'; filter: AiFilterIntent }
  | { type: 'zoom_to'; municipioNome?: string; uf?: string };

export interface AiTokensUsed {
  prompt: number;
  output: number;
  total: number;
}

export interface AiQueryResult {
  message: string;
  mapActions: MapAction[];
  totalRequests: number;
  tokensUsed: AiTokensUsed;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const aiApi = {
  query: (prompt: string, context?: AiQueryContext, history?: ChatMessage[]) =>
    api.post<AiQueryResult>('/ai/query', { prompt, context, history }),
};
