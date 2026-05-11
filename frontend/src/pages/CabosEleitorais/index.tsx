import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '@/components/Logo';
import { caboEleitoralApi, type CaboEleitoral } from '@/services/api/cabo-eleitoral';
import CaboEleitoralForm from './CaboEleitoralForm';

export default function CabosEleitoraisPage() {
  const navigate = useNavigate();
  const [cabos, setCabos] = useState<CaboEleitoral[]>([]);
  const [totalVotos, setTotalVotos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<CaboEleitoral | null>(null);
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await caboEleitoralApi.list();
      setCabos(data.cabos);
      setTotalVotos(data.total_votos);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const handleEditar = (cabo: CaboEleitoral) => { setEditando(cabo); setFormOpen(true); };
  const handleNovo = () => { setEditando(null); setFormOpen(true); };

  const handleDeletar = async (id: string) => {
    if (!window.confirm('Excluir este cabo eleitoral?')) return;
    setDeletandoId(id);
    try { await caboEleitoralApi.delete(id); await carregar(); }
    finally { setDeletandoId(null); }
  };

  const handleSaved = () => { setFormOpen(false); setEditando(null); carregar(); };

  const totalCapacidade = (cabo: CaboEleitoral) =>
    cabo.historicos.reduce((s, h) => s + h.votos_calculados, 0);

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="w-full px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BrandLogo />
            <div className="h-4 w-px bg-gray-200" />
            <h1 className="text-sm font-semibold text-gray-700">Cabos Eleitorais</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Mapa
            </button>
            <button
              onClick={handleNovo}
              className="flex items-center gap-1.5 text-xs font-semibold bg-primary-600 text-white px-4 py-1.5 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Novo Cabo Eleitoral
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 w-full px-6 py-8">

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-3" />
              <p className="text-xs text-gray-400">Carregando...</p>
            </div>
          </div>

        ) : cabos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Nenhum cabo eleitoral cadastrado</p>
            <p className="text-xs text-gray-400 mb-6 max-w-xs">
              Cadastre seus cabos eleitorais para estimar a capacidade de mobilização de votos.
            </p>
            <button
              onClick={handleNovo}
              className="flex items-center gap-1.5 text-xs font-semibold bg-primary-600 text-white px-5 py-2.5 rounded-xl hover:bg-primary-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Cadastrar primeiro cabo
            </button>
          </div>

        ) : (
          <div className="space-y-2">
            {cabos.map((cabo) => {
              const cap = totalCapacidade(cabo);
              const expandido = expandidoId === cabo.id;
              return (
                <div key={cabo.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">

                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary-600">
                        {cabo.nome.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{cabo.nome}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {[cabo.cidade_nome, cabo.estado].filter(Boolean).join(' · ') || 'Localização não informada'}
                        {cabo.telefone && <span className="ml-2">· {cabo.telefone}</span>}
                      </p>
                    </div>

                    <div className="text-right shrink-0 mr-2">
                      <p className="text-[10px] text-gray-400 mb-0.5">Capacidade de apoio</p>
                      <p className="text-sm font-bold text-primary-600">
                        {cap.toLocaleString('pt-BR')} votos
                      </p>
                      {cabo.historicos.length > 0 && (
                        <p className="text-[10px] text-gray-400">
                          {cabo.historicos.length} {cabo.historicos.length === 1 ? 'eleição' : 'eleições'}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      {cabo.historicos.length > 0 && (
                        <button
                          onClick={() => setExpandidoId(expandido ? null : cabo.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <svg className={`w-4 h-4 transition-transform ${expandido ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleEditar(cabo)}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeletar(cabo.id)}
                        disabled={deletandoId === cabo.id}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                        title="Excluir"
                      >
                        {deletandoId === cabo.id ? (
                          <div className="w-4 h-4 border border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {expandido && (
                    <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-2">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Histórico de apoio</p>
                      {cabo.historicos.map((h) => (
                        <div key={h.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{h.candidato_nome}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {h.ano_eleicao}
                              {h.cargo && ` · ${h.cargo}`}
                              {h.municipio_nome && ` · ${h.municipio_nome}`}
                              {(h.secoes as unknown[]).length > 0 && ` · ${(h.secoes as unknown[]).length} zona${(h.secoes as unknown[]).length !== 1 ? 's' : ''}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-primary-600">
                              {h.votos_calculados.toLocaleString('pt-BR')}
                            </p>
                            <p className="text-[10px] text-gray-400">votos</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      {!loading && cabos.length > 0 && (
        <footer className="border-t border-gray-100 bg-white">
          <div className="w-full px-6 py-4 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {cabos.length} {cabos.length === 1 ? 'cabo eleitoral' : 'cabos eleitorais'}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500">Total de expectativa de votos:</p>
              <p className="text-sm font-bold text-primary-600">{totalVotos.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </footer>
      )}

      {formOpen && (
        <CaboEleitoralForm
          cabo={editando}
          onClose={() => { setFormOpen(false); setEditando(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
