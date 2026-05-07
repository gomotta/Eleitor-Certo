import { useEffect, useState, useMemo } from 'react';
import { useCandidateStore } from '@/stores/candidateStore';
import { mapaApi } from '@/services/api/mapa';
import MapView, { type ColorMode } from './MapView';
import MapSidebar from './MapSidebar';
import MapFilterPanel, { type GeoTarget } from './MapFilterPanel';
import FloatingAIChat from '@/components/FloatingAIChat';
import MapRightTable from './MapRightTable';

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

const TODOS_ANOS = [2018, 2020, 2022, 2024];

const ANOS_MUNICIPAIS_SET = new Set([2012, 2016, 2020, 2024]);
const CARGOS_FEDERAIS = ['presidente', 'governador', 'senador', 'deputado federal', 'deputado estadual'];
const CARGOS_MUNICIPAIS_LIST = ['prefeito', 'vereador'];

function getCargosForAno(ano: number): string[] {
  return ANOS_MUNICIPAIS_SET.has(ano) ? CARGOS_MUNICIPAIS_LIST : CARGOS_FEDERAIS;
}

function isCargoValidForAno(cargo: string, ano: number): boolean {
  if (cargo === 'todos') return true;
  const cargos = getCargosForAno(ano);
  return cargos.includes(cargo);
}

export default function MapaPage() {
  useEffect(() => { document.title = 'Dashboard | Eleitor Certo'; }, []);

  const { candidateId } = useCandidateStore();
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [originalData, setOriginalData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [zoomTarget, setZoomTarget] = useState<GeoTarget | undefined>();
  const [geoFilter, setGeoFilter] = useState<GeoTarget | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightTableOpen, setRightTableOpen] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>('partido');
  const [selectedAno, setSelectedAno] = useState<number | undefined>();
  const [selectedCargo, setSelectedCargo] = useState<string>('todos');

  const FILTER_PANEL_WIDTH = 320;
  const RANKING_PANEL_WIDTH = 480;
  const PANEL_GAP = 8;
  const LEFT_SIDEBAR_WIDTH = 288; // w-72

  const rightButtonsOffset =
    16 + (rightTableOpen ? RANKING_PANEL_WIDTH + PANEL_GAP : 0) + (filterOpen ? FILTER_PANEL_WIDTH + PANEL_GAP : 0);

  const aiRightInset =
    16 + (rightTableOpen ? RANKING_PANEL_WIDTH + PANEL_GAP : 0) + (filterOpen ? FILTER_PANEL_WIDTH + PANEL_GAP : 0);
  const aiLeftInset = 16 + (sidebarOpen ? LEFT_SIDEBAR_WIDTH + PANEL_GAP : 0);

  const cargosDisponiveis = useMemo(
    () => (selectedAno ? getCargosForAno(selectedAno) : mapData ? getCargosForAno(mapData.metadata.ano) : CARGOS_FEDERAIS),
    [selectedAno, mapData?.metadata.ano],
  );

  const loadDados = (ano?: number, cargo?: string) => {
    if (!candidateId) return;
    setLoading(true);
    mapaApi
      .getDados(candidateId, ano, cargo)
      .then((r) => {
        const data = r.data as MapData;
        setMapData(data);
        setOriginalData(data);
        setGeoFilter(undefined);
        setZoomTarget(undefined);
      })
      .catch((err) => {
        const msg = err?.response?.data?.error ?? 'Erro ao carregar dados do mapa.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!candidateId) {
      setError('Nenhum perfil encontrado. Conclua o Copiloto primeiro.');
      setLoading(false);
      return;
    }
    loadDados(selectedAno, selectedCargo !== 'todos' ? selectedCargo : undefined);
  }, [candidateId, selectedAno, selectedCargo]);

  const handleYearChange = (ano: number) => {
    if (!isCargoValidForAno(selectedCargo, ano)) {
      setSelectedCargo('todos');
    }
    setSelectedAno(ano);
  };

  const handleCargoChange = (cargo: string) => {
    setSelectedCargo(cargo);
  };

  const handleApply = (newData: MapData, geo?: GeoTarget) => {
    setMapData(newData);
    setZoomTarget(geo);
    setGeoFilter(geo);
    setFilterOpen(false);
  };

  const handleReset = () => {
    setMapData(originalData);
    setZoomTarget(undefined);
    setGeoFilter(undefined);
    setFilterOpen(false);
    setRightTableOpen(false);
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
          <MapSidebar
            mapData={mapData}
            anosDisponiveis={TODOS_ANOS}
            selectedCargo={selectedCargo}
            cargosDisponiveis={cargosDisponiveis}
            onYearChange={handleYearChange}
            onCargoChange={handleCargoChange}
          />
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
          onClick={() => {
            setFilterOpen((v) => {
              const next = !v;
              if (next) setRightTableOpen(false);
              return next;
            });
          }}
          className="absolute top-4 z-[1000] bg-white shadow-md rounded-lg p-2 border border-gray-200 hover:bg-gray-50 transition-all duration-300"
          style={{ right: `${rightButtonsOffset}px` }}
          title={filterOpen ? 'Fechar filtros' : 'Filtros'}
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          {isFiltered && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary-600 rounded-full border-2 border-white" />
          )}
        </button>

        {/* Botão da tabela (ranking) */}
        <button
          onClick={() => {
            setRightTableOpen(true);
            setFilterOpen(false);
          }}
          className={`absolute top-16 z-[1000] bg-white shadow-md rounded-lg px-3 py-2 border border-gray-200 hover:bg-gray-50 transition-all duration-300 flex items-center gap-2 ${
            rightTableOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          style={{ right: `${rightButtonsOffset}px` }}
          title="Abrir ranking"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
          <span className="text-xs font-semibold text-gray-700">Ranking</span>
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

        <FloatingAIChat
          topOffset={60}
          rightOffset={rightButtonsOffset}
          leftInset={aiLeftInset}
          rightInset={aiRightInset}
          forceOpen
          hideToggleButton
        />
        <MapRightTable
          mapData={mapData}
          open={rightTableOpen}
          onClose={() => setRightTableOpen(false)}
          geoFilter={geoFilter}
        />
        {!rightTableOpen && (
          <button
            onClick={() => setColorMode((m) => m === 'partido' ? 'geral' : 'partido')}
            className="absolute z-[1001] text-[10px] text-gray-400 underline hover:text-gray-600 bg-transparent border-none cursor-pointer transition-all duration-300"
            style={{ bottom: '130px', right: filterOpen ? '336px' : '16px' }}
            title="Alternar modo de cores"
          >
            {colorMode === 'partido' ? 'Ver % votos válidos' : 'Ver % votos do partido'}
          </button>
        )}
        <MapView
          mapData={mapData}
          zoomTarget={zoomTarget}
          filterOpen={filterOpen}
          hideLegend={rightTableOpen || filterOpen}
          colorMode={colorMode}
          onGeoFocusChange={(geo) => {
            if (geo) setGeoFilter(geo);
          }}
        />
      </div>
    </div>
  );
}
