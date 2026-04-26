import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { interpolateRdYlGn } from 'd3-scale-chromatic';
import { useCandidateStore } from '@/stores/candidateStore';
import { mapaApi } from '@/services/api/mapa';
import type { MapData, MunicipioProperties } from './index';
import type { GeoTarget } from './MapFilterPanel';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  mapData: MapData | null;
  zoomTarget?: GeoTarget;
  filterOpen?: boolean;
}

type LayerNivel = 'macro' | 'micro' | 'zona';

function getLayerForZoom(zoom: number): LayerNivel {
  if (zoom < 7) return 'macro';
  if (zoom < 10) return 'micro';
  return 'zona';
}

function getColor(percentual: number): string {
  return interpolateRdYlGn(Math.min(percentual / 40, 1));
}

// ── Point-in-polygon (ray casting, GeoJSON coords are [lng, lat]) ─────────────

function raycast(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const lngi = ring[i][0], lati = ring[i][1];
    const lngj = ring[j][0], latj = ring[j][1];
    const intersect =
      (lati > lat) !== (latj > lat) &&
      lng < ((lngj - lngi) * (lat - lati)) / (latj - lati) + lngi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInFeature(lat: number, lng: number, feature: GeoJSON.Feature): boolean {
  const g = feature.geometry;
  if (g.type === 'Polygon') {
    return raycast(lat, lng, g.coordinates[0] as number[][]);
  }
  if (g.type === 'MultiPolygon') {
    return (g.coordinates as number[][][][]).some((poly) => raycast(lat, lng, poly[0]));
  }
  return false;
}

function findRegiaoAt(lat: number, lng: number, features: GeoJSON.Feature[]): number | null {
  for (const f of features) {
    if (pointInFeature(lat, lng, f)) {
      return (f.properties as any)?.regiaoId ?? null;
    }
  }
  return null;
}

type StatsMap = Map<number, { votosPartido: number; votosTotal: number }>;

function getPct(feature: GeoJSON.Feature | undefined, statsMap?: StatsMap): number {
  const regiaoId = (feature?.properties as any)?.regiaoId as number | undefined;
  if (statsMap && regiaoId) {
    const s = statsMap.get(regiaoId);
    if (s) return s.votosTotal > 0 ? (s.votosPartido / s.votosTotal) * 100 : 0;
  }
  return (feature?.properties as any)?.percentual ?? 0;
}

// ── Municipality bubbles ──────────────────────────────────────────────────────

function MunicipioLayer({ features, partido }: { features: any[]; partido: string }) {
  const maxVotos = useMemo(() => Math.max(...features.map((f) => f.properties.votosPartido), 1), [features]);
  const getRadius = (votos: number) => 6 + Math.sqrt(votos / maxVotos) * 22;

  return (
    <>
      {features.map((f) => {
        const p = f.properties as MunicipioProperties;
        const [lng, lat] = f.geometry.coordinates;
        return (
          <CircleMarker
            key={p.municipioTse}
            center={[lat, lng]}
            radius={getRadius(p.votosPartido)}
            pathOptions={{ fillColor: getColor(p.percentual), fillOpacity: 0.82, color: '#fff', weight: 0.8 }}
            eventHandlers={{
              mouseover: (e) => {
                const el = document.getElementById('mapa-tooltip');
                if (el) {
                  el.innerHTML = `
                    <div class="font-semibold text-gray-800 mb-1">${p.municipioNome}</div>
                    <div class="text-gray-600">Votos ${partido}: <strong>${p.votosPartido.toLocaleString('pt-BR')}</strong></div>
                    <div class="text-gray-600">% votos válidos: <strong>${p.percentual.toFixed(1)}%</strong></div>
                    <div class="text-gray-500">Ranking: <strong>#${p.ranking}</strong></div>
                  `;
                  el.style.display = 'block';
                  el.style.left = e.originalEvent.clientX + 12 + 'px';
                  el.style.top = e.originalEvent.clientY - 10 + 'px';
                }
                (e.target as L.CircleMarker).setStyle({ weight: 2, color: '#333' });
              },
              mousemove: (e) => {
                const el = document.getElementById('mapa-tooltip');
                if (el) {
                  el.style.left = e.originalEvent.clientX + 12 + 'px';
                  el.style.top = e.originalEvent.clientY - 10 + 'px';
                }
              },
              mouseout: (e) => {
                const el = document.getElementById('mapa-tooltip');
                if (el) el.style.display = 'none';
                (e.target as L.CircleMarker).setStyle({ weight: 0.8, color: '#fff' });
              },
            }}
          />
        );
      })}
    </>
  );
}

// ── Polygon layer (macro / micro) ─────────────────────────────────────────────

interface PoligonoProps {
  geoData: GeoJSON.FeatureCollection;
  nivel: 'macro' | 'micro';
  partido: string;
  activeMicroId?: number | null;
  statsMap?: StatsMap;
  onClickRegiao?: (feature: GeoJSON.Feature, layer: L.Layer) => void;
}

const STYLE_DEFAULT = (nivel: 'macro' | 'micro', pct: number) => ({
  fillColor: getColor(pct),
  fillOpacity: 0.7,
  color: '#fff',
  weight: nivel === 'macro' ? 1.5 : 1,
});

const STYLE_ACTIVE = { fillOpacity: 0, color: '#555', weight: 2 };

function PoligonoLayer({ geoData, nivel, partido, activeMicroId, statsMap, onClickRegiao }: PoligonoProps) {
  const map = useMap();
  const geoJsonRef = useRef<L.GeoJSON>(null);
  const activeMicroIdRef = useRef<number | null>(activeMicroId ?? null);
  useEffect(() => { activeMicroIdRef.current = activeMicroId ?? null; }, [activeMicroId]);
  const statsMapRef = useRef(statsMap);
  useEffect(() => { statsMapRef.current = statsMap; }, [statsMap]);

  // Imperatively update styles when activeMicroId changes (micro only)
  useEffect(() => {
    const layer = geoJsonRef.current;
    if (!layer || nivel !== 'micro') return;
    layer.eachLayer((sublayer) => {
      const feature = (sublayer as any).feature as GeoJSON.Feature;
      const regiaoId = (feature?.properties as any)?.regiaoId as number | undefined;
      const pct = getPct(feature, statsMapRef.current);
      const isActive = activeMicroId != null && regiaoId === activeMicroId;
      (sublayer as L.Path).setStyle(isActive ? STYLE_ACTIVE : STYLE_DEFAULT('micro', pct));
    });
  }, [activeMicroId, nivel]);

  // Imperatively update ALL styles when statsMap changes
  useEffect(() => {
    const layer = geoJsonRef.current;
    if (!layer) return;
    layer.eachLayer((sublayer) => {
      const feature = (sublayer as any).feature as GeoJSON.Feature;
      const regiaoId = (feature?.properties as any)?.regiaoId as number | undefined;
      const pct = getPct(feature, statsMap);
      const isActive = nivel === 'micro' && activeMicroIdRef.current != null && regiaoId === activeMicroIdRef.current;
      (sublayer as L.Path).setStyle(isActive ? STYLE_ACTIVE : STYLE_DEFAULT(nivel, pct));
    });
  }, [statsMap, nivel]);

  const styleFeature = useCallback(
    (feature?: GeoJSON.Feature) => {
      const regiaoId = (feature?.properties as any)?.regiaoId as number | undefined;
      const pct = getPct(feature, statsMapRef.current);
      if (nivel === 'micro' && activeMicroId != null && regiaoId === activeMicroId) {
        return STYLE_ACTIVE;
      }
      return STYLE_DEFAULT(nivel, pct);
    },
    [nivel, activeMicroId],
  );

  const onEachFeature = useCallback(
    (feature: GeoJSON.Feature, layer: L.Layer) => {
      const p = feature.properties as any;
      const nome: string = p?.regiaoNome ?? '';
      const regiaoId: number | undefined = p?.regiaoId;

      layer.on('mouseover', (e: L.LeafletMouseEvent) => {
        const s = regiaoId ? statsMapRef.current?.get(regiaoId) : undefined;
        const votos = s?.votosPartido ?? (p?.votosPartido ?? 0);
        const pct = s
          ? (s.votosTotal > 0 ? (s.votosPartido / s.votosTotal) * 100 : 0)
          : (p?.percentual ?? 0);
        const el = document.getElementById('mapa-tooltip');
        if (el) {
          el.innerHTML = `
            <div class="font-semibold text-gray-800 mb-1">${nome}</div>
            <div class="text-gray-600">Votos ${partido}: <strong>${votos.toLocaleString('pt-BR')}</strong></div>
            <div class="text-gray-600">% votos válidos: <strong>${pct.toFixed(1)}%</strong></div>
            ${nivel === 'macro' ? '<div class="text-gray-400 mt-1 text-[10px]">Clique para aproximar</div>' : ''}
          `;
          el.style.display = 'block';
          el.style.left = e.originalEvent.clientX + 12 + 'px';
          el.style.top = e.originalEvent.clientY - 10 + 'px';
        }
        const isActive = nivel === 'micro' && regiaoId === activeMicroIdRef.current && activeMicroIdRef.current != null;
        if (!isActive) (layer as L.Path).setStyle({ weight: 2.5, color: '#333' });
      });

      layer.on('mousemove', (e: L.LeafletMouseEvent) => {
        const el = document.getElementById('mapa-tooltip');
        if (el) {
          el.style.left = e.originalEvent.clientX + 12 + 'px';
          el.style.top = e.originalEvent.clientY - 10 + 'px';
        }
      });

      layer.on('mouseout', () => {
        const el = document.getElementById('mapa-tooltip');
        if (el) el.style.display = 'none';
        const s = regiaoId ? statsMapRef.current?.get(regiaoId) : undefined;
        const pct = s
          ? (s.votosTotal > 0 ? (s.votosPartido / s.votosTotal) * 100 : 0)
          : (p?.percentual ?? 0);
        const isActive = nivel === 'micro' && regiaoId === activeMicroIdRef.current && activeMicroIdRef.current != null;
        (layer as L.Path).setStyle(isActive ? STYLE_ACTIVE : STYLE_DEFAULT(nivel, pct));
      });

      layer.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (onClickRegiao) onClickRegiao(feature, layer);
        else {
          const bounds = (layer as L.Polygon).getBounds();
          if (bounds.isValid()) map.flyToBounds(bounds, { padding: [40, 40], duration: 0.8 });
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, nivel, partido, onClickRegiao],
  );

  return (
    <GeoJSON
      key={nivel}
      ref={geoJsonRef}
      data={geoData}
      style={styleFeature}
      onEachFeature={onEachFeature}
    />
  );
}

// ── Zoom + move controller ────────────────────────────────────────────────────

function ZoomController({
  onZoomChange,
  onCenter,
}: {
  onZoomChange: (nivel: LayerNivel) => void;
  onCenter: (lat: number, lng: number, zoom: number) => void;
}) {
  const map = useMapEvents({
    zoomend: () => {
      const zoom = map.getZoom();
      onZoomChange(getLayerForZoom(zoom));
      const c = map.getCenter();
      onCenter(c.lat, c.lng, zoom);
    },
    moveend: () => {
      const c = map.getCenter();
      onCenter(c.lat, c.lng, map.getZoom());
    },
  });
  return null;
}

// ── Main map layers ───────────────────────────────────────────────────────────

type LayerCache = { macro: GeoJSON.FeatureCollection | null; micro: GeoJSON.FeatureCollection | null };

function MapLayers({ mapData, onNivelChange, zoomTarget }: { mapData: MapData; onNivelChange?: (n: LayerNivel) => void; zoomTarget?: GeoTarget }) {
  const map = useMap();
  const { candidateId } = useCandidateStore();
  const [currentNivel, setCurrentNivel] = useState<LayerNivel>('macro');
  const [layerCache, setLayerCache] = useState<LayerCache>({ macro: null, micro: null });
  const [activeMicroId, setActiveMicroId] = useState<number | null>(null);
  const loadingRef = useRef<Set<string>>(new Set());
  const initialZoomDone = useRef(false);

  const loadLayer = useCallback(
    async (nivel: 'macro' | 'micro') => {
      if (!candidateId || layerCache[nivel] || loadingRef.current.has(nivel)) return;
      loadingRef.current.add(nivel);
      try {
        const resp = await mapaApi.getCamada(candidateId, nivel);
        setLayerCache((prev) => ({ ...prev, [nivel]: resp.data }));
      } catch (err) {
        console.error(`Erro ao carregar camada ${nivel}:`, err);
      } finally {
        loadingRef.current.delete(nivel);
      }
    },
    [candidateId, layerCache],
  );

  useEffect(() => {
    loadLayer('macro');
    // Pré-carrega micro se candidato tem microrregião definida
    if (mapData.metadata.microrregiao) loadLayer('micro');
  }, []);

  useEffect(() => {
    if (currentNivel === 'micro' || currentNivel === 'zona') loadLayer('micro');
  }, [currentNivel]);

  // Zoom inicial baseado na localidade do copiloto
  useEffect(() => {
    if (initialZoomDone.current) return;

    const { microrregiao, macrorregiao } = mapData.metadata;

    const fitAllMunicipios = () => {
      if (mapData.features.length === 0) return;
      const latlngs = mapData.features.map(
        (f) => [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number],
      );
      const bounds = L.latLngBounds(latlngs);
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
    };

    if (microrregiao) {
      if (!layerCache.micro) return; // aguarda a camada carregar
      const feature = layerCache.micro.features.find(
        (f) => (f.properties as any).regiaoNome?.toLowerCase() === microrregiao.toLowerCase(),
      );
      if (feature) {
        const bounds = L.geoJSON(feature).getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
        else fitAllMunicipios();
        // Set nivel and activeMicroId immediately — don't wait for zoomend/moveend
        const regiaoId = (feature.properties as any)?.regiaoId as number | undefined;
        if (regiaoId) {
          setActiveMicroId(regiaoId);
          setCurrentNivel('zona');
          onNivelChange?.('zona');
        }
      } else {
        fitAllMunicipios();
      }
      initialZoomDone.current = true;
    } else if (macrorregiao) {
      if (!layerCache.macro) return; // aguarda a camada carregar
      const feature = layerCache.macro.features.find(
        (f) => (f.properties as any).regiaoNome?.toLowerCase() === macrorregiao.toLowerCase(),
      );
      const bounds = feature ? L.geoJSON(feature).getBounds() : null;
      if (bounds?.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
      else fitAllMunicipios();
      initialZoomDone.current = true;
    } else {
      // Só estado: zoom no estado todo
      fitAllMunicipios();
      initialZoomDone.current = true;
    }
  }, [layerCache.macro, layerCache.micro]);

  // Zoom comandado pelo painel de filtros
  useEffect(() => {
    if (!zoomTarget) return;
    if (zoomTarget.type === 'macro' && layerCache.macro) {
      const f = layerCache.macro.features.find(
        (ft) => (ft.properties as any).regiaoNome?.toLowerCase() === zoomTarget.nome.toLowerCase(),
      );
      if (f) { const b = L.geoJSON(f).getBounds(); if (b.isValid()) map.fitBounds(b, { padding: [30, 30] }); }
    } else if (zoomTarget.type === 'micro' && layerCache.micro) {
      const f = layerCache.micro.features.find(
        (ft) => (ft.properties as any).regiaoNome?.toLowerCase() === zoomTarget.nome.toLowerCase(),
      );
      if (f) { const b = L.geoJSON(f).getBounds(); if (b.isValid()) map.fitBounds(b, { padding: [20, 20] }); }
    } else if (zoomTarget.type === 'cidade') {
      const f = (zoomTarget.municipioTse
        ? mapData.features.find((ft) => ft.properties.municipioTse === zoomTarget.municipioTse)
        : null)
        ?? mapData.features.find((ft) => ft.properties.municipioNome?.toLowerCase() === zoomTarget.nome.toLowerCase());
      if (f) map.setView([f.geometry.coordinates[1], f.geometry.coordinates[0]], 13);
    }
  }, [zoomTarget]);

  const handleZoomChange = useCallback((nivel: LayerNivel) => {
    setCurrentNivel(nivel);
    onNivelChange?.(nivel);
  }, [onNivelChange]);

  // Detect which micro region the map center is over; clear when zooming out
  const handleCenter = useCallback(
    (lat: number, lng: number, zoom: number) => {
      if (zoom < 10) {
        setActiveMicroId(null);
        return;
      }
      if (!layerCache.micro) return;
      const id = findRegiaoAt(lat, lng, layerCache.micro.features);
      setActiveMicroId((prev) => (prev === id ? prev : id));
    },
    [layerCache.micro],
  );

  const handleClickMacro = useCallback(
    (_feature: GeoJSON.Feature, layer: L.Layer) => {
      const bounds = (layer as L.Polygon).getBounds();
      if (bounds.isValid()) map.flyToBounds(bounds, { padding: [30, 30], duration: 0.8 });
    },
    [map],
  );

  const handleClickMicro = useCallback(
    (_feature: GeoJSON.Feature, layer: L.Layer) => {
      const bounds = (layer as L.Polygon).getBounds();
      if (bounds.isValid()) map.flyToBounds(bounds, { padding: [20, 20], duration: 0.8 });
    },
    [map],
  );

  const partido = mapData.metadata.partido;
  const showMacro = currentNivel === 'macro' && layerCache.macro;
  const showMicro = (currentNivel === 'micro' || currentNivel === 'zona') && layerCache.micro;
  const showCidade = currentNivel === 'zona';

  // Aggregate mapData votes per micro region (used to color micro polygons after filter)
  const microStats = useMemo<StatsMap>(() => {
    const stats: StatsMap = new Map();
    for (const f of mapData.features) {
      const id = f.properties.microRegiaoId;
      if (!id) continue;
      const cur = stats.get(id) ?? { votosPartido: 0, votosTotal: 0 };
      stats.set(id, {
        votosPartido: cur.votosPartido + f.properties.votosPartido,
        votosTotal: cur.votosTotal + f.properties.votosTotal,
      });
    }
    return stats;
  }, [mapData.features]);

  // Aggregate mapData votes per macro region via point-in-polygon
  const macroStats = useMemo<StatsMap | undefined>(() => {
    if (!layerCache.macro) return undefined;
    const stats: StatsMap = new Map();
    for (const f of mapData.features) {
      const [lng, lat] = f.geometry.coordinates;
      const macroId = findRegiaoAt(lat, lng, layerCache.macro.features);
      if (!macroId) continue;
      const cur = stats.get(macroId) ?? { votosPartido: 0, votosTotal: 0 };
      stats.set(macroId, {
        votosPartido: cur.votosPartido + f.properties.votosPartido,
        votosTotal: cur.votosTotal + f.properties.votosTotal,
      });
    }
    return stats;
  }, [mapData.features, layerCache.macro]);

  const municipioFeatures = useMemo(() => {
    if (!showCidade) return [];
    if (!activeMicroId) return mapData.features;
    // Primary: filter by IBGE microRegiaoId attached during prefetch
    const byId = mapData.features.filter((f) => f.properties.microRegiaoId === activeMicroId);
    if (byId.length > 0) return byId;
    // Fallback: point-in-polygon when prefetch hasn't populated microRegiaoId yet
    if (layerCache.micro) {
      const activeFeature = layerCache.micro.features.find(
        (f) => (f.properties as any).regiaoId === activeMicroId,
      );
      if (activeFeature) {
        return mapData.features.filter((f) => {
          const [lng, lat] = f.geometry.coordinates;
          return pointInFeature(lat, lng, activeFeature);
        });
      }
    }
    return mapData.features;
  }, [showCidade, activeMicroId, layerCache.micro, mapData.features]);

  return (
    <>
      <ZoomController onZoomChange={handleZoomChange} onCenter={handleCenter} />

      <div
        id="mapa-tooltip"
        style={{ display: 'none', position: 'fixed', zIndex: 9998, pointerEvents: 'none' }}
        className="bg-white shadow-lg rounded-lg px-3 py-2 text-xs border border-gray-200 max-w-[220px]"
      />

      {showMacro && (
        <PoligonoLayer
          geoData={layerCache.macro!}
          nivel="macro"
          partido={partido}
          statsMap={macroStats}
          onClickRegiao={handleClickMacro}
        />
      )}

      {showMicro && (
        <PoligonoLayer
          geoData={layerCache.micro!}
          nivel="micro"
          partido={partido}
          activeMicroId={activeMicroId}
          statsMap={microStats}
          onClickRegiao={handleClickMicro}
        />
      )}

      {showCidade && municipioFeatures.length > 0 && (
        <MunicipioLayer features={municipioFeatures as any} partido={partido} />
      )}
    </>
  );
}

// ── Legend + indicator ────────────────────────────────────────────────────────

function MapLegend({ partido, nivel, filterOpen }: { partido: string; nivel: LayerNivel; filterOpen?: boolean }) {
  const steps = [0, 10, 20, 30, 40];
  const labelMap: Record<LayerNivel, string> = { macro: 'Mesorregião', micro: 'Microrregião', zona: 'Município' };
  return (
    <div
      className="absolute bottom-8 z-[1000] bg-white rounded-xl shadow-lg p-3 border border-gray-200 text-xs transition-all duration-300"
      style={{ right: filterOpen ? '336px' : '16px' }}
    >
      <p className="font-semibold text-gray-700 mb-1">% votos válidos — {partido}</p>
      <p className="text-gray-400 text-[10px] mb-2">{labelMap[nivel]}</p>
      <div className="flex items-center gap-0.5">
        {steps.map((s) => (
          <div key={s} className="w-9 h-4 rounded-sm" style={{ backgroundColor: interpolateRdYlGn(s / 40) }} />
        ))}
      </div>
      <div className="flex justify-between mt-1 text-gray-500">
        <span>0%</span><span>10%</span><span>20%</span><span>30%</span><span>40%+</span>
      </div>
      {nivel !== 'zona' && <p className="text-gray-400 mt-2 text-[10px]">Clique para aproximar</p>}
      {nivel === 'zona' && <p className="text-gray-400 mt-2 text-[10px]">Tamanho = volume de votos</p>}
    </div>
  );
}

function LayerIndicator({ nivel }: { nivel: LayerNivel }) {
  const labels: Record<LayerNivel, string> = { macro: 'Mesorregiões', micro: 'Microrregiões', zona: 'Municípios' };
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-medium text-gray-700 shadow border border-gray-200">
      {labels[nivel]}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

function MapLayersWithNivelState({ mapData, zoomTarget, filterOpen }: { mapData: MapData; zoomTarget?: GeoTarget; filterOpen?: boolean }) {
  const [nivel, setNivel] = useState<LayerNivel>('macro');
  return (
    <>
      <MapLayers mapData={mapData} onNivelChange={setNivel} zoomTarget={zoomTarget} />
      <MapLegend partido={mapData.metadata.partido} nivel={nivel} filterOpen={filterOpen} />
      <LayerIndicator nivel={nivel} />
    </>
  );
}

export default function MapView({ mapData, zoomTarget, filterOpen }: Props) {
  return (
    <MapContainer center={[-18.5, -44.0]} zoom={6} className="h-full w-full" zoomControl>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {mapData && <MapLayersWithNivelState mapData={mapData} zoomTarget={zoomTarget} filterOpen={filterOpen} />}
    </MapContainer>
  );
}
