// VisaoMapa.tsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Truck,
  MapPin,
  Filter,
  X,
  RefreshCw,
  Calendar,
  Clock,
  Package,
  MapPinned,
  Weight,
  AlertCircle,
  FileText,
  Maximize2,
  Minimize2,
} from 'lucide-react';

// Corrigir ícones padrão do Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Interface para motorista com localização
interface MotoristaComLocalizacao {
  id: string;
  nome: string;
  cpf: string;
  cidade?: string;
  whatsapp?: string;
  placa?: string;
  status?: string;
  statusLabel?: string;
  statusCor?: string;
  coordenadas?: { lat: number; lng: number };
  ultimaLocalizacao?: string;
  ultimaAtualizacao?: any;
  velocidade?: number;
  cargaAtual?: {
    id: string;
    dt?: string;  // Campo DT (Documento de Transporte)
    coletaLocal: string;
    coletaCidade: string;
    coletaEndereco?: string;
    entregaLocal: string;
    entregaCidade: string;
    entregaEndereco?: string;
    coletaData: string;
    coletaHora?: string;
    entregaData: string;
    entregaHora?: string;
    peso: string;
    produto?: string;
    notaFiscal?: string;
  };
}

interface VisaoMapaProps {
  motoristas: MotoristaComLocalizacao[];
  onRefresh?: () => void;
  loading?: boolean;
}

// Mapeamento de cores por status
const STATUS_CONFIG: Record<string, { cor: string; corBg: string; label: string }> = {
  'programada': { cor: '#FFD700', corBg: '#FFD70020', label: 'Programado' },
  'aguardando_carregamento': { cor: '#FF9500', corBg: '#FF950020', label: 'Aguardando Carregamento' },
  'seguindo_para_entrega': { cor: '#22C55E', corBg: '#22C55E20', label: 'Seguindo para Entrega' },
  'chegou_entrega': { cor: '#3B82F6', corBg: '#3B82F620', label: 'Chegou na Entrega' },
  'sem_carga': { cor: '#6B7280', corBg: '#6B728020', label: 'Sem Carga' },
  'offline': { cor: '#EF4444', corBg: '#EF444420', label: 'Offline' },
};

// Função para criar ícone personalizado do caminhão
const createTruckIcon = (status: string) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['sem_carga'];
  const corPrincipal = config.cor;
  
  const canvas = document.createElement('canvas');
  canvas.width = 44;
  canvas.height = 44;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    ctx.beginPath();
    ctx.arc(22, 22, 20, 0, 2 * Math.PI);
    ctx.fillStyle = `${corPrincipal}20`;
    ctx.fill();
    ctx.strokeStyle = corPrincipal;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    
    ctx.fillStyle = corPrincipal;
    ctx.font = '24px "Segoe UI Emoji"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚚', 22, 24);
    
    ctx.beginPath();
    ctx.arc(34, 34, 6, 0, 2 * Math.PI);
    ctx.fillStyle = corPrincipal;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px "Segoe UI"';
    ctx.fillText('●', 34, 36);
  }
  
  return L.divIcon({
    html: `<img src="${canvas.toDataURL()}" style="width: 44px; height: 44px;" />`,
    className: 'custom-truck-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44]
  });
};

// Componente para centralizar o mapa
function MapController({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (center && center[0] !== 0 && center[1] !== 0) {
      map.setView(center, zoom || 12);
    }
  }, [center, zoom, map]);
  
  return null;
}

// Componente de legenda
const LegendaMapa: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const statuses = [
    { key: 'programada', ...STATUS_CONFIG['programada'] },
    { key: 'aguardando_carregamento', ...STATUS_CONFIG['aguardando_carregamento'] },
    { key: 'seguindo_para_entrega', ...STATUS_CONFIG['seguindo_para_entrega'] },
    { key: 'chegou_entrega', ...STATUS_CONFIG['chegou_entrega'] },
    { key: 'sem_carga', ...STATUS_CONFIG['sem_carga'] },
    { key: 'offline', ...STATUS_CONFIG['offline'] },
  ];

  return (
    <div className="map-legend" style={{
      position: 'absolute',
      bottom: 20,
      right: 20,
      zIndex: 1000,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      borderRadius: '16px',
      padding: '14px 18px',
      backdropFilter: 'blur(10px)',
      fontSize: '12px',
      minWidth: '190px',
      border: '1px solid rgba(255,255,255,0.15)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ color: '#FFF', fontWeight: 700, fontSize: '13px' }}>📋 Legenda - Status</span>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        )}
      </div>
      {statuses.map(s => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: s.cor,
            boxShadow: `0 0 4px ${s.cor}`,
            border: '1px solid rgba(255,255,255,0.3)'
          }} />
          <span style={{ color: '#E0E0E0', fontSize: '12px', fontWeight: 500 }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
};

// Componente de filtros
const FiltrosMapa: React.FC<{
  filtros: any;
  setFiltros: (filtros: any) => void;
  onClose: () => void;
}> = ({ filtros, setFiltros, onClose }) => {
  return (
    <div className="map-filters" style={{
      position: 'absolute',
      top: 20,
      right: 20,
      zIndex: 1000,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      borderRadius: '20px',
      padding: '20px',
      border: '1px solid rgba(255,255,255,0.15)',
      backdropFilter: 'blur(10px)',
      width: '280px',
      boxShadow: '0 8px 20px rgba(0,0,0,0.4)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <span style={{ color: '#FFF', fontWeight: 700 }}>🔍 Filtros</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '11px', color: '#AAA', display: 'block', marginBottom: '6px' }}>Status da Carga</label>
        <select
          value={filtros.status}
          onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '12px',
            border: '1px solid #444',
            backgroundColor: '#1A1A1A',
            color: '#FFF',
            fontSize: '13px'
          }}
        >
          <option value="todos">Todos os Status</option>
          <option value="programada">📋 Programado</option>
          <option value="aguardando_carregamento">⏳ Aguardando Carregamento</option>
          <option value="seguindo_para_entrega">🚛 Seguindo para Entrega</option>
          <option value="chegou_entrega">📍 Chegou na Entrega</option>
          <option value="sem_carga">🟡 Sem Carga</option>
          <option value="offline">🔴 Offline</option>
        </select>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '11px', color: '#AAA', display: 'block', marginBottom: '6px' }}>Nome do Motorista</label>
        <input
          type="text"
          placeholder="Digite para filtrar..."
          value={filtros.nome}
          onChange={(e) => setFiltros({ ...filtros, nome: e.target.value })}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '12px',
            border: '1px solid #444',
            backgroundColor: '#1A1A1A',
            color: '#FFF',
            fontSize: '13px'
          }}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '11px', color: '#AAA', display: 'block', marginBottom: '6px' }}>Placa do Veículo</label>
        <input
          type="text"
          placeholder="Digite a placa..."
          value={filtros.placa}
          onChange={(e) => setFiltros({ ...filtros, placa: e.target.value.toUpperCase() })}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '12px',
            border: '1px solid #444',
            backgroundColor: '#1A1A1A',
            color: '#FFF',
            fontSize: '13px'
          }}
        />
      </div>

      <button
        onClick={() => {
          setFiltros({ status: 'todos', nome: '', placa: '', cidade: '' });
        }}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: '12px',
          border: '1px solid #EF4444',
          backgroundColor: 'transparent',
          color: '#EF4444',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 600,
          marginTop: '8px'
        }}
      >
        Limpar Filtros
      </button>
    </div>
  );
};

// Componente do conteúdo do Popup - COM DT INFORMATIVA
const PopupContent: React.FC<{ motorista: MotoristaComLocalizacao }> = ({ motorista }) => {
  const statusKey = motorista.status || 'sem_carga';
  const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG['sem_carga'];
  const viagem = motorista.cargaAtual;
  const temViagem = viagem && viagem.coletaLocal && viagem.entregaLocal;
  
  // Pega a DT (Documento de Transporte)
  const numeroDT = viagem?.dt || '';

  return (
    <div style={{ minWidth: '320px', maxWidth: '380px', padding: '8px', backgroundColor: '#0A0A0A', color: '#FFF' }}>
      {/* Cabeçalho */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        marginBottom: '16px', 
        borderBottom: `2px solid ${config.cor}`, 
        paddingBottom: '12px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '24px',
          backgroundColor: `${config.cor}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          border: `2px solid ${config.cor}`
        }}>
          🚚
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{motorista.nome}</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: config.cor,
              boxShadow: `0 0 4px ${config.cor}`
            }} />
            <span style={{ fontSize: '11px', color: config.cor, fontWeight: 600 }}>{config.label}</span>
            {motorista.placa && <span style={{ fontSize: '11px', color: '#888' }}>• {motorista.placa}</span>}
          </div>
        </div>
      </div>

      {/* VIAGEM ATUAL */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          marginBottom: '12px',
          backgroundColor: `${config.cor}10`,
          padding: '6px 10px',
          borderRadius: '8px'
        }}>
          <Package size={14} color={config.cor} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: config.cor }}>VIAGEM ATUAL</span>
        </div>
        
        {temViagem ? (
          <>
            {/* DT DA CARGA ATUAL - APENAS INFORMATIVO */}
            {numeroDT && (
              <div style={{ 
                marginBottom: '12px', 
                padding: '6px 12px',
                backgroundColor: '#111',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <FileText size={14} color="#888" />
                <span style={{ fontSize: '12px', color: '#AAA' }}>DT:</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFF', fontFamily: 'monospace' }}>
                  {numeroDT}
                </span>
              </div>
            )}
            
            {/* COLETA */}
            <div style={{ 
              marginBottom: '14px', 
              paddingLeft: '8px',
              borderLeft: `3px solid #22C55E`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <MapPinned size={14} color="#22C55E" />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#22C55E' }}>COLETA</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                {viagem.coletaLocal}
              </div>
              <div style={{ fontSize: '11px', color: '#AAA', marginBottom: '4px' }}>
                {viagem.coletaCidade}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#888', marginTop: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={10} /> {viagem.coletaData}
                </span>
                {viagem.coletaHora && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={10} /> {viagem.coletaHora}
                  </span>
                )}
              </div>
            </div>
            
            {/* Seta */}
            <div style={{ textAlign: 'center', margin: '4px 0', color: '#555' }}>
              <span style={{ fontSize: '16px' }}>⬇️</span>
            </div>
            
            {/* ENTREGA */}
            <div style={{ 
              marginBottom: '14px', 
              paddingLeft: '8px',
              borderLeft: `3px solid ${config.cor}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <MapPin size={14} color={config.cor} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: config.cor }}>ENTREGA</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                {viagem.entregaLocal}
              </div>
              <div style={{ fontSize: '11px', color: '#AAA', marginBottom: '4px' }}>
                {viagem.entregaCidade}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#888', marginTop: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={10} /> {viagem.entregaData}
                </span>
                {viagem.entregaHora && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={10} /> {viagem.entregaHora}
                  </span>
                )}
              </div>
            </div>
            
            {/* Peso e outras informações */}
            <div style={{ 
              backgroundColor: '#111', 
              borderRadius: '8px', 
              padding: '8px 10px',
              marginTop: '8px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              {viagem.peso && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Weight size={12} color="#888" />
                  <span style={{ fontSize: '11px', color: '#CCC' }}>Peso: <strong>{viagem.peso}</strong></span>
                </div>
              )}
              {viagem.produto && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Package size={12} color="#888" />
                  <span style={{ fontSize: '11px', color: '#CCC' }}>Produto: <strong>{viagem.produto}</strong></span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: '20px',
            backgroundColor: '#111',
            borderRadius: '8px',
            color: '#666'
          }}>
            <AlertCircle size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p style={{ fontSize: '12px', margin: 0 }}>Sem viagem ativa no momento</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Componente principal
const VisaoMapa: React.FC<VisaoMapaProps> = ({
  motoristas,
  onRefresh,
  loading = false
}) => {
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [legendaAberta, setLegendaAberta] = useState(true);
  const [centroMapa, setCentroMapa] = useState<[number, number]>([-23.5505, -46.6333]);
  const [filtros, setFiltros] = useState({
    status: 'todos',
    nome: '',
    placa: '',
    cidade: ''
  });
  const mapRef = useRef<L.Map | null>(null);

  const motoristasFiltrados = useMemo(() => {
    return motoristas.filter(motorista => {
      if (filtros.status !== 'todos') {
        const statusMotorista = motorista.status || 'sem_carga';
        if (statusMotorista !== filtros.status) return false;
      }
      
      if (filtros.nome && !motorista.nome.toLowerCase().includes(filtros.nome.toLowerCase())) {
        return false;
      }
      
      if (filtros.placa && !motorista.placa?.toLowerCase().includes(filtros.placa.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }, [motoristas, filtros]);

  const motoristasComLocalizacao = useMemo(() => {
    return motoristasFiltrados.filter(m => 
      m.coordenadas && 
      typeof m.coordenadas.lat === 'number' && 
      typeof m.coordenadas.lng === 'number' &&
      !isNaN(m.coordenadas.lat) && 
      !isNaN(m.coordenadas.lng) &&
      m.coordenadas.lat !== 0 && 
      m.coordenadas.lng !== 0
    );
  }, [motoristasFiltrados]);

  useEffect(() => {
    if (motoristasComLocalizacao.length > 0) {
      const somaLat = motoristasComLocalizacao.reduce((sum, m) => sum + m.coordenadas!.lat, 0);
      const somaLng = motoristasComLocalizacao.reduce((sum, m) => sum + m.coordenadas!.lng, 0);
      const centroLat = somaLat / motoristasComLocalizacao.length;
      const centroLng = somaLng / motoristasComLocalizacao.length;
      setCentroMapa([centroLat, centroLng]);
    }
  }, [motoristasComLocalizacao]);

  const stats = useMemo(() => {
    const total = motoristas.length;
    const comLocalizacao = motoristasComLocalizacao.length;
    const semLocalizacao = total - comLocalizacao;
    return { total, comLocalizacao, semLocalizacao };
  }, [motoristas, motoristasComLocalizacao]);

  return (
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      height: 'calc(100vh - 60px)', 
      backgroundColor: '#000',
      borderRadius: '0px',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 20,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        borderRadius: '16px',
        padding: '12px 20px',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#FFF' }}>
            🗺️ Visão em Mapa
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#AAA' }}>
            Localização em tempo real dos veículos
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ 
            backgroundColor: 'rgba(30,30,40,0.9)', 
            borderRadius: '12px', 
            padding: '6px 12px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#22C55E' }}>{stats.comLocalizacao}</span>
            <span style={{ fontSize: '10px', color: '#AAA', marginLeft: '6px' }}>veículos online</span>
          </div>
          <div style={{ 
            backgroundColor: 'rgba(30,30,40,0.9)', 
            borderRadius: '12px', 
            padding: '6px 12px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#EF4444' }}>{stats.semLocalizacao}</span>
            <span style={{ fontSize: '10px', color: '#AAA', marginLeft: '6px' }}>offline</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setFiltrosAbertos(!filtrosAbertos)}
            style={{
              backgroundColor: filtrosAbertos ? '#FFD70020' : 'rgba(30,30,40,0.9)',
              border: `1px solid ${filtrosAbertos ? '#FFD700' : '#444'}`,
              borderRadius: '12px',
              padding: '8px 16px',
              color: filtrosAbertos ? '#FFD700' : '#FFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <Filter size={16} /> Filtros
          </button>
          
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
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
                fontWeight: 600
              }}
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} /> 
              {loading ? 'Atualizando...' : 'Atualizar'}
            </button>
          )}
        </div>
      </div>

      <button
        onClick={() => setLegendaAberta(!legendaAberta)}
        style={{
          position: 'absolute',
          bottom: 20,
          right: legendaAberta ? 210 : 20,
          zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.85)',
          border: '1px solid #444',
          borderRadius: '12px',
          padding: '8px 12px',
          color: '#FFF',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          backdropFilter: 'blur(10px)'
        }}
      >
        {legendaAberta ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        Legenda
      </button>

      {legendaAberta && <LegendaMapa onClose={() => setLegendaAberta(false)} />}

      {filtrosAbertos && (
        <FiltrosMapa
          filtros={filtros}
          setFiltros={setFiltros}
          onClose={() => setFiltrosAbertos(false)}
        />
      )}

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
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <RefreshCw size={40} color="#FFD700" className="spin" />
          <span style={{ color: '#FFF' }}>Carregando dados do mapa...</span>
        </div>
      )}

      {/* Mapa */}
      <MapContainer
        center={centroMapa}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={true}
        ref={mapRef as any}
      >
        <MapController center={centroMapa} zoom={13} />
        
        {/* Camada de Satélite */}
        <TileLayer
          attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
          url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
          maxZoom={20}
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
        />
        
        {/* Camada de Rótulos */}
        <TileLayer
          attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
          url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          maxZoom={20}
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
        />
        
        {/* Marcadores dos motoristas */}
        {motoristasComLocalizacao.map((motorista) => {
          const statusKey = motorista.status || 'sem_carga';
          
          return (
            <Marker
              key={motorista.id}
              position={[motorista.coordenadas!.lat, motorista.coordenadas!.lng]}
              icon={createTruckIcon(statusKey)}
            >
              <Tooltip direction="top" offset={[0, -20]} permanent={false}>
                <div style={{ 
                  backgroundColor: STATUS_CONFIG[statusKey]?.cor || '#6B7280', 
                  color: '#000', 
                  padding: '4px 10px', 
                  borderRadius: '20px',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  whiteSpace: 'nowrap'
                }}>
                  🚚 {motorista.nome} {motorista.placa && `- ${motorista.placa}`}
                </div>
              </Tooltip>
              
              <Popup>
                <PopupContent motorista={motorista} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <style>{`
        .leaflet-container {
          background-color: #1A1A1A;
        }
        .leaflet-popup-content-wrapper {
          background-color: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 16px !important;
          overflow: hidden;
        }
        .leaflet-popup-tip {
          background-color: #0A0A0A !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          min-width: 340px !important;
        }
        .leaflet-control-attribution {
          background-color: rgba(0,0,0,0.7);
          color: #888;
          font-size: 9px;
        }
        .leaflet-control-attribution a {
          color: #FFD700;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        .custom-truck-icon {
          background: transparent;
          border: none;
        }
        .custom-truck-icon img {
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
          transition: transform 0.2s ease;
        }
        .custom-truck-icon img:hover {
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
};

export default VisaoMapa;