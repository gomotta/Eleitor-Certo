export type Cargo =
  | 'VEREADOR'
  | 'PREFEITO_VICE'
  | 'DEPUTADO_ESTADUAL'
  | 'DEPUTADO_FEDERAL'
  | 'SENADOR'
  | 'GOVERNADOR_VICE'
  | 'PRESIDENTE_VICE';

export interface CandidateFormData {
  // Bloco 1
  nomeCompleto: string;
  nomeUrna: string;
  numeroUrna?: string;
  partidoSigla: string;
  partidoNome: string;
  cpf: string;
  tituloEleitor: string;
  emailContato: string;
  telefone: string;
  // Bloco 2
  cargo: Cargo;
  // Bloco 3
  estado: string;
  cidade?: string;
  macroRegiao?: string[];
  microRegiao?: string[];
  // Bloco 4
  bandeiras: string[];
  // Bloco 5
  perfilAtuacao: string;
}
