import api from './client';
import type { CandidateFormData } from '@/types/candidate';

export const candidateApi = {
  save: (data: CandidateFormData) => api.post('/candidates', data),
  getMe: () => api.get('/candidates/me'),
  exportData: () => api.get('/candidates/export'),
  deleteMe: () => api.delete('/candidates/me'),
};
