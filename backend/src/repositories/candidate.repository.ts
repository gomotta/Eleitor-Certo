import prisma from '../database/prisma';

interface CopilotoData {
  nome_completo?: string;
  nome_urna?: string;
  numero_urna?: string;
  partido?: string;
  cpf?: string;
  titulo_eleitor?: string;
  email_candidato?: string;
  telefone?: string;
  cargo?: string;
  estado?: string;
  cidade_ibge_id?: string;
  cidade_nome?: string;
  macrorregiao?: string;
  microrregiao?: string;
  bandeiras?: string[];
  perfis_atuacao?: string[];
  concluido?: boolean;
}

export const CandidateRepository = {
  findByUserId: (usuarioId: string) =>
    prisma.copiloto.findUnique({ where: { usuario_id: usuarioId } }),

  upsert: (usuarioId: string, data: CopilotoData) =>
    prisma.copiloto.upsert({
      where: { usuario_id: usuarioId },
      create: { usuario_id: usuarioId, ...data },
      update: data,
    }),

  activate: (usuarioId: string) =>
    prisma.copiloto.update({
      where: { usuario_id: usuarioId },
      data: { concluido: true },
    }),

  delete: (usuarioId: string) =>
    prisma.copiloto.delete({ where: { usuario_id: usuarioId } }),
};
