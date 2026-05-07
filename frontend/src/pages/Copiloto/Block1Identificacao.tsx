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

const ChevronDown = () => (
  <svg className="w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pt-3 mt-3 border-t border-gray-100 first:pt-0 first:mt-0 first:border-0">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  );
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
      nomeCompleto:  formData.nomeCompleto  ?? '',
      nomeUrna:      formData.nomeUrna      ?? '',
      numeroUrna:    formData.numeroUrna    ?? '',
      partidoSigla:  formData.partidoSigla  ?? '',
      partidoNome:   formData.partidoNome   ?? '',
      cpf:           formData.cpf           ?? '',
      tituloEleitor: formData.tituloEleitor ?? '',
      emailContato:  formData.emailContato  ?? '',
      telefone:      formData.telefone      ?? '',
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">

      {/* Dados pessoais */}
      <FieldGroup label="Dados pessoais">
        <div className="md:col-span-2">
          <label className="label">Nome Completo *</label>
          <input
            {...register('nomeCompleto')}
            className="input"
            placeholder="Ex: João da Silva Santos"
          />
          {errors.nomeCompleto && <p className="error">{errors.nomeCompleto.message}</p>}
        </div>

        <div>
          <label className="label">
            Nome de Urna *
            <span className="ml-1 text-gray-400 font-normal text-xs">máx. 30 chars</span>
          </label>
          <input
            {...register('nomeUrna')}
            className="input"
            maxLength={30}
            placeholder="Ex: JOÃO SILVA"
          />
          {errors.nomeUrna && <p className="error">{errors.nomeUrna.message}</p>}
        </div>

        <div>
          <label className="label">
            Número de Urna
            <span className="ml-1 text-gray-400 font-normal text-xs">opcional</span>
          </label>
          <input {...register('numeroUrna')} className="input" placeholder="Ex: 1234" />
          {errors.numeroUrna && <p className="error">{errors.numeroUrna.message}</p>}
        </div>

        <div className="md:col-span-2">
          <label className="label">Partido *</label>
          <div className="relative">
            <select
              {...register('partidoSigla')}
              className="input appearance-none pr-10 cursor-pointer"
              onChange={(e) => handlePartidoChange(e.target.value)}
            >
              <option value="">Selecione o partido</option>
              {partidos.map((p) => (
                <option key={p.sigla} value={p.sigla}>
                  {p.sigla} — {p.nome}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <ChevronDown />
            </div>
          </div>
          {errors.partidoSigla && <p className="error">{errors.partidoSigla.message}</p>}
        </div>
      </FieldGroup>

      {/* Documentos */}
      <FieldGroup label="Documentos">
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
      </FieldGroup>

      {/* Contato */}
      <FieldGroup label="Contato">
        <div>
          <label className="label">E-mail *</label>
          <input
            {...register('emailContato')}
            type="email"
            className="input"
            placeholder="contato@exemplo.com"
          />
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
      </FieldGroup>

      <div className="flex justify-end pt-3">
        <button type="submit" className="btn-primary">
          Avançar
          <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </form>
  );
}
