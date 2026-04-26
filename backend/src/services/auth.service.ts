import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository';
import { AppError } from '../middlewares/errorHandler';
import type { RegisterInput, LoginInput } from '../validators/auth.validator';

const BCRYPT_ROUNDS = 12;

function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as `${number}${'s'|'m'|'h'|'d'}` | number,
  });
}

function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as `${number}${'s'|'m'|'h'|'d'}` | number,
  });
}

export const AuthService = {
  async register(input: RegisterInput) {
    const existing = await UserRepository.findByEmail(input.email);
    if (existing) throw new AppError('E-mail já cadastrado', 409);

    const senhaHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    // Extrai nome do e-mail como fallback
    const nome = input.email.split('@')[0];
    const user = await UserRepository.create(nome, input.email, senhaHash);

    return {
      accessToken: signAccessToken(user.id),
      refreshToken: signRefreshToken(user.id),
    };
  },

  async login(input: LoginInput) {
    const user = await UserRepository.findByEmail(input.email);
    if (!user) throw new AppError('Credenciais inválidas', 401);

    const valid = await bcrypt.compare(input.password, user.senha_hash);
    if (!valid) throw new AppError('Credenciais inválidas', 401);

    return {
      accessToken: signAccessToken(user.id),
      refreshToken: signRefreshToken(user.id),
    };
  },

  async refresh(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { sub: string };
      return { accessToken: signAccessToken(payload.sub) };
    } catch {
      throw new AppError('Refresh token inválido ou expirado', 401);
    }
  },
};
