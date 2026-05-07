import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/services/api/auth';
import { useAuthStore } from '@/stores/authStore';
import { LogoImg } from '@/components/Logo';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

type FormData = z.infer<typeof schema>;

const FEATURES = [
  'Mapa eleitoral interativo por região',
  'Copiloto estratégico com IA',
  'Análise de reduto e base eleitoral',
];

export default function LoginPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex flex-col w-[500px] flex-shrink-0 relative overflow-hidden bg-primary-900">
        {/* Video background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-70"
          src="/video.mp4"
        />
        {/* Green overlay — escurece só o suficiente para o texto ser legível */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/60 via-primary-800/45 to-primary-700/35" />

        <div className="relative z-10 flex flex-col h-full p-12">

          {/* Hero text */}
          <div className="mt-20">
            <h1 className="text-[2.1rem] font-bold text-white leading-[1.2] tracking-tight">
              Inteligência<br />eleitoral para<br />sua campanha.
            </h1>
            <p className="text-white/60 mt-4 text-sm leading-relaxed max-w-xs">
              Analise dados, mapeie eleitores e desenvolva sua estratégia em uma única plataforma.
            </p>

            {/* Feature list */}
            <ul className="mt-10 space-y-3">
              {FEATURES.map((feat) => (
                <li key={feat} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-primary-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm text-white/75">{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-auto text-white/25 text-xs">
            © 2026 Eleitor Certo. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-12">
        {/* Mobile logo (only below lg) */}
        <div className="flex flex-col items-center mb-8 lg:hidden">
          <LogoImg size={52} className="mb-3" />
          <h1 className="text-xl font-bold text-gray-900">Eleitor Certo</h1>
          <p className="text-sm text-gray-500 mt-1">Inteligência eleitoral para sua campanha</p>
        </div>

        <div className="w-full max-w-[360px]">
          {/* Desktop heading */}
          <div className="mb-8 hidden lg:flex lg:flex-col lg:items-center lg:text-center">
            <LogoImg size={52} className="mb-3" />
            <span className="text-lg font-bold text-gray-900 tracking-tight mb-5">Eleitor Certo</span>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Bem-vindo de volta</h2>
            <p className="text-gray-500 text-sm mt-1.5">Entre com suas credenciais para continuar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* E-mail */}
            <div>
              <label className="label">E-mail</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input
                  {...register('email')}
                  type="email"
                  className="input pl-10"
                  placeholder="seu@email.com"
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="error">{errors.email.message}</p>}
            </div>

            {/* Senha */}
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <p className="error">{errors.password.message}</p>}
            </div>

            {errors.root && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-600">{errors.root.message}</p>
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 mt-1">
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
      </div>
    </div>
  );
}
