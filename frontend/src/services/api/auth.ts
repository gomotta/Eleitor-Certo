import api from './client';

export const authApi = {
  register: (email: string, password: string) =>
    api.post<{ accessToken: string; refreshToken: string }>('/auth/register', { email, password }),

  login: (email: string, password: string) =>
    api.post<{ accessToken: string; refreshToken: string }>('/auth/login', { email, password }),
};
