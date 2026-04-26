import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '@/services/api/auth';
import { useAuthStore } from '@/stores/authStore';
import { LogoImg } from '@/components/Logo';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authApi.login(data.email, data.password);
      setTokens(res.data.accessToken, res.data.refreshToken);
      navigate('/copiloto');
    } catch {
      setError('root', { message: 'E-mail ou senha inválidos' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-primary-50 px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Logo + brand */}
        <div className="flex flex-col items-center mb-8">
          <LogoImg size={64} className="mb-4 drop-shadow-sm" />
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Eleitor Certo</h1>
          <p className="text-sm text-gray-500 mt-1">Inteligência eleitoral para sua campanha</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Acessar conta</h2>
          <p className="text-sm text-gray-400 mb-6">Entre com suas credenciais para continuar</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">E-mail</label>
              <input
                {...register('email')}
                type="email"
                className="input"
                placeholder="seu@email.com"
                autoComplete="email"
              />
              {errors.email && <p className="error">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Senha</label>
              <input
                {...register('password')}
                type="password"
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              {errors.password && <p className="error">{errors.password.message}</p>}
            </div>

            {errors.root && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-sm text-red-600 text-center">
                {errors.root.message}
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full mt-2">
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Entrando…
                </span>
              ) : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          Não tem conta?{' '}
          <Link to="/register" className="text-primary-600 font-semibold hover:text-primary-700 transition-colors">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  );
}
