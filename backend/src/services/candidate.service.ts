import { CandidateRepository } from '../repositories/candidate.repository';
import { AppError } from '../middlewares/errorHandler';
import { invalidarCacheMapaDados } from './mapa.service';
import { invalidarCacheCamadas } from './mapa-camadas.service';

interface CandidateInput {
  nomeCompleto: string;
  nomeUrna: string;
  numeroUrna?: string;
  partidoSigla: string;
  partidoNome: string;
  cpf: string;
  tituloEleitor: string;
  emailContato: string;
  telefone: string;
  cargo: string;
  estado: string;
  cidade?: string;
  macroRegiao?: string[];
  microRegiao?: string[];
  bandeiras: string[];
  perfilAtuacao: string;
}

export const CandidateService = {
  async upsert(userId: string, input: CandidateInput) {
    const copiloto = await CandidateRepository.upsert(userId, {
      nome_completo: input.nomeCompleto,
      nome_urna: input.nomeUrna,
      numero_urna: input.numeroUrna,
      partido: `${input.partidoSigla} — ${input.partidoNome}`,
      cpf: input.cpf.replace(/\D/g, ''),
      titulo_eleitor: input.tituloEleitor.replace(/\D/g, ''),
      email_candidato: input.emailContato,
      telefone: input.telefone,
      cargo: input.cargo.toLowerCase(),
      estado: input.estado,
      cidade_nome: input.cidade,
      macrorregiao: input.macroRegiao?.join(','),
      microrregiao: input.microRegiao?.join(','),
      bandeiras: input.bandeiras,
      perfis_atuacao: [input.perfilAtuacao],
      concluido: true,
    });

    // Invalida caches do mapa para que a próxima visita carregue dados frescos
    invalidarCacheMapaDados(copiloto.id);
    invalidarCacheCamadas(copiloto.id);

    return copiloto;
  },

  async getByUserId(userId: string) {
    const copiloto = await CandidateRepository.findByUserId(userId);
    if (!copiloto) throw new AppError('Perfil não encontrado', 404);
    return copiloto;
  },

  async exportData(userId: string) {
    const copiloto = await CandidateRepository.findByUserId(userId);
    if (!copiloto) throw new AppError('Perfil não encontrado', 404);
    return copiloto;
  },

  async delete(userId: string) {
    const copiloto = await CandidateRepository.findByUserId(userId);
    if (!copiloto) throw new AppError('Perfil não encontrado', 404);
    await CandidateRepository.delete(userId);
  },
};
