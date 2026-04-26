import { useEffect, useState } from 'react';
import { useCandidateStore } from '@/stores/candidateStore';
import { mapaApi } from '@/services/api/mapa';
import MapView from './MapView';
import MapSidebar from './MapSidebar';
import MapFilterPanel, { type GeoTarget } from './MapFilterPanel';
import FloatingAIChat from '@/components/FloatingAIChat';

export interface MunicipioProperties {
  municipioTse: number;
  municipioIbge: number | null;
  municipioNome: string;
  microRegiaoId: number | null;
  uf: string;
  votosPartido: number;
  votosTotal: number;
  percentual: number;
  ranking: number;
  lat: number;
  lng: number;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: MunicipioProperties;
}

export interface MapMetadata {
  partido: string;
  cargo: string;
  uf: string;
  ano: number;
  totalMunicipios: number;
  totalVotosPartido: number;
  nomeUrna: string | null;
  microrregiao: string | null;
  macrorregiao: string | null;
}

export interface MapData {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
  metadata: MapMetadata;
}

export default function MapaPage() {
  const { candidateId } = useCandidateStore();
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [originalData, setOriginalData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [zoomTarget, setZoomTarget] = useState<GeoTarget | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!candidateId) {
      setError('Nenhum perfil encontrado. Conclua o Copiloto primeiro.');
      setLoading(false);
      return;
    }
    mapaApi
      .getDados(candidateId)
      .then((r) => {
        setMapData(r.data as MapData);
        setOriginalData(r.data as MapData);
      })
      .catch((err) => {
        const msg = err?.response?.data?.error ?? 'Erro ao carregar dados do mapa.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [candidateId]);

  const handleApply = (newData: MapData, geo?: GeoTarget) => {
    setMapData(newData);
    setZoomTarget(geo);
    setFilterOpen(false);
  };

  const handleReset = () => {
    setMapData(originalData);
    setZoomTarget(undefined);
    setFilterOpen(false);
  };

  const isFiltered =
    !!mapData && !!originalData &&
    (mapData.metadata.partido !== originalData.metadata.partido ||
      mapData.metadata.uf !== originalData.metadata.uf);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Carregando dados eleitorais…</p>
          <p className="text-gray-400 text-sm mt-1">Isso pode levar alguns segundos na primeira vez.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-500 font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">

      {/* Sidebar retrátil */}
      <div className={`flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${sidebarOpen ? 'w-72' : 'w-0'}`}>
        <div className="w-72 h-full">
          <MapSidebar mapData={mapData} />
        </div>
      </div>

      <div className="flex-1 relative">
        {/* Botão toggle — sempre visível na borda esquerda do mapa */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="absolute top-1/2 -translate-y-1/2 left-3 z-[1000] w-6 h-6 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors"
          title={sidebarOpen ? 'Recolher painel' : 'Expandir painel'}
        >
          <svg
            className={`w-3 h-3 text-gray-500 transition-transform duration-300 ${sidebarOpen ? '' : 'rotate-180'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {/* Botão de filtro */}
        <button
          onClick={() => setFilterOpen((v) => !v)}
          className="absolute top-4 z-[1000] bg-white shadow-md rounded-lg p-2 border border-gray-200 hover:bg-gray-50 transition-all duration-300"
          style={{ right: filterOpen ? '328px' : '16px' }}
          title={filterOpen ? 'Fechar filtros' : 'Filtros'}
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          {isFiltered && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
          )}
        </button>

        {/* Painel de filtros */}
        {candidateId && (
          <MapFilterPanel
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            mapData={mapData}
            defaultUF={originalData?.metadata.uf ?? ''}
            candidateId={candidateId}
            onApply={handleApply}
            onReset={handleReset}
          />
        )}

        <FloatingAIChat topOffset={60} rightOffset={filterOpen ? 328 : 16} />
        <MapView mapData={mapData} zoomTarget={zoomTarget} filterOpen={filterOpen} />
      </div>
    </div>
  );
}
