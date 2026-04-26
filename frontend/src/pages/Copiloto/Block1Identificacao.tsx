import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect } from 'react';
import { useCandidateStore } from '@/stores/candidateStore';
import { isValidCpf, formatCpf, formatTelefone, formatTitulo } from '@/utils/validators/cpf';

const schema = z.object({
  nomeCompleto: z
    .string()
    .refine((v) => v.trim().split(/\s+/).length >= 3, 'Informe pelo menos 3 palavras'),
  nomeUrna: z.string().max(30, 'Máximo 30 caracteres').min(1, 'Obrigatório'),
  numeroUrna: z
    .string()
    .regex(/^\d{2,5}$/, 'Entre 2 e 5 dígitos')
    .optional()
    .or(z.literal('')),
  partidoSigla: z.string().min(1, 'Selecione um partido'),
  partidoNome: z.string(),
  cpf: z.string().refine(isValidCpf, 'CPF inválido'),
  tituloEleitor: z
    .string()
    .refine((v) => v.replace(/\D/g, '').length === 12, 'Deve ter 12 dígitos'),
  emailContato: z.string().email('E-mail inválido'),
  telefone: z
    .string()
    .regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Use o formato (00) 00000-0000'),
});

type FormData = z.infer<typeof schema>;

interface Partido { id: number; sigla: string; nome: string; numero: number }

interface Props {
  onNext: () => void;
}

export default function Block1Identificacao({ onNext }: Props) {
  const { formData, updateFormData } = useCandidateStore();
  const [partidos, setPartidos] = useState<Partido[]>([]);

  useEffect(() => {
    fetch('/api/partidos')
      .then((r) => r.json())
      .then(setPartidos)
      .catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nomeCompleto: formData.nomeCompleto ?? '',
      nomeUrna: formData.nomeUrna ?? '',
      numeroUrna: formData.numeroUrna ?? '',
      partidoSigla: formData.partidoSigla ?? '',
      partidoNome: formData.partidoNome ?? '',
      cpf: formData.cpf ?? '',
      tituloEleitor: formData.tituloEleitor ?? '',
      emailContato: formData.emailContato ?? '',
      telefone: formData.telefone ?? '',
    },
  });

  const onSubmit = (data: FormData) => {
    updateFormData(data);
    onNext();
  };

  const handlePartidoChange = (sigla: string) => {
    const partido = partidos.find((p) => p.sigla === sigla);
    setValue('partidoSigla', sigla);
    setValue('partidoNome', partido?.nome ?? '');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <label className="label">Nome Completo *</label>
          <input {...register('nomeCompleto')} className="input" placeholder="Ex: João da Silva Santos" />
          {errors.nomeCompleto && <p className="error">{errors.nomeCompleto.message}</p>}
        </div>

        <div>
          <label className="label">Nome de Urna * <span className="text-gray-400">(máx. 30 chars)</span></label>
          <input {...register('nomeUrna')} className="input" maxLength={30} placeholder="Ex: JOÃO SILVA" />
          {errors.nomeUrna && <p className="error">{errors.nomeUrna.message}</p>}
        </div>

        <div>
          <label className="label">Número de Urna <span className="text-gray-400">(opcional)</span></label>
          <input {...register('numeroUrna')} className="input" placeholder="Ex: 1234" />
          {errors.numeroUrna && <p className="error">{errors.numeroUrna.message}</p>}
        </div>

        <div className="md:col-span-2">
          <label className="label">Partido *</label>
          <select
            {...register('partidoSigla')}
            className="input"
            onChange={(e) => handlePartidoChange(e.target.value)}
          >
            <option value="">Selecione o partido</option>
            {partidos.map((p) => (
              <option key={p.sigla} value={p.sigla}>
                {p.sigla} — {p.nome}
              </option>
            ))}
          </select>
          {errors.partidoSigla && <p className="error">{errors.partidoSigla.message}</p>}
        </div>

        <div>
          <label className="label">CPF *</label>
          <input
            {...register('cpf')}
            className="input"
            placeholder="000.000.000-00"
            maxLength={14}
            onChange={(e) => setValue('cpf', formatCpf(e.target.value))}
          />
          {errors.cpf && <p className="error">{errors.cpf.message}</p>}
        </div>

        <div>
          <label className="label">Título de Eleitor *</label>
          <input
            {...register('tituloEleitor')}
            className="input"
            placeholder="0000 0000 0000"
            maxLength={14}
            onChange={(e) => setValue('tituloEleitor', formatTitulo(e.target.value))}
          />
          {errors.tituloEleitor && <p className="error">{errors.tituloEleitor.message}</p>}
        </div>

        <div>
          <label className="label">E-mail de Contato *</label>
          <input {...register('emailContato')} type="email" className="input" placeholder="contato@exemplo.com" />
          {errors.emailContato && <p className="error">{errors.emailContato.message}</p>}
        </div>

        <div>
          <label className="label">Telefone (com DDD) *</label>
          <input
            {...register('telefone')}
            className="input"
            placeholder="(00) 00000-0000"
            maxLength={15}
            onChange={(e) => setValue('telefone', formatTelefone(e.target.value))}
          />
          {errors.telefone && <p className="error">{errors.telefone.message}</p>}
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button type="submit" className="btn-primary">Avançar →</button>
      </div>
    </form>
  );
}
