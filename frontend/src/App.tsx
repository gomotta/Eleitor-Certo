import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '@/pages/Login';
import RegisterPage from '@/pages/Register';
import CopilotoPage from '@/pages/Copiloto';
import MapaPage from '@/pages/Mapa';
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/copiloto"
          element={
            <RequireAuth>
              <CopilotoPage />
            </RequireAuth>
          }
        />
        <Route
          path="/mapa"
          element={
            <RequireAuth>
              <RequireCopiloto>
                <MapaPage />
              </RequireCopiloto>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/copiloto" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
