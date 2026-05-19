// VisaoMapaLV.tsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, RefreshCw, ArrowLeft, Truck, MapPin, Navigation, ZoomIn, ZoomOut, Crosshair, Filter, Eye } from 'lucide-react';

// ============================================
// CONFIGURAÇÕES DO MAPA
// ============================================

// Corrigir ícones do Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Interface do Veículo (compatível com ListaVeiculos)
interface Veiculo {
  id: string;
  placa: string;
  tipo: string;
  capacidade?: number;
  createdAt?: any;
  ultimaLocalizacao?: string;
  ultimoEndereco?: string;
  velocidade?: number;
  ultimaAtualizacaoRastreador?: any;
  statusRastreador?: 'online' | 'offline' | 'parado';
  ultimaMacro?: string;
  coordenadas?: {
    lat: number;
    lng: number;
  };
}

// Interface da Carga (para exibir programação)
interface CargaProgramada {
  id: string;
  dt: string;
  coletaCidade: string;
  coletaLocal: string;
  coletaData: string;
  entregaCidade: string;
  entregaLocal: string;
  entregaData: string;
  status: string;
  motorista: string;
  peso: string;
  placa: string;
  carreta?: string;
  veiculo?: string;
}

interface VisaoMapaProps {
  veiculos: Veiculo[];
  cargasPorVeiculo: Record<string, CargaProgramada | null>;
  onRefresh?: () => void;
  onBack?: () => void;
  loading?: boolean;
}

// Configuração de cores por status do rastreador
const STATUS_CONFIG: Record<string, { cor: string; label: string; legenda: string }> = {
  'online': { cor: '#22C55E', label: 'Online', legenda: '🟢 Veículo em movimento com rastreador ativo' },
  'offline': { cor: '#EF4444', label: 'Offline', legenda: '🔴 Veículo sem comunicação com rastreador' },
  'parado': { cor: '#FF9500', label: 'Parado', legenda: '🟠 Veículo estacionado/parado com rastreador ativo' },
};

// Configuração por tipo de veículo
const TIPO_CONFIG: Record<string, { label: string; icone: string }> = {
  'toco': { label: 'Toco', icone: '🚛' },
  'trucado': { label: 'Trucado', icone: '🚛' },
  'truck': { label: 'Truck', icone: '🚚' },
};

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

const getStatusInfo = (status: string) => {
  switch (status) {
    case 'programada':
      return { label: 'PROGRAMADA', color: '#FFD700', bg: '#FFD70020', icon: '⏳', legenda: 'Carga programada - Aguardando início' };
    case 'aguardando_carregamento':
      return { label: 'AGUARDANDO CARREGAMENTO', color: '#FF9500', bg: '#FF950020', icon: '📦', legenda: 'Aguardando carregamento da carga' };
    case 'seguindo_para_entrega':
      return { label: 'EM ROTA', color: '#22C55E', bg: '#22C55E20', icon: '🚛', legenda: 'Veículo em rota de entrega' };
    case 'chegou_entrega':
      return { label: 'CHEGOU NA ENTREGA', color: '#3B82F6', bg: '#3B82F620', icon: '📍', legenda: 'Veículo chegou ao destino' };
    default:
      return { label: status?.toUpperCase() || 'SEM CARGA', color: '#6B7280', bg: '#6B728020', icon: '⭕', legenda: 'Sem carga programada' };
  }
};

const getTipoNome = (tipo: string) => {
  switch (tipo) {
    case 'toco': return 'Toco (2 eixos)';
    case 'trucado': return 'Trucado (3 eixos)';
    case 'truck': return 'Truck (Cavalo)';
    default: return tipo;
  }
};

// ============================================
// ÍCONE PERSONALIZADO PARA VEÍCULOS COM STATUS
// ============================================

const createVehicleIcon = (statusRastreador: string, placa: string, tipo: string, carga: CargaProgramada | null) => {
  const config = STATUS_CONFIG[statusRastreador] || STATUS_CONFIG['offline'];
  const tipoConfig = TIPO_CONFIG[tipo] || { icone: '🚛', label: tipo };
  const corPrincipal = config.cor;
  const statusCarga = carga?.status || 'sem_carga';
  const cargaInfo = getStatusInfo(statusCarga);
  
  // Adicionar indicador de carga no ícone
  const cargaIndicator = carga ? cargaInfo.icon : '⭕';
  const motorista = carga?.motorista || 'Sem motorista';
  const motoristaAbreviado = motorista.length > 15 ? motorista.substring(0, 12) + '...' : motorista;

  const canvas = document.createElement('canvas');
  canvas.width = 60;
  canvas.height = 60;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Círculo externo com gradiente
    const gradient = ctx.createLinearGradient(0, 0, 60, 60);
    gradient.addColorStop(0, `${corPrincipal}40`);
    gradient.addColorStop(1, `${corPrincipal}10`);
    ctx.beginPath();
    ctx.arc(30, 30, 26, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = corPrincipal;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Ícone do veículo
    ctx.fillStyle = corPrincipal;
    ctx.font = '28px "Segoe UI Emoji"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tipoConfig.icone, 30, 32);

    // Indicador de carga (canto superior direito)
    ctx.font = '14px "Segoe UI Emoji"';
    ctx.fillStyle = cargaInfo.color;
    ctx.fillText(cargaIndicator, 42, 18);

    // Indicador de status (ponto inferior direito)
    ctx.beginPath();
    ctx.arc(45, 45, 7, 0, 2 * Math.PI);
    ctx.fillStyle = corPrincipal;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Segoe UI"';
    ctx.fillText(statusRastreador === 'online' ? '●' : statusRastreador === 'parado' ? '⏸' : '○', 45, 48);
  }

  // HTML do marcador com tooltip mostrando status e motorista
  const htmlContent = `
    <div style="position: relative; display: inline-block; cursor: pointer;">
      <img src="${canvas.toDataURL()}" style="width: 60px; height: 60px; display: block;" />
      <div class="vehicle-tooltip" style="
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-bottom: 8px;
        background: rgba(0, 0, 0, 0.95);
        backdrop-filter: blur(12px);
        color: white;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 10px;
        font-weight: 500;
        white-space: nowrap;
        border-left: 3px solid ${corPrincipal};
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        pointer-events: none;
        font-family: 'Segoe UI', sans-serif;
        opacity: 0;
        transition: opacity 0.2s;
        z-index: 1000;
      ">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span>${tipoConfig.icone}</span>
          <strong>${placa}</strong>
          <span style="color: ${corPrincipal}">●</span>
          <span style="font-size: 9px;">${config.label}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 9px;">
          <span>👨‍✈️</span>
          <span>${motoristaAbreviado}</span>
          <span style="color: ${cargaInfo.color}">${cargaIndicator}</span>
          <span style="font-size: 9px;">${cargaInfo.label}</span>
        </div>
      </div>
      <div style="
        position: absolute;
        top: -25px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
        color: white;
        padding: 3px 8px;
        border-radius: 16px;
        font-size: 9px;
        font-weight: 600;
        white-space: nowrap;
        border: 1px solid ${corPrincipal};
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        pointer-events: none;
        font-family: 'Segoe UI', sans-serif;
      ">
        ${placa}
      </div>
    </div>
  `;

  return L.divIcon({
    html: htmlContent,
    className: 'custom-vehicle-icon',
    iconSize: [60, 80],
    iconAnchor: [30, 60],
    popupAnchor: [0, -60]
  });
};

// ============================================
// COMPONENTES DE NAVEGAÇÃO
// ============================================

// Controlador do mapa para centralizar
function MapController({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap();

  useEffect(() => {
    if (center && center[0] !== 0 && center[1] !== 0) {
      map.setView(center, zoom || 12);
    }
  }, [center, zoom, map]);

  return null;
}

// Botões de zoom
const ZoomControls: React.FC<{ map?: L.Map }> = ({ map }) => {
  const handleZoomIn = () => map?.zoomIn();
  const handleZoomOut = () => map?.zoomOut();

  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      right: 20,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }}>
      <button
        onClick={handleZoomIn}
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: '#1A1A1A',
          border: '1px solid #333',
          color: '#FFF',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#3B82F6';
          e.currentTarget.style.borderColor = '#3B82F6';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#1A1A1A';
          e.currentTarget.style.borderColor = '#333';
        }}
      >
        <ZoomIn size={20} />
      </button>
      <button
        onClick={handleZoomOut}
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: '#1A1A1A',
          border: '1px solid #333',
          color: '#FFF',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#3B82F6';
          e.currentTarget.style.borderColor = '#3B82F6';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#1A1A1A';
          e.currentTarget.style.borderColor = '#333';
        }}
      >
        <ZoomOut size={20} />
      </button>
    </div>
  );
};

// Botão de localização
const LocateButton: React.FC<{ onLocate: () => void }> = ({ onLocate }) => {
  return (
    <button
      onClick={onLocate}
      style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        zIndex: 1000,
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#1A1A1A',
        border: '1px solid #333',
        color: '#FFF',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#22C55E';
        e.currentTarget.style.borderColor = '#22C55E';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#1A1A1A';
        e.currentTarget.style.borderColor = '#333';
      }}
    >
      <Crosshair size={20} />
    </button>
  );
};

// Painel de estatísticas
const StatsWidget: React.FC<{ stats: any; onExpand?: () => void }> = ({ stats, onExpand }) => {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    setExpanded(!expanded);
    if (!expanded && onExpand) onExpand();
  };

  return (
    <div style={{
      position: 'absolute',
      top: 90,
      left: 20,
      zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(10px)',
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.15)',
      overflow: 'hidden',
      transition: 'all 0.3s ease'
    }}>
      <div
        onClick={handleToggle}
        style={{
          padding: '12px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minWidth: expanded ? '280px' : '180px'
        }}
      >
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Truck size={20} color="#FFF" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#AAA' }}>Frota</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#FFF' }}>
            {stats.comLocalizacao}/{stats.total}
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#AAA' }}>{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: '#666' }}>Online</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#22C55E' }}>{stats.online}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#666' }}>Offline</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#EF4444' }}>{stats.offline}</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#666' }}>Parados</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#FF9500' }}>{stats.parado}</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Legenda detalhada com informações de status
const LegendaPanel = () => {
  const [showLegenda, setShowLegenda] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowLegenda(!showLegenda)}
        style={{
          position: 'absolute',
          bottom: 20,
          left: 80,
          zIndex: 1000,
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: showLegenda ? '#8B5CF6' : '#1A1A1A',
          border: '1px solid #333',
          color: '#FFF',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s'
        }}
      >
        <Eye size={20} />
      </button>

      {showLegenda && (
        <div style={{
          position: 'absolute',
          bottom: 80,
          left: 20,
          zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.92)',
          backdropFilter: 'blur(12px)',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.15)',
          padding: '14px 18px',
          minWidth: 260,
          maxWidth: 320
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF', marginBottom: 12, borderBottom: '1px solid #333', paddingBottom: 6 }}>
            📖 Legenda do Mapa
          </div>
          
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#FFD700', marginBottom: 6 }}>🚛 Status do Rastreador:</div>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <div key={key} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: config.cor }} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#FFF' }}>{config.label}</span>
                </div>
                <div style={{ fontSize: 9, color: '#999', marginLeft: 20 }}>{config.legenda}</div>
              </div>
            ))}
          </div>
          
          <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#FFD700', marginBottom: 6 }}>📋 Status da Carga:</div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span>🚛</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#22C55E' }}>Em Rota</span>
              </div>
              <div style={{ fontSize: 9, color: '#999', marginLeft: 20 }}>Veículo em rota de entrega</div>
            </div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span>📦</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#FF9500' }}>Aguardando Carregamento</span>
              </div>
              <div style={{ fontSize: 9, color: '#999', marginLeft: 20 }}>Aguardando início do carregamento</div>
            </div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span>⏳</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#FFD700' }}>Programada</span>
              </div>
              <div style={{ fontSize: 9, color: '#999', marginLeft: 20 }}>Carga programada - Aguardando início</div>
            </div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span>📍</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#3B82F6' }}>Chegou na Entrega</span>
              </div>
              <div style={{ fontSize: 9, color: '#999', marginLeft: 20 }}>Veículo chegou ao destino final</div>
            </div>
          </div>
          
          <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#FFD700', marginBottom: 6 }}>👨‍✈️ Informações no Marcador:</div>
            <div style={{ fontSize: 10, color: '#AAA', lineHeight: 1.4 }}>
              • <strong>Tooltip ao passar mouse</strong>: Mostra placa, status do rastreador, motorista e status da carga
              <br />• <strong>Popup ao clicar</strong>: Mostra todas as informações detalhadas do veículo e carga
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Painel de filtros
const FilterPanel: React.FC<{
  filtros: any;
  onFilterChange: (filtros: any) => void;
  onClose: () => void;
  veiculos: Veiculo[];
}> = ({ filtros, onFilterChange, onClose, veiculos }) => {
  const [localFiltros, setLocalFiltros] = useState(filtros);

  const tiposUnicos = useMemo(() => {
    const tipos = veiculos.map(v => v.tipo).filter((t, i, arr) => t && arr.indexOf(t) === i);
    return tipos;
  }, [veiculos]);

  const handleApply = () => {
    onFilterChange(localFiltros);
    onClose();
  };

  const handleReset = () => {
    const resetFiltros = {
      statusRastreador: 'todos',
      tipo: 'todos',
      placa: '',
      apenasComCarga: false
    };
    setLocalFiltros(resetFiltros);
    onFilterChange(resetFiltros);
    onClose();
  };

  return (
    <div style={{
      position: 'absolute',
      top: 90,
      right: 20,
      width: 300,
      backgroundColor: '#0A0A0A',
      borderRadius: 16,
      border: '1px solid #333',
      zIndex: 1000,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #222',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, color: '#FFF', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={18} /> Filtros
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#AAA', fontSize: 12 }}>Status Rastreador</label>
          <select
            value={localFiltros.statusRastreador}
            onChange={(e) => setLocalFiltros({ ...localFiltros, statusRastreador: e.target.value })}
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 8,
              border: '1px solid #333',
              backgroundColor: '#1A1A1A',
              color: '#FFF',
              fontSize: 12
            }}
          >
            <option value="todos">Todos</option>
            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#AAA', fontSize: 12 }}>Tipo de Veículo</label>
          <select
            value={localFiltros.tipo}
            onChange={(e) => setLocalFiltros({ ...localFiltros, tipo: e.target.value })}
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 8,
              border: '1px solid #333',
              backgroundColor: '#1A1A1A',
              color: '#FFF',
              fontSize: 12
            }}
          >
            <option value="todos">Todos</option>
            {tiposUnicos.map(tipo => (
              <option key={tipo} value={tipo}>{getTipoNome(tipo)}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#AAA', fontSize: 12 }}>Placa</label>
          <input
            type="text"
            value={localFiltros.placa}
            onChange={(e) => setLocalFiltros({ ...localFiltros, placa: e.target.value })}
            placeholder="Digite a placa..."
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 8,
              border: '1px solid #333',
              backgroundColor: '#1A1A1A',
              color: '#FFF',
              fontSize: 12
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px',
            borderRadius: 8,
            backgroundColor: '#111',
            border: '1px solid #333',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={localFiltros.apenasComCarga}
              onChange={(e) => setLocalFiltros({ ...localFiltros, apenasComCarga: e.target.checked })}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: '#FFF' }}>
              Apenas veículos com carga
            </span>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
          <button
            onClick={handleReset}
            style={{
              padding: 10,
              borderRadius: 8,
              border: '1px solid #EF4444',
              backgroundColor: 'transparent',
              color: '#EF4444',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            Limpar
          </button>
          <button
            onClick={handleApply}
            style={{
              padding: 10,
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#3B82F6',
              color: '#FFF',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

const VisaoMapaLV: React.FC<VisaoMapaProps> = ({
  veiculos,
  cargasPorVeiculo,
  onRefresh,
  onBack,
  loading = false
}) => {
  const [centroMapa, setCentroMapa] = useState<[number, number]>([-15.7797, -47.9297]);
  const [mapaZoom, setMapaZoom] = useState(12);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filtros, setFiltros] = useState({
    statusRastreador: 'todos',
    tipo: 'todos',
    placa: '',
    apenasComCarga: false
  });

  const mapRef = useRef<L.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  // Filtrar veículos com coordenadas válidas
  const veiculosComLocalizacao = useMemo(() => {
    return veiculos.filter(v =>
      v.coordenadas &&
      typeof v.coordenadas.lat === 'number' &&
      typeof v.coordenadas.lng === 'number' &&
      !isNaN(v.coordenadas.lat) &&
      !isNaN(v.coordenadas.lng) &&
      v.coordenadas.lat !== 0 &&
      v.coordenadas.lng !== 0
    );
  }, [veiculos]);

  // Aplicar filtros
  const veiculosFiltrados = useMemo(() => {
    return veiculosComLocalizacao.filter(v => {
      // Filtro por status do rastreador
      if (filtros.statusRastreador !== 'todos') {
        const status = v.statusRastreador || 'offline';
        if (status !== filtros.statusRastreador) return false;
      }

      // Filtro por tipo de veículo
      if (filtros.tipo !== 'todos' && v.tipo !== filtros.tipo) return false;

      // Filtro por placa
      if (filtros.placa && !v.placa.toLowerCase().includes(filtros.placa.toLowerCase())) return false;

      // Filtro "apenas com carga"
      if (filtros.apenasComCarga) {
        const temCarga = cargasPorVeiculo[v.id] !== null && cargasPorVeiculo[v.id] !== undefined;
        if (!temCarga) return false;
      }

      return true;
    });
  }, [veiculosComLocalizacao, filtros, cargasPorVeiculo]);

  // Estatísticas
  const stats = useMemo(() => {
    const total = veiculosComLocalizacao.length;
    const online = veiculosComLocalizacao.filter(v => v.statusRastreador === 'online').length;
    const offline = veiculosComLocalizacao.filter(v => v.statusRastreador === 'offline').length;
    const parado = veiculosComLocalizacao.filter(v => v.statusRastreador === 'parado').length;
    const filtrados = veiculosFiltrados.length;
    return { total, online, offline, parado, filtrados, comLocalizacao: total };
  }, [veiculosComLocalizacao, veiculosFiltrados]);

  // Centralizar mapa nos veículos
  useEffect(() => {
    if (veiculosFiltrados.length > 0 && !showFilterPanel) {
      const somaLat = veiculosFiltrados.reduce((sum, v) => sum + v.coordenadas!.lat, 0);
      const somaLng = veiculosFiltrados.reduce((sum, v) => sum + v.coordenadas!.lng, 0);
      const centroLat = somaLat / veiculosFiltrados.length;
      const centroLng = somaLng / veiculosFiltrados.length;
      setCentroMapa([centroLat, centroLng]);
    }
  }, [veiculosFiltrados, showFilterPanel]);

  // Função para centralizar na localização do usuário
  const handleLocateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          if (mapInstance) {
            mapInstance.setView([latitude, longitude], 14);
          }
          setCentroMapa([latitude, longitude]);
        },
        (error) => {
          console.error('Erro ao obter localização:', error);
        }
      );
    }
  };

  // Adicionar CSS para o efeito de tooltip
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .custom-vehicle-icon:hover .vehicle-tooltip {
        opacity: 1 !important;
      }
      .custom-vehicle-icon {
        transition: transform 0.2s;
      }
      .custom-vehicle-icon:hover {
        transform: scale(1.05);
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div style={{
      width: '100%',
      height: 'calc(100vh - 60px)',
      backgroundColor: '#000',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 20,
        right: 20,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        borderRadius: 16,
        padding: '12px 20px',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                backgroundColor: 'rgba(30,30,40,0.9)',
                border: '1px solid #444',
                borderRadius: '12px',
                padding: '8px 16px',
                color: '#FFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                e.currentTarget.style.borderColor = '#EF4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(30,30,40,0.9)';
                e.currentTarget.style.borderColor = '#444';
              }}
            >
              <ArrowLeft size={16} /> Voltar
            </button>
          )}

          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#FFF' }}>
              🗺️ Visão Mapa - Veículos
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#AAA' }}>
              Localização em tempo real com status do rastreador e informações da carga
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{
            backgroundColor: 'rgba(30,30,40,0.9)',
            borderRadius: '12px',
            padding: '6px 12px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#22C55E' }}>{stats.online}</span>
            <span style={{ fontSize: '10px', color: '#AAA', marginLeft: '6px' }}>online</span>
          </div>

          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            style={{
              backgroundColor: 'rgba(30,30,40,0.9)',
              border: showFilterPanel ? '1px solid #FFD700' : '1px solid #444',
              borderRadius: '12px',
              padding: '8px 16px',
              color: showFilterPanel ? '#FFD700' : '#FFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <Filter size={16} /> Filtros
          </button>

          {onRefresh && (
            <button
              onClick={onRefresh}
              style={{
                backgroundColor: 'rgba(30,30,40,0.9)',
                border: '1px solid #444',
                borderRadius: '12px',
                padding: '8px 16px',
                color: '#FFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <RefreshCw size={16} /> Atualizar
            </button>
          )}
        </div>
      </div>

      {/* Stats Widget */}
      <StatsWidget stats={stats} />

      {/* Zoom Controls */}
      <ZoomControls map={mapInstance} />

      {/* Locate Button */}
      <LocateButton onLocate={handleLocateUser} />

      {/* Legenda */}
      <LegendaPanel />

      {/* Mapa */}
      <MapContainer
        ref={(map) => {
          if (map) {
            mapRef.current = map;
            setMapInstance(map);
          }
        }}
        center={centroMapa}
        zoom={mapaZoom}
        style={{ height: '100%', width: '100%' }}
        whenReady={() => {
          if (mapInstance) {
            mapInstance.on('zoomend', () => {
              setMapaZoom(mapInstance.getZoom());
            });
          }
        }}
      >
        <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" />
        <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
        <MapController center={centroMapa} zoom={mapaZoom} />

        {/* Marcadores de veículos filtrados */}
        {veiculosFiltrados.map(veiculo => {
          const carga = cargasPorVeiculo[veiculo.id];
          const statusCarga = carga?.status || 'sem_carga';
          const statusInfo = getStatusInfo(statusCarga);
          const statusRastreador = veiculo.statusRastreador || 'offline';

          return (
            <Marker
              key={veiculo.id}
              position={[veiculo.coordenadas!.lat, veiculo.coordenadas!.lng]}
              icon={createVehicleIcon(statusRastreador, veiculo.placa, veiculo.tipo, carga)}
            >
              <Popup>
                <div style={{ fontSize: '12px', minWidth: '280px', maxWidth: '360px' }}>
                  {/* Cabeçalho com status */}
                  <div style={{
                    fontWeight: 600,
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: `2px solid ${statusInfo.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{ fontSize: '16px' }}>{statusInfo.icon}</span>
                    <span style={{ fontSize: '14px' }}>{veiculo.placa}</span>
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: STATUS_CONFIG[statusRastreador]?.cor + '20' || '#333',
                      color: STATUS_CONFIG[statusRastreador]?.cor || '#AAA'
                    }}>
                      {STATUS_CONFIG[statusRastreador]?.label || 'Offline'}
                    </span>
                    {carga && (
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: statusInfo.bg,
                        color: statusInfo.color
                      }}>
                        {statusInfo.label}
                      </span>
                    )}
                  </div>

                  {/* Informações do veículo */}
                  <div style={{ marginBottom: '12px' }}>
                    <div><strong>🚛 Tipo:</strong> {getTipoNome(veiculo.tipo)}</div>
                    {veiculo.capacidade && <div><strong>📦 Capacidade:</strong> {veiculo.capacidade} paletes</div>}
                    {veiculo.ultimaMacro && (
                      <div style={{ marginTop: '4px', color: '#FFD700' }}>🏷️ Macro: {veiculo.ultimaMacro}</div>
                    )}
                  </div>

                  {/* Localização */}
                  <div style={{
                    marginBottom: '12px',
                    padding: '8px',
                    backgroundColor: '#1A1A1A',
                    borderRadius: '8px'
                  }}>
                    <div><strong>📍 Localização:</strong> {veiculo.ultimaLocalizacao || veiculo.ultimoEndereco || '---'}</div>
                    <div style={{ marginTop: '4px', fontSize: '10px', color: '#888' }}>
                      🏎️ Velocidade: {veiculo.velocidade || 0} km/h
                    </div>
                    {veiculo.ultimaAtualizacaoRastreador && (
                      <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
                        ⏱️ Última atualização: {new Date(veiculo.ultimaAtualizacaoRastreador.seconds * 1000).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>

                  {/* Informações da carga detalhada */}
                  {carga && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      backgroundColor: '#1A1A1A',
                      borderRadius: '8px',
                      borderLeft: `4px solid ${statusInfo.color}`
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '8px', color: statusInfo.color, fontSize: '13px' }}>
                        {statusInfo.icon} CARGA ATUAL - {statusInfo.label}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                        <div><strong>📦 DT:</strong> {carga.dt || '—'}</div>
                        <div><strong>⚖️ Peso:</strong> {carga.peso || '—'} kg</div>
                      </div>
                      <div style={{ marginBottom: '6px' }}>
                        <strong>📍 Coleta:</strong> {carga.coletaCidade} - {carga.coletaLocal}
                      </div>
                      <div style={{ marginBottom: '6px' }}>
                        <strong>🎯 Entrega:</strong> {carga.entregaCidade} - {carga.entregaLocal}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                        <div><strong>📅 Data Coleta:</strong> {new Date(carga.coletaData).toLocaleDateString('pt-BR')}</div>
                        <div><strong>📅 Data Entrega:</strong> {new Date(carga.entregaData).toLocaleDateString('pt-BR')}</div>
                      </div>
                      <div style={{ 
                        marginTop: '8px', 
                        paddingTop: '6px', 
                        borderTop: '1px solid #333',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ fontSize: '14px' }}>👨‍✈️</span>
                        <div>
                          <strong>Motorista Programado:</strong> {carga.motorista || '—'}
                        </div>
                      </div>
                      {carga.carreta && (
                        <div style={{ marginTop: '4px' }}>
                          <strong>🔗 Carreta:</strong> {carga.carreta}
                        </div>
                      )}
                    </div>
                  )}

                  {!carga && (
                    <div style={{
                      marginTop: '8px',
                      padding: '12px',
                      backgroundColor: '#1A1A1A',
                      borderRadius: '8px',
                      color: '#888',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '20px', marginBottom: '4px' }}>⭕</div>
                      <div>Sem carga programada no momento</div>
                      <div style={{ fontSize: '10px', marginTop: '4px' }}>Veículo disponível para nova atribuição</div>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Painel de filtros */}
      {showFilterPanel && (
        <FilterPanel
          filtros={filtros}
          onFilterChange={setFiltros}
          onClose={() => setShowFilterPanel(false)}
          veiculos={veiculos}
        />
      )}

      {/* Indicador de veículos sem localização */}
      {veiculosComLocalizacao.length === 0 && !loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)',
          padding: '20px 32px',
          borderRadius: 20,
          textAlign: 'center',
          zIndex: 1000,
          border: '1px solid #333'
        }}>
          <Truck size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
          <h3 style={{ color: '#FFF', marginBottom: 8 }}>Nenhum veículo com localização</h3>
          <p style={{ color: '#888', fontSize: 13 }}>
            Os veículos precisam ter coordenadas cadastradas para aparecer no mapa
          </p>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: '#1A1A1A',
            padding: '20px 40px',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <RefreshCw size={24} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ color: '#FFF' }}>Carregando mapa...</span>
          </div>
        </div>
      )}

      {/* Estilos globais para animação */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default VisaoMapaLV;