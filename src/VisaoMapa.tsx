// VisaoMapa.tsx - VERSÃO COMPLETA CORRIGIDA
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, useMapEvents, Circle, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Truck, MapPin, Filter, X, RefreshCw, Calendar, Clock, Package, MapPinned, Weight,
  AlertCircle, FileText, Maximize2, Minimize2, ChevronDown, ChevronUp, Users, Briefcase,
  ArrowLeft, Eye, Building2, Plus, Save, Trash2, Edit, City, Target, List, UserPlus,
  Volume2, Bell, History, Zap, Radio, Fuel, Scale, AlertTriangle, Home, MapPinCheck,
  Layers, ZoomIn, ZoomOut, Navigation, Crosshair, Menu, Settings, Star, Award, FilterX
} from 'lucide-react';

// ============================================
// INTERFACES EXPANDIDAS
// ============================================

type TipoLocal = 'cliente_homologado' | 'cliente_potencial' | 'ponto_apoio' | 'abastecimento' | 'filial' | 'matriz' | 'balanca' | 'pedagio';

interface Cerca {
  id: string;
  tipo: 'circulo' | 'poligono';
  raio?: number;
  pontos?: Array<{ lat: number; lng: number }>;
}

interface LocalComGeofence {
  id: string;
  nome: string;
  tipo: TipoLocal;
  cidade: string;
  uf: string;
  observacao: string;
  coordenadas: { lat: number; lng: number };
  cerca: Cerca;
  createdAt: string;
  alertaSom?: boolean;
  alertaVisual?: boolean;
}

interface RegistroPermanencia {
  id: string;
  localId: string;
  motoristaId: string;
  dataEntrada: string;
  dataSaida?: string;
  tempoTotalMinutos?: number;
  ativo: boolean;
}

interface HistoricoVisita {
  id: string;
  localId: string;
  motoristaId: string;
  dataEntrada: string;
  dataSaida: string;
  tempoTotalMinutos: number;
}

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
    dt?: string;
    cliente?: string;
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
  onBack?: () => void;
  loading?: boolean;
}

// ============================================
// CONFIGURAÇÕES E CONSTANTES
// ============================================

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const STATUS_CONFIG: Record<string, { cor: string; corBg: string; label: string }> = {
  'programada': { cor: '#FFD700', corBg: '#FFD70020', label: 'Programado' },
  'aguardando_carregamento': { cor: '#FF9500', corBg: '#FF950020', label: 'Aguardando Carregamento' },
  'seguindo_para_entrega': { cor: '#22C55E', corBg: '#22C55E20', label: 'Seguindo para Entrega' },
  'chegou_entrega': { cor: '#3B82F6', corBg: '#3B82F620', label: 'Chegou na Entrega' },
  'sem_carga': { cor: '#6B7280', corBg: '#6B728020', label: 'Sem Carga' },
  'offline': { cor: '#EF4444', corBg: '#EF444420', label: 'Offline' },
};

const TIPOS_LOCAL_CONFIG: Record<TipoLocal, { cor: string; icon: string; label: string; descricao: string }> = {
  'cliente_homologado': { cor: '#3B82F6', icon: '✅', label: 'Cliente Homologado', descricao: 'Cliente verificado e aprovado' },
  'cliente_potencial': { cor: '#8B5CF6', icon: '🎯', label: 'Cliente Potencial', descricao: 'Possível novo cliente' },
  'ponto_apoio': { cor: '#EC4899', icon: '🏪', label: 'Ponto de Apoio', descricao: 'Local de suporte operacional' },
  'abastecimento': { cor: '#F59E0B', icon: '⛽', label: 'Abastecimento', descricao: 'Posto de combustível' },
  'filial': { cor: '#10B981', icon: '🏢', label: 'Filial', descricao: 'Filial da empresa' },
  'matriz': { cor: '#DC2626', icon: '🏛️', label: 'Matriz', descricao: 'Sede principal' },
  'balanca': { cor: '#6366F1', icon: '⚖️', label: 'Balança', descricao: 'Ponto de pesagem' },
  'pedagio': { cor: '#14B8A6', icon: '🛣️', label: 'Pedágio', descricao: 'Praça de pedágio' },
};

const extrairDataPura = (dataComHora?: string): string => {
  if (!dataComHora) return '';
  return dataComHora.split(' ')[0] || dataComHora;
};

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

const calcularDistancia = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const pontoEmPoligono = (lat: number, lng: number, pontos: Array<{ lat: number; lng: number }>): boolean => {
  let dentro = false;
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const xi = pontos[i].lng, yi = pontos[i].lat;
    const xj = pontos[j].lng, yj = pontos[j].lat;
    const intersect = ((yi > lng) !== (yj > lng)) && (lng < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) dentro = !dentro;
  }
  return dentro;
};

const motoristaEmGeofence = (motorista: MotoristaComLocalizacao, local: LocalComGeofence): boolean => {
  if (!motorista.coordenadas) return false;
  
  if (local.cerca.tipo === 'circulo' && local.cerca.raio) {
    const distancia = calcularDistancia(
      motorista.coordenadas.lat,
      motorista.coordenadas.lng,
      local.coordenadas.lat,
      local.coordenadas.lng
    );
    return distancia <= local.cerca.raio;
  } else if (local.cerca.tipo === 'poligono' && local.cerca.pontos) {
    return pontoEmPoligono(motorista.coordenadas.lat, motorista.coordenadas.lng, local.cerca.pontos);
  }
  return false;
};

const reproduzirSomAlerta = (tipo: 'entrada' | 'saida' = 'entrada') => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (tipo === 'entrada') {
      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } else {
      oscillator.frequency.value = 400;
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    }
  } catch (e) {
    console.error('Erro ao reproduzir som:', e);
  }
};

const formatarTempo = (minutos: number): string => {
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  if (horas > 0) {
    return `${horas}h ${mins}m`;
  }
  return `${mins}m`;
};

// ============================================
// COMPONENTES DE NAVEGAÇÃO
// ============================================

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
          transition: 'all 0.2s',
          backdropFilter: 'blur(10px)'
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
          transition: 'all 0.2s',
          backdropFilter: 'blur(10px)'
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
        transition: 'all 0.2s',
        backdropFilter: 'blur(10px)'
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
        {expanded ? <ChevronUp size={16} color="#AAA" /> : <ChevronDown size={16} color="#AAA" />}
      </div>
      
      {expanded && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: '#666' }}>Online</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#22C55E' }}>{stats.comLocalizacao}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#666' }}>Offline</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#EF4444' }}>{stats.semLocalizacao}</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#666' }}>Filtrados</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#FFD700' }}>{stats.filtrados}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const QuickNavMenu: React.FC<{
  locais: LocalComGeofence[];
  onNavigateTo: (lat: number, lng: number) => void;
}> = ({ locais, onNavigateTo }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredLocais = useMemo(() => {
    if (!searchTerm) return locais.slice(0, 5);
    return locais.filter(l => 
      l.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.cidade.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [locais, searchTerm]);
  
  return (
    <div style={{
      position: 'absolute',
      top: 90,
      right: 20,
      zIndex: 1000
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: isOpen ? '#3B82F6' : '#1A1A1A',
          border: isOpen ? '1px solid #3B82F6' : '1px solid #333',
          color: '#FFF',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          backdropFilter: 'blur(10px)'
        }}
      >
        <Navigation size={20} />
      </button>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 52,
          right: 0,
          width: 280,
          backgroundColor: '#0A0A0A',
          borderRadius: 12,
          border: '1px solid #333',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}>
          <div style={{ padding: 12 }}>
            <input
              type="text"
              placeholder="Buscar local..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 8,
                border: '1px solid #333',
                backgroundColor: '#1A1A1A',
                color: '#FFF',
                fontSize: 12
              }}
              autoFocus
            />
          </div>
          
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {filteredLocais.map(local => {
              const config = TIPOS_LOCAL_CONFIG[local.tipo];
              return (
                <button
                  key={local.id}
                  onClick={() => {
                    onNavigateTo(local.coordenadas.lat, local.coordenadas.lng);
                    setIsOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid #1A1A1A',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1A1A1A';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span style={{ fontSize: 16 }}>{config.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#FFF' }}>{local.nome}</div>
                    <div style={{ fontSize: 10, color: '#666' }}>{local.cidade}, {local.uf}</div>
                  </div>
                  <Target size={14} color={config.cor} />
                </button>
              );
            })}
            
            {filteredLocais.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: '#666', fontSize: 12 }}>
                Nenhum local encontrado
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Painel de filtros de MOTORISTAS
const FilterPanel: React.FC<{
  filtros: any;
  onFilterChange: (filtros: any) => void;
  onClose: () => void;
  motoristas: MotoristaComLocalizacao[];
}> = ({ filtros, onFilterChange, onClose, motoristas }) => {
  const [localFiltros, setLocalFiltros] = useState(filtros);
  
  const clientesUnicos = useMemo(() => {
    const clientes = motoristas
      .map(m => m.cargaAtual?.cliente)
      .filter((c, i, arr) => c && arr.indexOf(c) === i);
    return clientes;
  }, [motoristas]);
  
  const handleApply = () => {
    onFilterChange(localFiltros);
    onClose();
  };
  
  const handleReset = () => {
    const resetFiltros = {
      status: 'todos',
      nome: '',
      placa: '',
      cliente: '',
      dataColeta: '',
      dataEntrega: ''
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
      width: 320,
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
          <Filter size={18} /> Filtros Motoristas
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>
      
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#AAA', fontSize: 12 }}>Status</label>
          <select
            value={localFiltros.status}
            onChange={(e) => setLocalFiltros({ ...localFiltros, status: e.target.value })}
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
            <option value="todos">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#AAA', fontSize: 12 }}>Nome do Motorista</label>
          <input
            type="text"
            value={localFiltros.nome}
            onChange={(e) => setLocalFiltros({ ...localFiltros, nome: e.target.value })}
            placeholder="Digite o nome..."
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
          <label style={{ display: 'block', marginBottom: 6, color: '#AAA', fontSize: 12 }}>Cliente da Carga</label>
          <select
            value={localFiltros.cliente}
            onChange={(e) => setLocalFiltros({ ...localFiltros, cliente: e.target.value })}
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
            <option value="">Todos os clientes</option>
            {clientesUnicos.map(cliente => (
              <option key={cliente} value={cliente}>{cliente}</option>
            ))}
          </select>
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
            Aplicar Filtros
          </button>
        </div>
      </div>
    </div>
  );
};

// Painel de filtros de LOCAIS
const FilterLocaisPanel: React.FC<{
  filtros: any;
  onFilterChange: (filtros: any) => void;
  onClose: () => void;
  totalLocais: number;
  filteredCount: number;
  locais: LocalComGeofence[];
  motoristas: MotoristaComLocalizacao[];
}> = ({ filtros, onFilterChange, onClose, totalLocais, filteredCount, locais, motoristas }) => {
  const [localFiltros, setLocalFiltros] = useState(filtros);
  
  const handleToggleTipo = (tipo: TipoLocal) => {
    const tiposAtuais = localFiltros.tipos;
    const novosTipos = tiposAtuais.includes(tipo)
      ? tiposAtuais.filter(t => t !== tipo)
      : [...tiposAtuais, tipo];
    setLocalFiltros({ ...localFiltros, tipos: novosTipos });
  };
  
  const handleSelectAll = () => {
    if (localFiltros.tipos.length === Object.keys(TIPOS_LOCAL_CONFIG).length) {
      setLocalFiltros({ ...localFiltros, tipos: [] });
    } else {
      setLocalFiltros({ 
        ...localFiltros, 
        tipos: Object.keys(TIPOS_LOCAL_CONFIG) as TipoLocal[]
      });
    }
  };
  
  const handleApply = () => {
    onFilterChange(localFiltros);
    onClose();
  };
  
  const handleReset = () => {
    const resetFiltros = {
      tipos: [],
      busca: '',
      apenasComMotoristas: false
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
      width: 380,
      backgroundColor: '#0A0A0A',
      borderRadius: 16,
      border: '1px solid #333',
      zIndex: 1000,
      maxHeight: 'calc(100vh - 120px)',
      overflowY: 'auto',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #222',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #EC489920, transparent)'
      }}>
        <h3 style={{ margin: 0, color: '#FFF', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={18} /> Filtros de Locais
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>
      
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Busca por nome */}
        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#AAA', fontSize: 12 }}>Buscar por nome</label>
          <input
            type="text"
            value={localFiltros.busca}
            onChange={(e) => setLocalFiltros({ ...localFiltros, busca: e.target.value })}
            placeholder="Digite o nome do local..."
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
        
        {/* Filtro por tipo */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <label style={{ color: '#AAA', fontSize: 12 }}>Tipos de Local</label>
            <button
              onClick={handleSelectAll}
              style={{
                fontSize: 11,
                color: '#3B82F6',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {localFiltros.tipos.length === Object.keys(TIPOS_LOCAL_CONFIG).length ? 'Desmarcar Todos' : 'Marcar Todos'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {Object.entries(TIPOS_LOCAL_CONFIG).map(([key, config]) => (
              <label
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  backgroundColor: localFiltros.tipos.includes(key as TipoLocal) ? `${config.cor}20` : '#111',
                  border: `1px solid ${localFiltros.tipos.includes(key as TipoLocal) ? config.cor : '#333'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <input
                  type="checkbox"
                  checked={localFiltros.tipos.includes(key as TipoLocal)}
                  onChange={() => handleToggleTipo(key as TipoLocal)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14 }}>{config.icon}</span>
                <span style={{ fontSize: 11, color: '#FFF' }}>{config.label}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Filtro adicional */}
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
              checked={localFiltros.apenasComMotoristas}
              onChange={(e) => setLocalFiltros({ ...localFiltros, apenasComMotoristas: e.target.checked })}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: '#FFF' }}>
              Mostrar apenas locais com motoristas dentro
            </span>
          </label>
        </div>
        
        {/* Status dos filtros */}
        <div style={{
          padding: '10px',
          borderRadius: 8,
          backgroundColor: '#111',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: 12, color: '#AAA' }}>
            📍 Mostrando <strong style={{ color: '#FFD700' }}>{filteredCount}</strong> de <strong>{totalLocais}</strong> locais
          </span>
        </div>
        
        {/* Botões */}
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
            <FilterX size={14} style={{ display: 'inline', marginRight: 4 }} />
            Limpar Filtros
          </button>
          <button
            onClick={handleApply}
            style={{
              padding: 10,
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#EC4899',
              color: '#FFF',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            <Filter size={14} style={{ display: 'inline', marginRight: 4 }} />
            Aplicar Filtros
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// ÍCONES PERSONALIZADOS
// ============================================

const createTruckIconWithLabel = (status: string, nome: string, placa: string) => {
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
  
  const htmlContent = `
    <div style="position: relative; display: inline-block;">
      <img src="${canvas.toDataURL()}" style="width: 44px; height: 44px; display: block;" />
      <div style="
        position: absolute;
        top: -32px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        border: 1px solid ${corPrincipal};
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        pointer-events: none;
        z-index: 10;
        font-family: 'Segoe UI', sans-serif;
      ">
        🚛 ${nome} ${placa ? `• ${placa}` : ''}
      </div>
    </div>
  `;
  
  return L.divIcon({
    html: htmlContent,
    className: 'custom-truck-icon-with-label',
    iconSize: [44, 64],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44]
  });
};

const createLocalIcon = (tipo: TipoLocal) => {
  const config = TIPOS_LOCAL_CONFIG[tipo];
  return L.divIcon({
    html: `<div style="
      background: linear-gradient(135deg, ${config.cor}, ${config.cor}dd);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 0 2px ${config.cor}40;
      cursor: pointer;
      font-size: 22px;
      transition: transform 0.2s;
    ">
      ${config.icon}
    </div>`,
    className: 'local-marker-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });
};

// ============================================
// COMPONENTES AUXILIARES
// ============================================

function MapController({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (center && center[0] !== 0 && center[1] !== 0) {
      map.setView(center, zoom || 12);
    }
  }, [center, zoom, map]);
  
  return null;
}

function MapaClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ============================================
// COMPONENTE: CADASTRO DE LOCAL COM GEOFENCE
// ============================================

interface CadastroLocalPanelProps {
  local?: LocalComGeofence | null;
  onSalvar: (local: LocalComGeofence) => void;
  onCancelar: () => void;
}

const CadastroLocalPanel: React.FC<CadastroLocalPanelProps> = ({ local, onSalvar, onCancelar }) => {
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'cliente_homologado' as TipoLocal,
    cidade: '',
    uf: '',
    observacao: '',
    alertaSom: true,
    alertaVisual: true,
  });
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const [cercaTipo, setCercaTipo] = useState<'circulo' | 'poligono'>('circulo');
  const [raio, setRaio] = useState(500);
  const [pontosCerca, setPontosCerca] = useState<Array<{ lat: number; lng: number }>>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [adicionandoPontos, setAdicionandoPontos] = useState(false);

  useEffect(() => {
    if (local) {
      setFormData({
        nome: local.nome,
        tipo: local.tipo,
        cidade: local.cidade,
        uf: local.uf,
        observacao: local.observacao,
        alertaSom: local.alertaSom ?? true,
        alertaVisual: local.alertaVisual ?? true,
      });
      setCoordenadas(local.coordenadas);
      setCercaTipo(local.cerca.tipo);
      if (local.cerca.tipo === 'circulo' && local.cerca.raio) {
        setRaio(local.cerca.raio);
      } else if (local.cerca.tipo === 'poligono' && local.cerca.pontos) {
        setPontosCerca(local.cerca.pontos);
      }
    }
  }, [local]);

  const buscarLocalizacao = async () => {
    if (!formData.cidade || !formData.uf) {
      setErro('Preencha a cidade e UF para buscar');
      return;
    }

    setBuscando(true);
    setErro(null);

    const query = `${formData.cidade}, ${formData.uf}, Brasil`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data && data.length > 0) {
        setCoordenadas({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      } else {
        setErro('Localização não encontrada');
      }
    } catch {
      setErro('Erro ao buscar localização');
    } finally {
      setBuscando(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) { setErro('Nome é obrigatório'); return; }
    if (!formData.cidade.trim()) { setErro('Cidade é obrigatória'); return; }
    if (!formData.uf.trim()) { setErro('UF é obrigatória'); return; }
    if (!coordenadas) { setErro('Selecione a localização no mapa'); return; }
    if (cercaTipo === 'poligono' && pontosCerca.length < 3) { setErro('Polígono precisa de pelo menos 3 pontos'); return; }

    const cerca: Cerca = cercaTipo === 'circulo'
      ? { id: Date.now().toString(), tipo: 'circulo', raio }
      : { id: Date.now().toString(), tipo: 'poligono', pontos: pontosCerca };

    onSalvar({
      id: local?.id || Date.now().toString(),
      nome: formData.nome.trim(),
      tipo: formData.tipo,
      cidade: formData.cidade.trim(),
      uf: formData.uf.trim().toUpperCase(),
      observacao: formData.observacao,
      coordenadas,
      cerca,
      createdAt: local?.createdAt || new Date().toISOString(),
      alertaSom: formData.alertaSom,
      alertaVisual: formData.alertaVisual,
    });
  };

  const config = TIPOS_LOCAL_CONFIG[formData.tipo];

  return (
    <div style={{
      position: 'absolute',
      right: 20,
      top: 90,
      width: '420px',
      backgroundColor: '#0A0A0A',
      borderRadius: '16px',
      border: '1px solid #333',
      zIndex: 1000,
      maxHeight: 'calc(100vh - 120px)',
      overflowY: 'auto',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #222',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: `linear-gradient(135deg, ${config.cor}20, transparent)`
      }}>
        <h3 style={{ margin: 0, color: '#FFF', fontSize: '16px' }}>
          {config.icon} {local ? 'Editar' : 'Novo'} {config.label}
        </h3>
        <button onClick={onCancelar} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', color: '#AAA', fontSize: '12px' }}>Tipo de Local *</label>
          <select
            value={formData.tipo}
            onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoLocal })}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1A1A1A', color: '#FFF' }}
          >
            {Object.entries(TIPOS_LOCAL_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.icon} {val.label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', color: '#AAA', fontSize: '12px' }}>Nome do Local *</label>
          <input
            type="text"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1A1A1A', color: '#FFF' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#AAA', fontSize: '12px' }}>Cidade *</label>
            <input
              type="text"
              value={formData.cidade}
              onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1A1A1A', color: '#FFF' }}
            />
          </div>
          <div style={{ width: '70px' }}>
            <label style={{ display: 'block', marginBottom: '6px', color: '#AAA', fontSize: '12px' }}>UF *</label>
            <input
              type="text"
              value={formData.uf}
              onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase().slice(0, 2) })}
              maxLength={2}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1A1A1A', color: '#FFF', textAlign: 'center' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', color: '#AAA', fontSize: '12px' }}>Observação</label>
          <textarea
            value={formData.observacao}
            onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
            rows={2}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1A1A1A', color: '#FFF', resize: 'vertical' }}
          />
        </div>

        <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#111', borderRadius: '8px', border: '1px solid #222' }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFF', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.alertaSom}
                onChange={(e) => setFormData({ ...formData, alertaSom: e.target.checked })}
                style={{ cursor: 'pointer' }}
              />
              <Volume2 size={14} /> Alerta Sonoro
            </label>
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFF', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.alertaVisual}
                onChange={(e) => setFormData({ ...formData, alertaVisual: e.target.checked })}
                style={{ cursor: 'pointer' }}
              />
              <Bell size={14} /> Alerta Visual
            </label>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', color: '#AAA', fontSize: '12px' }}>Tipo de Cerca *</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setCercaTipo('circulo')}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: cercaTipo === 'circulo' ? `2px solid ${config.cor}` : '1px solid #333',
                backgroundColor: cercaTipo === 'circulo' ? `${config.cor}20` : '#1A1A1A',
                color: cercaTipo === 'circulo' ? config.cor : '#AAA',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              ⭕ Circular
            </button>
            <button
              type="button"
              onClick={() => setCercaTipo('poligono')}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: cercaTipo === 'poligono' ? `2px solid ${config.cor}` : '1px solid #333',
                backgroundColor: cercaTipo === 'poligono' ? `${config.cor}20` : '#1A1A1A',
                color: cercaTipo === 'poligono' ? config.cor : '#AAA',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              🔷 Polígono
            </button>
          </div>
        </div>

        {cercaTipo === 'circulo' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', color: '#AAA', fontSize: '12px' }}>
              Raio da Cerca: {raio}m
            </label>
            <input
              type="range"
              min="50"
              max="5000"
              step="50"
              value={raio}
              onChange={(e) => setRaio(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ color: '#AAA', fontSize: '12px' }}>📍 Localização (clique no mapa)</label>
            <button
              type="button"
              onClick={buscarLocalizacao}
              disabled={buscando}
              style={{ padding: '4px 12px', fontSize: '11px', borderRadius: '6px', border: `1px solid ${config.cor}`, background: 'transparent', color: config.cor, cursor: 'pointer' }}
            >
              <Target size={12} style={{ display: 'inline', marginRight: '4px' }} />
              {buscando ? 'Buscando...' : 'Buscar cidade'}
            </button>
          </div>
          <div style={{ height: '250px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333' }}>
            <MapContainer
              center={coordenadas ? [coordenadas.lat, coordenadas.lng] : [-15.7797, -47.9297]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" />
              <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
              <MapaClickHandler onMapClick={(lat, lng) => {
                if (cercaTipo === 'poligono' && adicionandoPontos) {
                  setPontosCerca([...pontosCerca, { lat, lng }]);
                } else {
                  setCoordenadas({ lat, lng });
                }
              }} />
              {coordenadas && (
                <Marker position={[coordenadas.lat, coordenadas.lng]} icon={createLocalIcon(formData.tipo)}>
                  <Popup>📍 Centro do local</Popup>
                </Marker>
              )}
              {cercaTipo === 'circulo' && coordenadas && (
                <Circle
                  center={[coordenadas.lat, coordenadas.lng]}
                  radius={raio}
                  pathOptions={{ color: config.cor, fillColor: config.cor, fillOpacity: 0.1 }}
                />
              )}
              {cercaTipo === 'poligono' && pontosCerca.length > 0 && (
                <>
                  {pontosCerca.map((ponto, idx) => (
                    <Marker key={idx} position={[ponto.lat, ponto.lng]}>
                      <Popup>Ponto {idx + 1}</Popup>
                    </Marker>
                  ))}
                  {pontosCerca.length >= 2 && (
                    <Polygon
                      positions={pontosCerca.map(p => [p.lat, p.lng])}
                      pathOptions={{ color: config.cor, fillColor: config.cor, fillOpacity: 0.1 }}
                    />
                  )}
                </>
              )}
            </MapContainer>
          </div>
          {cercaTipo === 'poligono' && (
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setAdicionandoPontos(!adicionandoPontos)}
                style={{
                  flex: 1,
                  padding: '8px',
                  fontSize: '11px',
                  borderRadius: '6px',
                  border: `1px solid ${config.cor}`,
                  background: adicionandoPontos ? `${config.cor}20` : 'transparent',
                  color: config.cor,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                {adicionandoPontos ? '✓ Adicionando pontos...' : '+ Adicionar pontos'}
              </button>
              {pontosCerca.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPontosCerca(pontosCerca.slice(0, -1))}
                  style={{
                    padding: '8px 12px',
                    fontSize: '11px',
                    borderRadius: '6px',
                    border: '1px solid #EF4444',
                    background: 'transparent',
                    color: '#EF4444',
                    cursor: 'pointer'
                  }}
                >
                  Desfazer ({pontosCerca.length})
                </button>
              )}
            </div>
          )}
        </div>

        {erro && (
          <div style={{ padding: '10px', backgroundColor: '#EF444420', borderRadius: '8px', border: '1px solid #EF4444', marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#FFF' }}>⚠️ {erro}</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            type="button"
            onClick={onCancelar}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1A1A1A', color: '#FFF', cursor: 'pointer', fontWeight: 600 }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            style={{ padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: config.cor, color: '#000', cursor: 'pointer', fontWeight: 600 }}
          >
            <Save size={14} style={{ display: 'inline', marginRight: '4px' }} />
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
};

// ============================================
// COMPONENTE: LISTA DE LOCAIS
// ============================================

interface ListaLocaisPanelProps {
  locais: LocalComGeofence[];
  onEditar: (local: LocalComGeofence) => void;
  onExcluir: (id: string) => void;
  onClose: () => void;
}

const ListaLocaisPanel: React.FC<ListaLocaisPanelProps> = ({ locais, onEditar, onExcluir, onClose }) => {
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoLocal | 'todos'>('todos');

  const locaisFiltrados = useMemo(() => {
    return locais.filter(local => {
      if (filtroTipo !== 'todos' && local.tipo !== filtroTipo) return false;
      if (busca && !local.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [locais, busca, filtroTipo]);

  return (
    <div style={{
      position: 'absolute',
      right: 20,
      top: 90,
      width: '380px',
      backgroundColor: '#0A0A0A',
      borderRadius: '16px',
      border: '1px solid #333',
      zIndex: 1000,
      maxHeight: 'calc(100vh - 120px)',
      overflowY: 'auto',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #222',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, color: '#FFF', fontSize: '16px' }}>
          📍 Locais Cadastrados ({locais.length})
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ padding: '16px 20px' }}>
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Buscar local..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1A1A1A', color: '#FFF' }}
          />
          <MapPin size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
        </div>

        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as any)}
          style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1A1A1A', color: '#FFF', marginBottom: '16px', fontSize: '12px' }}
        >
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPOS_LOCAL_CONFIG).map(([key, val]) => (
            <option key={key} value={key}>{val.icon} {val.label}</option>
          ))}
        </select>

        {locaisFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
            <MapPin size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p>Nenhum local cadastrado</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {locaisFiltrados.map(local => {
              const config = TIPOS_LOCAL_CONFIG[local.tipo];
              return (
                <div key={local.id} style={{ padding: '12px', backgroundColor: '#111', borderRadius: '10px', border: `1px solid ${config.cor}40` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '16px' }}>{config.icon}</span>
                        <span style={{ fontWeight: 600, color: '#FFF', fontSize: '13px' }}>{local.nome}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#AAA', marginBottom: '4px' }}>
                        🏷️ {config.label}
                      </div>
                      <div style={{ fontSize: '11px', color: '#AAA', marginBottom: '4px' }}>
                        📍 {local.cidade}, {local.uf}
                      </div>
                      {local.cerca.tipo === 'circulo' && (
                        <div style={{ fontSize: '10px', color: '#888' }}>
                          ⭕ Raio: {local.cerca.raio}m
                        </div>
                      )}
                      {local.cerca.tipo === 'poligono' && (
                        <div style={{ fontSize: '10px', color: '#888' }}>
                          🔷 Polígono: {local.cerca.pontos?.length} pontos
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => onEditar(local)} style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${config.cor}`, background: 'transparent', color: config.cor, cursor: 'pointer', fontSize: '11px' }}>
                        <Edit size={12} />
                      </button>
                      <button onClick={() => onExcluir(local.id)} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #EF4444', background: 'transparent', color: '#EF4444', cursor: 'pointer', fontSize: '11px' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// COMPONENTE: HISTÓRICO DE PERMANÊNCIA
// ============================================

interface HistoricoPermanenciaProps {
  historico: HistoricoVisita[];
  locais: LocalComGeofence[];
  motoristas: MotoristaComLocalizacao[];
  onClose: () => void;
}

const HistoricoPermanenciaPanel: React.FC<HistoricoPermanenciaProps> = ({ historico, locais, motoristas, onClose }) => {
  const [filtroLocal, setFiltroLocal] = useState<string>('todos');

  const historicoFiltrado = useMemo(() => {
    return historico.filter(h => filtroLocal === 'todos' || h.localId === filtroLocal);
  }, [historico, filtroLocal]);

  return (
    <div style={{
      position: 'absolute',
      left: 20,
      top: 90,
      width: '400px',
      backgroundColor: '#0A0A0A',
      borderRadius: '16px',
      border: '1px solid #333',
      zIndex: 1000,
      maxHeight: 'calc(100vh - 120px)',
      overflowY: 'auto',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #222',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, color: '#FFF', fontSize: '16px' }}>
          ⏱️ Histórico de Permanência
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ padding: '16px 20px' }}>
        <select
          value={filtroLocal}
          onChange={(e) => setFiltroLocal(e.target.value)}
          style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1A1A1A', color: '#FFF', marginBottom: '16px', fontSize: '12px' }}
        >
          <option value="todos">Todos os locais</option>
          {locais.map(local => (
            <option key={local.id} value={local.id}>{local.nome}</option>
          ))}
        </select>

        {historicoFiltrado.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
            <History size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p>Nenhum registro de permanência</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {historicoFiltrado.map(registro => {
              const local = locais.find(l => l.id === registro.localId);
              const motorista = motoristas.find(m => m.id === registro.motoristaId);
              const config = local ? TIPOS_LOCAL_CONFIG[local.tipo] : null;
              
              return (
                <div key={registro.id} style={{ padding: '12px', backgroundColor: '#111', borderRadius: '10px', border: `1px solid ${config?.cor}40` }}>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px' }}>{config?.icon}</span>
                      <span style={{ fontWeight: 600, color: config?.cor, fontSize: '12px' }}>{local?.nome}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#AAA' }}>
                      👤 {motorista?.nome || 'Motorista desconhecido'}
                    </div>
                  </div>
                  <div style={{ fontSize: '10px', color: '#888', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      📥 {new Date(registro.dataEntrada).toLocaleString('pt-BR')}
                    </div>
                    <div>
                      📤 {new Date(registro.dataSaida).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#1A1A1A', borderRadius: '6px', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: config?.cor }}>
                      ⏱️ {formatarTempo(registro.tempoTotalMinutos)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// COMPONENTE PRINCIPAL: VISÃO MAPA
// ============================================

const VisaoMapa: React.FC<VisaoMapaProps> = ({ 
  motoristas, 
  onRefresh, 
  onBack,
  loading = false 
}) => {
  const [centroMapa, setCentroMapa] = useState<[number, number]>([-15.7797, -47.9297]);
  const [mapaZoom, setMapaZoom] = useState(12);
  const [showCadastroLocal, setShowCadastroLocal] = useState(false);
  const [showListaLocais, setShowListaLocais] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showFilterLocaisPanel, setShowFilterLocaisPanel] = useState(false);
  const [showLegenda, setShowLegenda] = useState(false);
  const [localEditando, setLocalEditando] = useState<LocalComGeofence | null>(null);
  const [locais, setLocais] = useState<LocalComGeofence[]>([]);
  const [historico, setHistorico] = useState<HistoricoVisita[]>([]);
  const [registrosPermanencia, setRegistrosPermanencia] = useState<RegistroPermanencia[]>([]);
  
  // Filtros para motoristas
  const [filtros, setFiltros] = useState({
    status: 'todos',
    nome: '',
    placa: '',
    cliente: '',
    dataColeta: '',
    dataEntrega: ''
  });
  
  // Filtros para locais
  const [filtrosLocais, setFiltrosLocais] = useState({
    tipos: [] as TipoLocal[],
    busca: '',
    apenasComMotoristas: false
  });
  
  const mapRef = useRef<L.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  // Carregar dados do localStorage
  useEffect(() => {
    const savedLocais = localStorage.getItem('locais_geofence');
    let locaisCarregados: LocalComGeofence[] = [];
    
    if (savedLocais) {
      try { locaisCarregados = JSON.parse(savedLocais); } catch (e) { console.error(e); }
    }

    const antigoClientes = localStorage.getItem('clientes_geofence');
    if (antigoClientes) {
      try {
        const clientesAntigos = JSON.parse(antigoClientes);
        if (Array.isArray(clientesAntigos) && clientesAntigos.length > 0) {
          const clientesMigrados: LocalComGeofence[] = clientesAntigos.map((c: any) => ({
            id: c.id || Date.now().toString() + Math.random(),
            nome: c.nome,
            tipo: 'cliente_homologado',
            cidade: c.cidade,
            uf: c.uf,
            observacao: c.observacao || '',
            coordenadas: c.coordenadas,
            cerca: {
              id: Date.now().toString() + Math.random(),
              tipo: 'circulo',
              raio: 500
            },
            createdAt: c.createdAt || new Date().toISOString(),
            alertaSom: true,
            alertaVisual: true
          }));

          const idsExistentes = new Set(locaisCarregados.map(l => l.id));
          const novosMigrados = clientesMigrados.filter(c => !idsExistentes.has(c.id));
          
          if (novosMigrados.length > 0) {
            locaisCarregados = [...locaisCarregados, ...novosMigrados];
            localStorage.setItem('locais_geofence', JSON.stringify(locaisCarregados));
          }
        }
      } catch (e) {
        console.error('Erro na migração de dados:', e);
      }
    }

    setLocais(locaisCarregados);

    const savedHistorico = localStorage.getItem('historico_permanencia');
    if (savedHistorico) {
      try { setHistorico(JSON.parse(savedHistorico)); } catch (e) { console.error(e); }
    }
  }, []);

  const salvarLocais = (novosLocais: LocalComGeofence[]) => {
    setLocais(novosLocais);
    localStorage.setItem('locais_geofence', JSON.stringify(novosLocais));
  };

  const handleSalvarLocal = (local: LocalComGeofence) => {
    const index = locais.findIndex(l => l.id === local.id);
    const novosLocais = index !== -1 
      ? [...locais.slice(0, index), local, ...locais.slice(index + 1)]
      : [...locais, local];
    salvarLocais(novosLocais);
    setShowCadastroLocal(false);
    setLocalEditando(null);
  };

  const handleExcluirLocal = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este local?')) {
      salvarLocais(locais.filter(l => l.id !== id));
    }
  };

  const handleNavigateTo = (lat: number, lng: number) => {
    if (mapInstance) {
      mapInstance.setView([lat, lng], 15);
    }
    setCentroMapa([lat, lng]);
  };

  const handleLocateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          handleNavigateTo(latitude, longitude);
        },
        (error) => {
          console.error('Erro ao obter localização:', error);
        }
      );
    }
  };

  // Monitorar geofences
  useEffect(() => {
    const interval = setInterval(() => {
      motoristas.forEach(motorista => {
        locais.forEach(local => {
          const estaEmGeofence = motoristaEmGeofence(motorista, local);
          const registroAtivo = registrosPermanencia.find(r => 
            r.motoristaId === motorista.id && 
            r.localId === local.id && 
            r.ativo
          );

          if (estaEmGeofence && !registroAtivo) {
            const novoRegistro: RegistroPermanencia = {
              id: Date.now().toString(),
              localId: local.id,
              motoristaId: motorista.id,
              dataEntrada: new Date().toISOString(),
              ativo: true
            };
            setRegistrosPermanencia(prev => [...prev, novoRegistro]);

            if (local.alertaSom) {
              reproduzirSomAlerta('entrada');
            }
            if (local.alertaVisual) {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`${motorista.nome} chegou em ${local.nome}`, {
                  body: `Localização: ${local.cidade}, ${local.uf}`,
                  icon: '📍'
                });
              }
            }
          } else if (!estaEmGeofence && registroAtivo) {
            const tempoTotalMinutos = Math.floor(
              (new Date().getTime() - new Date(registroAtivo.dataEntrada).getTime()) / 60000
            );
            
            const novoHistorico: HistoricoVisita = {
              id: Date.now().toString(),
              localId: local.id,
              motoristaId: motorista.id,
              dataEntrada: registroAtivo.dataEntrada,
              dataSaida: new Date().toISOString(),
              tempoTotalMinutos
            };
            
            setHistorico(prev => {
              const updated = [...prev, novoHistorico];
              localStorage.setItem('historico_permanencia', JSON.stringify(updated));
              return updated;
            });

            setRegistrosPermanencia(prev =>
              prev.map(r => r.id === registroAtivo.id ? { ...r, ativo: false, dataSaida: new Date().toISOString(), tempoTotalMinutos } : r)
            );

            if (local.alertaSom) {
              reproduzirSomAlerta('saida');
            }
          }
        });
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [motoristas, locais, registrosPermanencia]);

  // Filtro de motoristas
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
      if (filtros.cliente && motorista.cargaAtual?.cliente !== filtros.cliente) {
        return false;
      }
      if (filtros.dataColeta) {
        const dataColetaPura = extrairDataPura(motorista.cargaAtual?.coletaData);
        if (dataColetaPura !== filtros.dataColeta) {
          return false;
        }
      }
      if (filtros.dataEntrega) {
        const dataEntregaPura = extrairDataPura(motorista.cargaAtual?.entregaData);
        if (dataEntregaPura !== filtros.dataEntrega) {
          return false;
        }
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

  // Filtro de locais
  const locaisFiltrados = useMemo(() => {
    let filtrados = [...locais];
    
    if (filtrosLocais.busca) {
      filtrados = filtrados.filter(local => 
        local.nome.toLowerCase().includes(filtrosLocais.busca.toLowerCase()) ||
        local.cidade.toLowerCase().includes(filtrosLocais.busca.toLowerCase())
      );
    }
    
    if (filtrosLocais.tipos.length > 0) {
      filtrados = filtrados.filter(local => filtrosLocais.tipos.includes(local.tipo));
    }
    
    if (filtrosLocais.apenasComMotoristas) {
      filtrados = filtrados.filter(local => {
        return motoristas.some(motorista => motoristaEmGeofence(motorista, local));
      });
    }
    
    return filtrados;
  }, [locais, filtrosLocais, motoristas]);

  // Centralizar mapa nos motoristas
  useEffect(() => {
    if (motoristasComLocalizacao.length > 0 && !showCadastroLocal && !showListaLocais && !showHistorico && !showFilterPanel && !showFilterLocaisPanel) {
      const somaLat = motoristasComLocalizacao.reduce((sum, m) => sum + m.coordenadas!.lat, 0);
      const somaLng = motoristasComLocalizacao.reduce((sum, m) => sum + m.coordenadas!.lng, 0);
      const centroLat = somaLat / motoristasComLocalizacao.length;
      const centroLng = somaLng / motoristasComLocalizacao.length;
      setCentroMapa([centroLat, centroLng]);
    }
  }, [motoristasComLocalizacao, showCadastroLocal, showListaLocais, showHistorico, showFilterPanel, showFilterLocaisPanel]);

  const stats = useMemo(() => {
    const total = motoristas.length;
    const comLocalizacao = motoristasComLocalizacao.length;
    const semLocalizacao = total - comLocalizacao;
    const filtrados = motoristasFiltrados.length;
    return { total, comLocalizacao, semLocalizacao, filtrados };
  }, [motoristas, motoristasComLocalizacao, motoristasFiltrados]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Legenda de ícones
  const LegendaPanel = () => (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: 100,
      zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(10px)',
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.15)',
      padding: '12px 16px',
      minWidth: 200,
      maxHeight: 400,
      overflowY: 'auto'
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#FFF', marginBottom: 8 }}>📖 Legenda</div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#AAA', marginBottom: 4 }}>🚛 Motoristas:</div>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: config.cor }} />
            <span style={{ fontSize: 10, color: '#AAA' }}>{config.label}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#AAA', marginBottom: 4 }}>📍 Locais:</div>
        {Object.entries(TIPOS_LOCAL_CONFIG).map(([key, config]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12 }}>{config.icon}</span>
            <span style={{ fontSize: 10, color: '#AAA' }}>{config.label}</span>
            <span style={{ fontSize: 9, color: '#666', marginLeft: 'auto' }}>{config.cor}</span>
          </div>
        ))}
      </div>
      {(filtrosLocais.tipos.length > 0 || filtrosLocais.busca || filtrosLocais.apenasComMotoristas) && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 10, color: '#FFD700' }}>
            🔍 Filtro ativo: {locaisFiltrados.length}/{locais.length} locais
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ 
      width: '100%', 
      height: 'calc(100vh - 60px)', 
      backgroundColor: '#000',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Header Otimizado */}
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
              🗺️ Visão em Mapa
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#AAA' }}>
              Localização em tempo real + Geofences avançados
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
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#22C55E' }}>{stats.comLocalizacao}</span>
            <span style={{ fontSize: '10px', color: '#AAA', marginLeft: '6px' }}>online</span>
          </div>

          <button
            onClick={() => { setLocalEditando(null); setShowCadastroLocal(true); }}
            style={{
              backgroundColor: '#3B82F6',
              border: 'none',
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
            <Plus size={16} /> Novo Local
          </button>

          <button
            onClick={() => setShowListaLocais(!showListaLocais)}
            style={{
              backgroundColor: 'rgba(30,30,40,0.9)',
              border: showListaLocais ? '1px solid #3B82F6' : '1px solid #444',
              borderRadius: '12px',
              padding: '8px 16px',
              color: showListaLocais ? '#3B82F6' : '#FFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <List size={16} /> Locais ({locais.length})
          </button>

          <button
            onClick={() => setShowHistorico(!showHistorico)}
            style={{
              backgroundColor: 'rgba(30,30,40,0.9)',
              border: showHistorico ? '1px solid #10B981' : '1px solid #444',
              borderRadius: '12px',
              padding: '8px 16px',
              color: showHistorico ? '#10B981' : '#FFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <History size={16} /> Histórico
          </button>

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
            <Truck size={16} /> Motoristas
          </button>

          <button
            onClick={() => setShowFilterLocaisPanel(!showFilterLocaisPanel)}
            style={{
              backgroundColor: 'rgba(30,30,40,0.9)',
              border: showFilterLocaisPanel ? '1px solid #EC4899' : '1px solid #444',
              borderRadius: '12px',
              padding: '8px 16px',
              color: showFilterLocaisPanel ? '#EC4899' : '#FFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <MapPin size={16} /> Locais
            {(filtrosLocais.tipos.length > 0 || filtrosLocais.busca || filtrosLocais.apenasComMotoristas) && (
              <span style={{
                backgroundColor: '#EC4899',
                color: '#FFF',
                fontSize: '10px',
                borderRadius: '10px',
                padding: '2px 6px',
                marginLeft: '4px'
              }}>
                {locaisFiltrados.length}/{locais.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowLegenda(!showLegenda)}
            style={{
              backgroundColor: 'rgba(30,30,40,0.9)',
              border: showLegenda ? '1px solid #8B5CF6' : '1px solid #444',
              borderRadius: '12px',
              padding: '8px 16px',
              color: showLegenda ? '#8B5CF6' : '#FFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <Eye size={16} /> Legenda
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

      {/* Quick Navigation Menu */}
      <QuickNavMenu locais={locaisFiltrados} onNavigateTo={handleNavigateTo} />

      {/* Zoom Controls */}
      <ZoomControls map={mapInstance} />

      {/* Locate Button */}
      <LocateButton onLocate={handleLocateUser} />

      {/* Legenda */}
      {showLegenda && <LegendaPanel />}

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

        {/* Marcadores de motoristas */}
        {motoristasComLocalizacao.map(motorista => (
          <Marker
            key={motorista.id}
            position={[motorista.coordenadas!.lat, motorista.coordenadas!.lng]}
            icon={createTruckIconWithLabel(motorista.status || 'sem_carga', motorista.nome, motorista.placa || '')}
          >
            <Popup>
              <div style={{ fontSize: '12px', minWidth: '200px' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px' }}>🚛 {motorista.nome}</div>
                <div>Placa: {motorista.placa || 'N/A'}</div>
                <div>Status: {STATUS_CONFIG[motorista.status || 'sem_carga']?.label}</div>
                <div>Velocidade: {motorista.velocidade || 0} km/h</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Marcadores de locais FILTRADOS e cercas */}
        {locaisFiltrados.map(local => (
          <div key={local.id}>
            <Marker
              position={[local.coordenadas.lat, local.coordenadas.lng]}
              icon={createLocalIcon(local.tipo)}
            >
              <Popup>
                <div style={{ fontSize: '12px', minWidth: '200px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                    {TIPOS_LOCAL_CONFIG[local.tipo].icon} {local.nome}
                  </div>
                  <div>Tipo: {TIPOS_LOCAL_CONFIG[local.tipo].label}</div>
                  <div>Local: {local.cidade}, {local.uf}</div>
                  {local.cerca.tipo === 'circulo' && (
                    <div>Raio: {local.cerca.raio}m</div>
                  )}
                  {local.cerca.tipo === 'poligono' && (
                    <div>Polígono: {local.cerca.pontos?.length} pontos</div>
                  )}
                </div>
              </Popup>
            </Marker>

            {local.cerca.tipo === 'circulo' && local.cerca.raio && (
              <Circle
                center={[local.coordenadas.lat, local.coordenadas.lng]}
                radius={local.cerca.raio}
                pathOptions={{
                  color: TIPOS_LOCAL_CONFIG[local.tipo].cor,
                  fillColor: TIPOS_LOCAL_CONFIG[local.tipo].cor,
                  fillOpacity: 0.08,
                  weight: 2,
                  dashArray: '5, 5'
                }}
              />
            )}

            {local.cerca.tipo === 'poligono' && local.cerca.pontos && local.cerca.pontos.length >= 3 && (
              <Polygon
                positions={local.cerca.pontos.map(p => [p.lat, p.lng])}
                pathOptions={{
                  color: TIPOS_LOCAL_CONFIG[local.tipo].cor,
                  fillColor: TIPOS_LOCAL_CONFIG[local.tipo].cor,
                  fillOpacity: 0.08,
                  weight: 2,
                  dashArray: '5, 5'
                }}
              />
            )}
          </div>
        ))}
      </MapContainer>

      {/* Painéis laterais */}
      {showCadastroLocal && (
        <CadastroLocalPanel
          local={localEditando}
          onSalvar={handleSalvarLocal}
          onCancelar={() => { setShowCadastroLocal(false); setLocalEditando(null); }}
        />
      )}

      {showListaLocais && (
        <ListaLocaisPanel
          locais={locais}
          onEditar={(local) => { setLocalEditando(local); setShowCadastroLocal(true); }}
          onExcluir={handleExcluirLocal}
          onClose={() => setShowListaLocais(false)}
        />
      )}

      {showHistorico && (
        <HistoricoPermanenciaPanel
          historico={historico}
          locais={locais}
          motoristas={motoristas}
          onClose={() => setShowHistorico(false)}
        />
      )}

      {showFilterPanel && (
        <FilterPanel
          filtros={filtros}
          onFilterChange={setFiltros}
          onClose={() => setShowFilterPanel(false)}
          motoristas={motoristas}
        />
      )}

      {showFilterLocaisPanel && (
        <FilterLocaisPanel
          filtros={filtrosLocais}
          onFilterChange={setFiltrosLocais}
          onClose={() => setShowFilterLocaisPanel(false)}
          totalLocais={locais.length}
          filteredCount={locaisFiltrados.length}
          locais={locais}
          motoristas={motoristas}
        />
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
            <span style={{ color: '#FFF' }}>Carregando...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisaoMapa;