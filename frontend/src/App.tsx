import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '@/pages/Login';
import CopilotoPage from '@/pages/Copiloto';
import MapaPage from '@/pages/Mapa';
import CabosEleitoraisPage from '@/pages/CabosEleitorais';
import { useAuthStore } from '@/stores/authStore';
import { useCandidateStore } from '@/stores/candidateStore';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireCopiloto({ children }: { children: React.ReactNode }) {
  const ativo = useCandidateStore((s) => s.coPilotoAtivo);
  if (!ativo) return <Navigate to="/copiloto" replace />;
  return <>{children}</>;
}

function DefaultRedirect() {
  const token = useAuthStore((s) => s.accessToken);
  const ativo = useCandidateStore((s) => s.coPilotoAtivo);
  if (!token) return <Navigate to="/login" replace />;
  return <Navigate to={ativo ? '/dashboard' : '/copiloto'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route
          path="/copiloto"
          element={
            <RequireAuth>
              <CopilotoPage />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <RequireCopiloto>
                <MapaPage />
              </RequireCopiloto>
            </RequireAuth>
          }
        />
        <Route
          path="/cabos-eleitorais"
          element={
            <RequireAuth>
              <RequireCopiloto>
                <CabosEleitoraisPage />
              </RequireCopiloto>
            </RequireAuth>
          }
        />
        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
