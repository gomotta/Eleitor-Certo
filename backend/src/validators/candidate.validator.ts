import { z } from 'zod';
import { isValidCpf } from '../utils/validators/cpf';

export const CargoEnum = z.enum([
  'VEREADOR',
  'PREFEITO_VICE',
  'DEPUTADO_ESTADUAL',
  'DEPUTADO_FEDERAL',
  'SENADOR',
  'GOVERNADOR_VICE',
  'PRESIDENTE_VICE',
]);

export const candidateSchema = z.object({
  nomeCompleto: z
    .string()
    .refine((v) => v.trim().split(/\s+/).length >= 3, {
      message: 'Nome completo deve ter no mínimo 3 palavras',
    }),
  nomeUrna: z.string().max(30, 'Nome de urna deve ter no máximo 30 caracteres'),
  numeroUrna: z
    .string()
    .regex(/^\d{2,5}$|^$/, 'Número de urna deve ter entre 2 e 5 dígitos')
    .optional(),
  partidoSigla: z.string().min(1, 'Partido obrigatório'),
  partidoNome: z.string().min(1),
  cpf: z.string().refine((v) => isValidCpf(v), { message: 'CPF inválido' }),
  tituloEleitor: z
    .string()
    .refine((v) => v.replace(/\D/g, '').length === 12, {
      message: 'Título de eleitor deve ter 12 dígitos',
    }),
  emailContato: z.string().email('E-mail inválido'),
  telefone: z
    .string()
    .regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Telefone inválido. Use o formato (00) 00000-0000'),
  cargo: CargoEnum,
  estado: z.string().length(2, 'UF deve ter 2 caracteres'),
  cidade: z.string().optional(),
  macroRegiao: z.array(z.string()).optional(),
  microRegiao: z.array(z.string()).optional(),
  bandeiras: z.array(z.string()).length(3, 'Selecione exatamente 3 bandeiras'),
  perfilAtuacao: z.string().min(1, 'Perfil de atuação obrigatório'),
});

export type CandidateInput = z.infer<typeof candidateSchema>;
