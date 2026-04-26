import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CandidateFormData } from '@/types/candidate';

interface CandidateState {
  currentStep: number;
  formData: Partial<CandidateFormData>;
  candidateId: string | null;
  coPilotoAtivo: boolean;
  setStep: (step: number) => void;
  updateFormData: (data: Partial<CandidateFormData>) => void;
  setCandidateId: (id: string) => void;
  activateCopiloto: () => void;
  reset: () => void;
}

const initialFormData: Partial<CandidateFormData> = {};

export const useCandidateStore = create<CandidateState>()(
  persist(
    (set) => ({
      currentStep: 1,
      formData: initialFormData,
      candidateId: null,
      coPilotoAtivo: false,
      setStep: (step) => set({ currentStep: step }),
      updateFormData: (data) =>
        set((state) => ({ formData: { ...state.formData, ...data } })),
      setCandidateId: (id) => set({ candidateId: id }),
      activateCopiloto: () => set({ coPilotoAtivo: true }),
      reset: () => set({ currentStep: 1, formData: initialFormData, coPilotoAtivo: false }),
    }),
    { name: 'eleitor-candidate' },
  ),
);
