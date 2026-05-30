import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from './firebase';
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import {
  Truck,
  MapPin,
  Clock,
  AlertCircle,
  Calendar,
  Navigation,
  Activity,
  Gauge,
  User,
  Phone,
  Search,
  Filter,
  ChevronDown,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock as ClockIcon,
  Map as MapIcon,
  List,
  Wifi,
  WifiOff,
  Zap,
  TrendingUp,
  Users,
  Car,
  Target,
  Thermometer,
  Wind,
  Droplet,
  CloudRain,
  Sun,
  Moon,
  Cloud,
  CloudSnow,
  CloudLightning,
  CloudFog,
  CloudDrizzle,
  Navigation as NavigationIcon,
  PlayCircle,
  PauseCircle,
  Flag,
  MessageSquare,
  Layers,
  Route,
  Maximize2,
  Minimize2
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ============ TIPOS E INTERFACES ============

interface MotoristaInfo {
  id: string;
  nome: string;
  cpf: string;
  cidade?: string;
  whatsapp?: string;
  telefone?: string;
  temMopp?: string;
  fotoPerfilUrl?: string;
  viagensRealizadas?: number;
}

interface VeiculoInfo {
  id: string;
  placa: string;
  tipo: string;
  capacidade?: number;
  ultimaLocalizacao?: string;
  velocidade?: number;
  ultimaAtualizacaoRastreador?: Timestamp;
  statusRastreador?: 'online' | 'offline' | 'parado';
  coordenadas?: { lat: number; lng: number };
  ultimaMacro?: string;
  ignicao?: string;
  motorista?: string;
  rotaMonisat?: string;
  ultimaAtualizacaoRotaMonisat?: Timestamp;
}

interface CargaInfo {
  id: string;
  status: string;
  placa: string;
  coletaLocal: string;
  coletaCidade: string;
  coletaData: string;
  entregaLocal: string;
  entregaCidade: string;
  entregaData: string;
  motorista: string;
  motoristaId?: string;
  peso: string;
  dt?: string;
  carreta?: string;
  observacoes?: string;
}

interface EscalaInfo {
  tipo: string | null;
  dataInicio: string;
}

interface StatusDecision {
  tipo: string;
  label: string;
  cor: string;
  bg: string;
  icon: JSX.Element;
  prioridade: number;
}

interface PainelEstatisticas {
  totalMotoristas: number;
  totalVeiculos: number;
  motoristasComProgramacao: number;
  motoristasSemProgramacao: number;
  veiculosComProgramacao: number;
  veiculosSemProgramacao: number;
  emRota: number;
  aguardandoCarregamento: number;
  chegouEntrega: number;
  motoristasFolga: number;
  motoristasDisponiveis: number;
  veiculosOnline: number;
  veiculosOffline: number;
  motoristasMopp: number;
  eficienciaFrota: number;
}

interface PrevisaoTempo {
  cidade: string;
  temperatura: number;
  condicao: string;
  umidade: number;
  vento: number;
  icone: string;
  tipo: 'coleta' | 'entrega';
}

interface DadosMapaVeiculo {
  id: string;
  nome: string;
  placa: string;
  status: string;
  statusLabel: string;
  statusCor: string;
  coordenadas?: { lat: number; lng: number };
  localizacao: string;
  velocidade: number;
  statusRastreador: 'online' | 'offline' | 'parado';
  cargaAtual?: {
    coletaLocal: string;
    coletaCidade: string;
    entregaLocal: string;
    entregaCidade: string;
    observacoes?: string;
  };
}

// ============ CONSTANTES ============

const STATUS_CONFIG: Record<string, StatusDecision> = {
  'programada': {
    tipo: 'programado',
    label: 'Programado',
    cor: '#FFD700',
    bg: '#FFD70020',
    icon: <Calendar size={14} />,
    prioridade: 3
  },
  'aguardando_carregamento': {
    tipo: 'aguardando',
    label: 'Aguardando Carregamento',
    cor: '#FF9500',
    bg: '#FF950020',
    icon: <ClockIcon size={14} />,
    prioridade: 4
  },
  'seguindo_para_entrega': {
    tipo: 'seguindo',
    label: 'Seguindo para Entrega',
    cor: '#22C55E',
    bg: '#22C55E20',
    icon: <Truck size={14} />,
    prioridade: 2
  },
  'chegou_entrega': {
    tipo: 'chegou',
    label: 'Chegou na Entrega',
    cor: '#3B82F6',
    bg: '#3B82F620',
    icon: <MapPin size={14} />,
    prioridade: 1
  },
  'folga': {
    tipo: 'folga',
    label: 'Em Folga',
    cor: '#8B5CF6',
    bg: '#8B5CF620',
    icon: <Moon size={14} />,
    prioridade: 5
  },
  'disponivel': {
    tipo: 'disponivel',
    label: 'Disponível',
    cor: '#10B981',
    bg: '#10B98120',
    icon: <CheckCircle size={14} />,
    prioridade: 6
  },
  'manutencao': {
    tipo: 'manutencao',
    label: 'Em Manutenção',
    cor: '#EF4444',
    bg: '#EF444420',
    icon: <AlertTriangle size={14} />,
    prioridade: 7
  },
  'atencao': {
    tipo: 'atencao',
    label: 'Atenção Necessária',
    cor: '#EF4444',
    bg: '#EF444420',
    icon: <AlertCircle size={14} />,
    prioridade: 8
  }
};

const CONDICOES_TEMPO: Record<string, { icon: JSX.Element; cor: string }> = {
  'clear': { icon: <Sun size={20} />, cor: '#FFD700' },
  'clouds': { icon: <Cloud size={20} />, cor: '#9CA3AF' },
  'rain': { icon: <CloudRain size={20} />, cor: '#3B82F6' },
  'drizzle': { icon: <CloudDrizzle size={20} />, cor: '#60A5FA' },
  'thunderstorm': { icon: <CloudLightning size={20} />, cor: '#F59E0B' },
  'snow': { icon: <CloudSnow size={20} />, cor: '#E5E7EB' },
  'mist': { icon: <CloudFog size={20} />, cor: '#9CA3AF' },
  'smoke': { icon: <CloudFog size={20} />, cor: '#9CA3AF' },
  'haze': { icon: <CloudFog size={20} />, cor: '#9CA3AF' },
  'dust': { icon: <Wind size={20} />, cor: '#D97706' },
  'fog': { icon: <CloudFog size={20} />, cor: '#9CA3AF' }
};

// ============ COMPONENTE PRINCIPAL ============

const PainelGeral: React.FC = () => {
  // Estados
  const [motoristas, setMotoristas] = useState<MotoristaInfo[]>([]);
  const [veiculos, setVeiculos] = useState<Record<string, VeiculoInfo>>({});
  const [cargasPorMotorista, setCargasPorMotorista] = useState<Record<string, CargaInfo | null>>({});
  const [escalaHojePorMotorista, setEscalaHojePorMotorista] = useState<Record<string, EscalaInfo | null>>({});
  const [visaoAtiva, setVisaoAtiva] = useState<'grid' | 'mapa'>('grid');
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date>(new Date());
  const [previsaoTempo, setPrevisaoTempo] = useState<PrevisaoTempo[]>([]);
  const [showMapaExpandido, setShowMapaExpandido] = useState(false);
  const [selectedMotoristaId, setSelectedMotoristaId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(30000);
  const [showObservacoes, setShowObservacoes] = useState<Record<string, boolean>>({});
  
  // Referências do Leaflet
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  // Helper para normalizar placa
  const normalizarPlaca = (placa: string): string => {
    if (!placa) return '';
    return placa.toUpperCase().replace(/[-\s]/g, '');
  };

  // Buscar motoristas
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'motoristas'), async (snap) => {
      const lista = await Promise.all(snap.docs.map(async (docMotorista) => {
        const motoristaData = { id: docMotorista.id, ...docMotorista.data() } as MotoristaInfo;
        
        let viagensCount = 0;
        try {
          const cargasRef = collection(db, 'motoristas', docMotorista.id, 'cargas');
          const cargasSnap = await getDocs(cargasRef);
          viagensCount = cargasSnap.docs.filter(docCarga => 
            docCarga.data().status === 'finalizada'
          ).length;
        } catch (error) {
          console.error('Erro ao contar viagens:', error);
        }
        
        return { ...motoristaData, viagensRealizadas: viagensCount };
      }));
      setMotoristas(lista);
      setUltimaAtualizacao(new Date());
    });
    return () => unsub();
  }, []);

  // Buscar veículos
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'veiculos'), (snap) => {
      const veiculosMap: Record<string, VeiculoInfo> = {};
      snap.forEach(doc => {
        const data = doc.data();
        veiculosMap[data.placa] = {
          id: doc.id,
          placa: data.placa,
          tipo: data.tipo,
          capacidade: data.capacidade,
          ultimaLocalizacao: data.ultimaLocalizacao || data.ultimoEndereco,
          velocidade: typeof data.velocidade === 'string' ? parseFloat(data.velocidade) : data.velocidade,
          ultimaAtualizacaoRastreador: data.ultimaAtualizacaoRastreador,
          statusRastreador: data.statusRastreador || 'offline',
          coordenadas: data.coordenadas,
          ultimaMacro: data.ultimaMacro,
          ignicao: data.ignicao,
          motorista: data.motorista,
          rotaMonisat: data.rotaMonisat,
          ultimaAtualizacaoRotaMonisat: data.ultimaAtualizacaoRotaMonisat
        };
      });
      setVeiculos(veiculosMap);
    });
    return () => unsub();
  }, []);

  // Buscar cargas ativas por motorista
  useEffect(() => {
    if (motoristas.length === 0) {
      setCargasPorMotorista({});
      return;
    }

    const STATUS_ATIVOS = ['programada', 'aguardando_carregamento', 'seguindo_para_entrega', 'chegou_entrega'];
    const unsubscribers: (() => void)[] = [];

    motoristas.forEach((motorista) => {
      if (!motorista.id) return;

      const cargasRef = collection(db, 'motoristas', motorista.id, 'cargas');
      const q = query(cargasRef, where('status', 'in', STATUS_ATIVOS));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
          setCargasPorMotorista(prev => ({ ...prev, [motorista.id]: null }));
        } else {
          const doc = snapshot.docs[0];
          const cargaData = doc.data();
          const carga: CargaInfo = {
            id: doc.id,
            status: cargaData.status,
            placa: cargaData.placa,
            coletaLocal: cargaData.coletaLocal,
            coletaCidade: cargaData.coletaCidade,
            coletaData: cargaData.coletaData,
            entregaLocal: cargaData.entregaLocal,
            entregaCidade: cargaData.entregaCidade,
            entregaData: cargaData.entregaData,
            motorista: cargaData.motorista,
            motoristaId: motorista.id,
            peso: cargaData.peso,
            dt: cargaData.dt,
            carreta: cargaData.carreta,
            observacoes: cargaData.observacoes || ''
          };
          setCargasPorMotorista(prev => ({ ...prev, [motorista.id]: carga }));
        }
      });

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [motoristas]);

  // Buscar escala do dia
  useEffect(() => {
    if (motoristas.length === 0) return;

    const hoje = new Date().toISOString().split('T')[0];
    const unsubscribers: (() => void)[] = [];

    motoristas.forEach((motorista) => {
      if (!motorista.id) return;

      const escalasRef = collection(db, 'motoristas', motorista.id, 'escalas_motoristas');
      const q = query(escalasRef, where('dataInicio', '==', hoje));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
          setEscalaHojePorMotorista(prev => ({ ...prev, [motorista.id]: null }));
        } else {
          const doc = snapshot.docs[0];
          const evento = { id: doc.id, ...doc.data() } as EscalaInfo;
          setEscalaHojePorMotorista(prev => ({ ...prev, [motorista.id]: evento }));
        }
        setLoading(false);
      });

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [motoristas]);

  // Buscar previsão do tempo para cidades de coleta e entrega
  useEffect(() => {
    const cidadesUnicas = new Set<string>();
    
    Object.values(cargasPorMotorista).forEach(carga => {
      if (carga) {
        cidadesUnicas.add(carga.coletaCidade);
        cidadesUnicas.add(carga.entregaCidade);
      }
    });

    // Simular previsão do tempo (substituir por API real como OpenWeatherMap)
    const condicoes = ['clear', 'clouds', 'rain', 'drizzle', 'thunderstorm'];
    const tempoSimulado: PrevisaoTempo[] = Array.from(cidadesUnicas).map((cidade, idx) => ({
      cidade,
      temperatura: Math.floor(Math.random() * 30) + 15,
      condicao: condicoes[Math.floor(Math.random() * condicoes.length)],
      umidade: Math.floor(Math.random() * 50) + 30,
      vento: Math.floor(Math.random() * 30) + 5,
      icone: condicoes[Math.floor(Math.random() * condicoes.length)],
      tipo: idx % 2 === 0 ? 'coleta' : 'entrega'
    }));
    
    setPrevisaoTempo(tempoSimulado);
  }, [cargasPorMotorista]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      setUltimaAtualizacao(new Date());
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // Calcular estatísticas
  const estatisticas = useMemo((): PainelEstatisticas => {
    const totalMotoristas = motoristas.length;
    const totalVeiculos = Object.keys(veiculos).length;
    
    const motoristasComProgramacao = motoristas.filter(m => cargasPorMotorista[m.id] !== null).length;
    const motoristasSemProgramacao = totalMotoristas - motoristasComProgramacao;
    
    const veiculosComProgramacao = Object.keys(veiculos).filter(placa => {
      return motoristas.some(m => {
        const carga = cargasPorMotorista[m.id];
        return carga && normalizarPlaca(carga.placa) === normalizarPlaca(placa);
      });
    }).length;
    const veiculosSemProgramacao = totalVeiculos - veiculosComProgramacao;
    
    const emRota = motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      return carga?.status === 'seguindo_para_entrega';
    }).length;
    
    const aguardandoCarregamento = motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      return carga?.status === 'aguardando_carregamento';
    }).length;
    
    const chegouEntrega = motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      return carga?.status === 'chegou_entrega';
    }).length;
    
    const motoristasFolga = motoristas.filter(m => {
      const escala = escalaHojePorMotorista[m.id];
      return escala && (escala.tipo === 'Descanso Semanal' || escala.tipo === 'Férias');
    }).length;
    
    const motoristasDisponiveis = motoristas.filter(m => {
      const temCarga = cargasPorMotorista[m.id] !== null;
      const escala = escalaHojePorMotorista[m.id];
      const emFolga = escala && (escala.tipo === 'Descanso Semanal' || escala.tipo === 'Férias');
      return !temCarga && !emFolga;
    }).length;
    
    const veiculosOnline = Object.values(veiculos).filter(v => v.statusRastreador === 'online').length;
    const veiculosOffline = totalVeiculos - veiculosOnline;
    
    const motoristasMopp = motoristas.filter(m => m.temMopp === 'Sim').length;
    
    const eficienciaFrota = totalMotoristas > 0
      ? Math.round(((motoristasComProgramacao + motoristasDisponiveis) / totalMotoristas) * 100)
      : 0;
    
    return {
      totalMotoristas,
      totalVeiculos,
      motoristasComProgramacao,
      motoristasSemProgramacao,
      veiculosComProgramacao,
      veiculosSemProgramacao,
      emRota,
      aguardandoCarregamento,
      chegouEntrega,
      motoristasFolga,
      motoristasDisponiveis,
      veiculosOnline,
      veiculosOffline,
      motoristasMopp,
      eficienciaFrota
    };
  }, [motoristas, cargasPorMotorista, escalaHojePorMotorista, veiculos]);

  // Dados combinados com informações de status
  const dadosCombinados = useMemo(() => {
    return motoristas.map(motorista => {
      const carga = cargasPorMotorista[motorista.id];
      const escala = escalaHojePorMotorista[motorista.id];
      const placaNormalizada = carga ? normalizarPlaca(carga.placa) : '';
      const veiculo = placaNormalizada ? veiculos[placaNormalizada] : undefined;
      
      let statusTipo = 'disponivel';
      let statusConfig = STATUS_CONFIG['disponivel'];
      
      if (carga) {
        statusTipo = carga.status;
        statusConfig = STATUS_CONFIG[carga.status] || STATUS_CONFIG['atencao'];
      } else if (escala && (escala.tipo === 'Descanso Semanal' || escala.tipo === 'Férias')) {
        statusTipo = 'folga';
        statusConfig = STATUS_CONFIG['folga'];
      }
      
      const precisaAtencao = (
        (veiculo && veiculo.statusRastreador !== 'online') ||
        (veiculo && veiculo.velocidade && veiculo.velocidade > 80) ||
        (carga && carga.coletaData && new Date(carga.coletaData) < new Date() && carga.status === 'programada')
      );
      
      return {
        id: motorista.id,
        nome: motorista.nome,
        cpf: motorista.cpf,
        cidade: motorista.cidade,
        whatsapp: motorista.whatsapp,
        telefone: motorista.telefone,
        temMopp: motorista.temMopp,
        viagensRealizadas: motorista.viagensRealizadas || 0,
        carga,
        escala,
        veiculo,
        status: statusTipo,
        statusInfo: statusConfig,
        precisaAtencao,
        localizacao: veiculo?.ultimaLocalizacao || motorista.cidade || 'Não disponível',
        velocidade: veiculo?.velocidade || 0,
        ultimaAtualizacao: veiculo?.ultimaAtualizacaoRastreador,
        coordenadas: veiculo?.coordenadas,
        rotaMonisat: veiculo?.rotaMonisat,
        motoristaRastreador: veiculo?.motorista,
        ultimaMacro: veiculo?.ultimaMacro,
        statusRastreador: veiculo?.statusRastreador || 'offline'
      };
    }).sort((a, b) => a.statusInfo.prioridade - b.statusInfo.prioridade);
  }, [motoristas, cargasPorMotorista, escalaHojePorMotorista, veiculos]);

  // Dados filtrados
  const dadosFiltrados = useMemo(() => {
    return dadosCombinados.filter(item => {
      const matchTexto = filtroTexto === '' || 
        item.nome.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        item.cpf.includes(filtroTexto) ||
        (item.carga?.placa || '').toLowerCase().includes(filtroTexto.toLowerCase());
      
      const matchStatus = filtroStatus === 'todos' || item.status === filtroStatus;
      
      return matchTexto && matchStatus;
    });
  }, [dadosCombinados, filtroTexto, filtroStatus]);

  // Dados para o mapa
  const dadosMapa = useMemo(() => {
    return dadosFiltrados.map(item => ({
      id: item.id,
      nome: item.nome,
      placa: item.carga?.placa || '',
      status: item.status,
      statusLabel: item.statusInfo.label,
      statusCor: item.statusInfo.cor,
      coordenadas: item.coordenadas,
      localizacao: item.localizacao,
      velocidade: item.velocidade,
      statusRastreador: item.statusRastreador,
      cargaAtual: item.carga ? {
        coletaLocal: item.carga.coletaLocal,
        coletaCidade: item.carga.coletaCidade,
        entregaLocal: item.carga.entregaLocal,
        entregaCidade: item.carga.entregaCidade,
        observacoes: item.carga.observacoes
      } : undefined
    })) as DadosMapaVeiculo[];
  }, [dadosFiltrados]);

  // Inicializar e atualizar mapa
  useEffect(() => {
    if (visaoAtiva !== 'mapa') return;

    // Inicializar mapa se não existir
    if (!mapRef.current) {
      const mapContainer = document.getElementById('map-container');
      if (!mapContainer) return;

      mapRef.current = L.map('map-container').setView([-15.7975, -47.8919], 4); // Centro do Brasil

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    // Limpar marcadores antigos
    Object.values(markersRef.current).forEach(marker => {
      mapRef.current?.removeLayer(marker);
    });
    markersRef.current = {};

    // Adicionar novos marcadores
    dadosMapa.forEach(item => {
      if (item.coordenadas?.lat && item.coordenadas?.lng) {
        const cor = item.statusCor;
        const html = `
          <div style="
            width: 32px;
            height: 32px;
            background: ${cor};
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">
            🚛
          </div>
        `;

        const marker = L.marker([item.coordenadas.lat, item.coordenadas.lng], {
          icon: L.divIcon({
            html,
            iconSize: [32, 32],
            className: 'custom-marker'
          })
        }).addTo(mapRef.current!);

        // Popup com informações
        const popupContent = `
          <div style="font-family: Arial; font-size: 12px; color: #333;">
            <strong>${item.nome}</strong><br/>
            Placa: ${item.placa}<br/>
            Status: ${item.statusLabel}<br/>
            Velocidade: ${item.velocidade} km/h<br/>
            ${item.cargaAtual ? `
              Coleta: ${item.cargaAtual.coletaCidade}<br/>
              Entrega: ${item.cargaAtual.entregaCidade}
            ` : ''}
          </div>
        `;

        marker.bindPopup(popupContent);
        markersRef.current[item.id] = marker;
      }
    });

    // Ajustar visualização para mostrar todos os marcadores
    if (Object.keys(markersRef.current).length > 0) {
      const group = new L.FeatureGroup(Object.values(markersRef.current));
      mapRef.current?.fitBounds(group.getBounds().pad(0.1));
    }
  }, [visaoAtiva, dadosMapa]);

  // Limpar filtros
  const limparFiltros = () => {
    setFiltroTexto('');
    setFiltroStatus('todos');
  };

  const temFiltrosAtivos = filtroTexto !== '' || filtroStatus !== 'todos';

  // Formatar tempo
  const formatarUltimaAtualizacao = (timestamp: any): string => {
    if (!timestamp) return '—';
    try {
      let date: Date;
      if (timestamp?.toDate) {
        date = timestamp.toDate();
      } else if (timestamp?.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else {
        date = new Date(timestamp);
      }
      const agora = new Date();
      const diffMs = agora.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      
      if (diffMin < 1) return 'agora mesmo';
      if (diffMin < 60) return `há ${diffMin} min`;
      const diffHoras = Math.floor(diffMin / 60);
      if (diffHoras < 24) return `há ${diffHoras} h`;
      return date.toLocaleDateString('pt-BR');
    } catch {
      return '—';
    }
  };

  // Obter cor da velocidade
  const getVelocidadeColor = (velocidade: number): string => {
    if (velocidade === 0) return '#666';
    if (velocidade < 60) return '#22C55E';
    if (velocidade <= 80) return '#FFD700';
    return '#EF4444';
  };

  // Componente de Card Informativo
  const CardInformativo = ({ item }: { item: typeof dadosCombinados[0] }) => {
    const temObservacoes = item.carga?.observacoes && item.carga.observacoes.trim().length > 0;
    const mostrarObservacoes = showObservacoes[item.id] || false;

    return (
      <div
        style={{
          backgroundColor: '#0A0A0A',
          borderRadius: '20px',
          border: `1px solid ${item.precisaAtencao ? '#EF4444' : '#1A1A1A'}`,
          overflow: 'hidden',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        onClick={() => setSelectedMotoristaId(item.id)}
      >
        {/* Header do Card */}
        <div
          style={{
            padding: '16px 20px',
            background: item.statusInfo.bg,
            borderBottom: `1px solid ${item.statusInfo.cor}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: item.statusInfo.cor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000'
              }}
            >
              {item.statusInfo.icon}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#FFF' }}>
                {item.nome}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: item.statusInfo.cor }}>
                {item.statusInfo.label}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {item.precisaAtencao && (
              <div style={{ color: '#EF4444' }}>
                <AlertCircle size={20} />
              </div>
            )}
            {temObservacoes && (
              <div style={{ color: '#FFD700' }}>
                <MessageSquare size={20} />
              </div>
            )}
          </div>
        </div>

        {/* Conteúdo do Card */}
        <div style={{ padding: '16px 20px' }}>
          {/* Informações Básicas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#AAA' }}>
              <MapPin size={12} color="#FFD700" />
              <span>{item.cidade || 'Não informada'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#AAA' }}>
              <Phone size={12} color="#FFD700" />
              <span>{item.whatsapp || item.telefone || '—'}</span>
            </div>
          </div>

          {/* Badge MOPP */}
          {item.temMopp === 'Sim' && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                background: '#22C55E20',
                borderRadius: '20px',
                marginBottom: '12px'
              }}
            >
              <CheckCircle size={12} color="#22C55E" />
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#22C55E' }}>MOPP</span>
            </div>
          )}

          {/* Carga Atual */}
          {item.carga && (
            <div
              style={{
                marginTop: '12px',
                padding: '12px',
                background: '#1A1A1A',
                borderRadius: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Truck size={12} color="#FFD700" />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#FFD700' }}>CARGA ATUAL</span>
              </div>
              <div style={{ fontSize: '12px', color: '#FFF', marginBottom: '4px' }}>
                <strong>Placa:</strong> {item.carga.placa}
              </div>
              <div style={{ fontSize: '12px', color: '#AAA', marginBottom: '4px' }}>
                📍 {item.carga.coletaCidade} → {item.carga.entregaCidade}
              </div>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
                📅 Entrega: {new Date(item.carga.entregaData).toLocaleDateString('pt-BR')}
              </div>
              
              {/* Previsão do Tempo para Cidades */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', fontSize: '10px', flexWrap: 'wrap' }}>
                {previsaoTempo.map((tempo, idx) => {
                  if (tempo.cidade === item.carga?.coletaCidade || tempo.cidade === item.carga?.entregaCidade) {
                    const condicaoInfo = CONDICOES_TEMPO[tempo.icone] || CONDICOES_TEMPO['clouds'];
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: '#2A2A2A', borderRadius: '6px' }}>
                        <span style={{ color: '#888' }}>{tempo.cidade}:</span>
                        <span style={{ color: condicaoInfo.cor }}>{tempo.temperatura}°C</span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>

              {/* Observações */}
              {temObservacoes && (
                <div
                  style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #2A2A2A'
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowObservacoes(prev => ({ ...prev, [item.id]: !mostrarObservacoes }));
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 0',
                      background: 'transparent',
                      border: 'none',
                      color: '#FFD700',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <MessageSquare size={12} />
                    Observações {mostrarObservacoes ? '▼' : '▶'}
                  </button>
                  {mostrarObservacoes && (
                    <div
                      style={{
                        marginTop: '6px',
                        padding: '8px',
                        background: '#2A2A2A',
                        borderRadius: '6px',
                        fontSize: '10px',
                        color: '#CCC',
                        lineHeight: '1.4',
                        maxHeight: '100px',
                        overflowY: 'auto'
                      }}
                    >
                      {item.carga.observacoes}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Monitoramento em Tempo Real */}
          {item.veiculo && (
            <div
              style={{
                marginTop: '12px',
                padding: '12px',
                background: '#1A1A1A',
                borderRadius: '12px',
                border: `1px solid ${item.statusRastreador === 'online' ? '#22C55E' : '#EF4444'}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Activity size={12} color="#FFD700" />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#FFD700' }}>LOCALIZAÇÃO EM TEMPO REAL</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>📍 Localização:</span>
                <span style={{ fontSize: '11px', color: '#22C55E' }}>
                  {item.localizacao?.substring(0, 30) || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>🏎️ Velocidade:</span>
                <span style={{ fontSize: '11px', color: getVelocidadeColor(item.velocidade) }}>
                  {item.velocidade > 0 ? `${item.velocidade} km/h` : 'Parado'}
                  {item.velocidade > 80 && ' ⚠️'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>📡 Status:</span>
                <span style={{ fontSize: '11px', color: item.statusRastreador === 'online' ? '#22C55E' : '#EF4444', fontWeight: 'bold' }}>
                  {item.statusRastreador === 'online' ? '🟢 Online' : '🔴 Offline'}
                </span>
              </div>
              <div style={{ fontSize: '10px', color: '#666', marginTop: '6px' }}>
                ⏱️ {formatarUltimaAtualizacao(item.ultimaAtualizacao)}
              </div>
            </div>
          )}

          {/* Status quando sem programação */}
          {!item.carga && item.status !== 'folga' && (
            <div
              style={{
                marginTop: '12px',
                padding: '12px',
                background: '#10B98120',
                borderRadius: '12px',
                textAlign: 'center',
                border: '1px solid #10B981'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#10B981' }}>
                ✅ Disponível para Nova Programação
              </span>
            </div>
          )}

          {/* Footer com ações rápidas */}
          <div
            style={{
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid #1A1A1A',
              display: 'flex',
              gap: '8px'
            }}
          >
            {item.whatsapp && (
              <button
                style={{
                  flex: 1,
                  padding: '8px',
                  background: '#25D36620',
                  border: '1px solid #25D366',
                  borderRadius: '8px',
                  color: '#25D366',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`https://wa.me/55${item.whatsapp?.replace(/\D/g, '')}`, '_blank');
                }}
              >
                <Phone size={12} /> WhatsApp
              </button>
            )}
            {item.coordenadas && (
              <button
                style={{
                  flex: 1,
                  padding: '8px',
                  background: '#3B82F620',
                  border: '1px solid #3B82F6',
                  borderRadius: '8px',
                  color: '#3B82F6',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`https://www.google.com/maps?q=${item.coordenadas?.lat},${item.coordenadas?.lng}`, '_blank');
                }}
              >
                <Navigation size={12} /> Ver Mapa
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Componente de Previsão do Tempo
  const PrevisaoTempoWidget = () => {
    if (previsaoTempo.length === 0) return null;
    
    return (
      <div
        style={{
          backgroundColor: '#0A0A0A',
          borderRadius: '20px',
          border: '1px solid #1A1A1A',
          padding: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <CloudRain size={18} color="#FFD700" />
          <span style={{ fontWeight: 600, color: '#FFF' }}>Previsão do Tempo - Cidades de Coleta e Entrega</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
          {previsaoTempo.map((cidade, idx) => {
            const condicaoInfo = CONDICOES_TEMPO[cidade.icone] || CONDICOES_TEMPO['clouds'];
            return (
              <div
                key={idx}
                style={{
                  minWidth: '120px',
                  padding: '12px',
                  background: '#1A1A1A',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: `1px solid ${cidade.tipo === 'coleta' ? '#22C55E' : '#3B82F6'}`
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#FFF' }}>
                  {cidade.cidade}
                </div>
                <div style={{ fontSize: '9px', color: cidade.tipo === 'coleta' ? '#22C55E' : '#3B82F6', marginBottom: '4px' }}>
                  {cidade.tipo === 'coleta' ? '📦 Coleta' : '📍 Entrega'}
                </div>
                <div style={{ color: condicaoInfo.cor, margin: '8px 0', display: 'flex', justifyContent: 'center' }}>
                  {condicaoInfo.icon}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFD700' }}>
                  {cidade.temperatura}°C
                </div>
                <div style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>
                  💧 {cidade.umidade}% | 💨 {cidade.vento}km/h
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Componente de Recomendações
  const RecomendacoesWidget = () => {
    const recomendacoes = [];
    
    if (estatisticas.motoristasDisponiveis > 0) {
      recomendacoes.push(`${estatisticas.motoristasDisponiveis} motoristas disponíveis para programação`);
    }
    
    if (estatisticas.veiculosOffline > 5) {
      recomendacoes.push(`${estatisticas.veiculosOffline} veículos offline - Verificar rastreadores`);
    }
    
    const veiculosAltaVelocidade = dadosCombinados.filter(d => d.velocidade > 80).length;
    if (veiculosAltaVelocidade > 0) {
      recomendacoes.push(`${veiculosAltaVelocidade} veículos em alta velocidade`);
    }
    
    const cargasAtrasadas = dadosCombinados.filter(d => 
      d.carga && d.carga.coletaData && new Date(d.carga.coletaData) < new Date() && d.carga.status === 'programada'
    ).length;
    if (cargasAtrasadas > 0) {
      recomendacoes.push(`${cargasAtrasadas} cargas programadas com atraso na coleta`);
    }

    const cargasComObservacoes = dadosCombinados.filter(d => 
      d.carga && d.carga.observacoes && d.carga.observacoes.trim().length > 0
    ).length;
    if (cargasComObservacoes > 0) {
      recomendacoes.push(`${cargasComObservacoes} cargas com observações importantes`);
    }
    
    if (recomendacoes.length === 0) {
      recomendacoes.push('Tudo em ordem! Nenhuma ação urgente necessária.');
    }
    
    return (
      <div
        style={{
          backgroundColor: '#0A0A0A',
          borderRadius: '20px',
          border: '1px solid #1A1A1A',
          padding: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Target size={18} color="#FFD700" />
          <span style={{ fontWeight: 600, color: '#FFF' }}>Recomendações para Tomada de Decisão</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recomendacoes.map((rec, idx) => (
            <div
              key={idx}
              style={{
                padding: '10px',
                background: '#1A1A1A',
                borderRadius: '10px',
                fontSize: '13px',
                color: '#FFD700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={14} />
              <span>{rec}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Componente de Card Estatístico
  const StatCard = ({ title, value, icon, color, subtitle }: any) => (
    <div
      style={{
        backgroundColor: '#0A0A0A',
        borderRadius: '16px',
        border: `1px solid ${color}30`,
        padding: '16px',
        transition: 'all 0.2s ease'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#FFF' }}>{value}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{title}</div>
          {subtitle && <div style={{ fontSize: '10px', color: color }}>{subtitle}</div>}
        </div>
        <div style={{ color: color }}>{icon}</div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '24px', backgroundColor: '#000', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        * {
          box-sizing: border-box;
        }
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #1A1A1A;
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb {
          background: #FFD700;
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #FFB700;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        #map-container {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          overflow: hidden;
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#FFF', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TrendingUp size={28} color="#FFD700" />
            Painel Geral de Tomada de Decisão
          </h1>
          <p style={{ color: '#666', fontSize: '13px', marginTop: '8px' }}>
            Visão unificada de motoristas e veículos • Última atualização: {ultimaAtualizacao.toLocaleTimeString('pt-BR')}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setVisaoAtiva(visaoAtiva === 'grid' ? 'mapa' : 'grid')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#1A1A1A',
              border: `1px solid ${visaoAtiva === 'grid' ? '#FFD700' : '#333'}`,
              borderRadius: '12px',
              color: visaoAtiva === 'grid' ? '#FFD700' : '#FFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            {visaoAtiva === 'grid' ? <List size={16} /> : <MapIcon size={16} />}
            {visaoAtiva === 'grid' ? 'Visão em Grade' : 'Visão em Mapa'}
          </button>
          
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#1A1A1A',
              border: '1px solid #333',
              borderRadius: '12px',
              color: '#FFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <RefreshCw size={16} style={{ animation: autoRefresh ? 'spin 1s linear infinite' : 'none' }} />
            Auto {autoRefresh ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard
          title="Motoristas"
          value={estatisticas.totalMotoristas}
          icon={<Users size={24} />}
          color="#FFD700"
          subtitle={`${estatisticas.motoristasComProgramacao} com carga • ${estatisticas.motoristasDisponiveis} disponíveis`}
        />
        <StatCard
          title="Veículos"
          value={estatisticas.totalVeiculos}
          icon={<Car size={24} />}
          color="#3B82F6"
          subtitle={`${estatisticas.veiculosOnline} online • ${estatisticas.veiculosOffline} offline`}
        />
        <StatCard
          title="Em Rota"
          value={estatisticas.emRota}
          icon={<Truck size={24} />}
          color="#22C55E"
          subtitle="Veículos em deslocamento"
        />
        <StatCard
          title="Eficiência da Frota"
          value={`${estatisticas.eficienciaFrota}%`}
          icon={<Target size={24} />}
          color="#FFD700"
          subtitle="Programados + Disponíveis"
        />
        <StatCard
          title="MOPP Certificados"
          value={estatisticas.motoristasMopp}
          icon={<CheckCircle size={24} />}
          color="#8B5CF6"
          subtitle="Motoristas habilitados"
        />
        <StatCard
          title="Aguardando Carregamento"
          value={estatisticas.aguardandoCarregamento}
          icon={<ClockIcon size={24} />}
          color="#FF9500"
          subtitle="Prontos para carregar"
        />
      </div>

      {/* Pré-visualização do Mapa + Recomendações + Previsão */}
      {visaoAtiva === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: '#0A0A0A', borderRadius: '20px', border: '1px solid #1A1A1A', overflow: 'hidden', height: '300px' }}>
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1A1A1A' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapIcon size={18} color="#FFD700" />
                <span style={{ fontWeight: 600, color: '#FFF' }}>Visão Geográfica</span>
                <span style={{ fontSize: '11px', color: '#666' }}>
                  {dadosMapa.filter(d => d.coordenadas).length} veículos com localização
                </span>
              </div>
              <button
                onClick={() => setShowMapaExpandido(!showMapaExpandido)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer'
                }}
              >
                {showMapaExpandido ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={{ padding: '16px', height: 'calc(100% - 45px)', overflowY: 'auto' }}>
              {dadosMapa.filter(d => d.coordenadas).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  <MapIcon size={32} />
                  <p style={{ marginTop: '12px' }}>Nenhuma localização disponível</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dadosMapa.filter(d => d.coordenadas).map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: '#1A1A1A',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        border: item.cargaAtual?.observacoes ? '1px solid #FFD700' : '1px solid transparent'
                      }}
                      onClick={() => window.open(`https://www.google.com/maps?q=${item.coordenadas?.lat},${item.coordenadas?.lng}`, '_blank')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <div
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: item.statusCor,
                            boxShadow: `0 0 4px ${item.statusCor}`
                          }}
                        />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFF' }}>{item.nome}</div>
                          <div style={{ fontSize: '10px', color: '#666' }}>{item.statusLabel}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {item.cargaAtual?.observacoes && (
                          <MessageSquare size={12} color="#FFD700" />
                        )}
                        <div style={{ fontSize: '10px', color: '#FFD700' }}>
                          {item.localizacao?.substring(0, 20)}...
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <RecomendacoesWidget />
            <PrevisaoTempoWidget />
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setFiltrosAbertos(!filtrosAbertos)}
            style={{
              padding: '10px 16px',
              background: '#1A1A1A',
              border: `1px solid ${filtrosAbertos ? '#FFD700' : '#333'}`,
              borderRadius: '10px',
              color: '#FFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px'
            }}
          >
            <Filter size={14} /> Filtros
            <ChevronDown size={14} style={{ transform: filtrosAbertos ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {temFiltrosAtivos && (
            <button
              onClick={limparFiltros}
              style={{
                padding: '10px 16px',
                background: '#EF444420',
                border: '1px solid #EF4444',
                borderRadius: '10px',
                color: '#EF4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px'
              }}
            >
              <X size={14} /> Limpar Filtros
            </button>
          )}
        </div>
        
        <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
          <input
            type="text"
            placeholder="Buscar motorista, placa ou CPF..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              background: '#1A1A1A',
              border: '1px solid #333',
              borderRadius: '10px',
              color: '#FFF',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Painel de Filtros Avançados */}
      {filtrosAbertos && (
        <div style={{ background: '#0A0A0A', borderRadius: '16px', padding: '20px', marginBottom: '24px', border: '1px solid #1A1A1A' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Status do Motorista</label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#1A1A1A',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#FFF',
                  fontSize: '13px'
                }}
              >
                <option value="todos">Todos</option>
                <option value="programada">📋 Programado</option>
                <option value="aguardando_carregamento">⏳ Aguardando Carregamento</option>
                <option value="seguindo_para_entrega">🚛 Em Rota</option>
                <option value="chegou_entrega">📍 Chegou na Entrega</option>
                <option value="folga">😴 Em Folga</option>
                <option value="disponivel">✅ Disponível</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Grid de Cards ou Mapa Completo */}
      {visaoAtiva === 'grid' ? (
        loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
            <RefreshCw size={40} style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '16px' }}>Carregando dados...</p>
          </div>
        ) : dadosFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', backgroundColor: '#0A0A0A', borderRadius: '24px' }}>
            <AlertCircle size={48} color="#666" />
            <h3 style={{ color: '#FFF', marginTop: '16px' }}>Nenhum resultado encontrado</h3>
            <p style={{ color: '#666' }}>Tente ajustar os filtros de busca</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '20px' }}>
            {dadosFiltrados.map(item => (
              <CardInformativo key={item.id} item={item} />
            ))}
          </div>
        )
      ) : (
        <div style={{ backgroundColor: '#0A0A0A', borderRadius: '20px', border: '1px solid #1A1A1A', padding: '16px', minHeight: '600px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #1A1A1A' }}>
            <MapIcon size={20} color="#FFD700" />
            <span style={{ fontWeight: 600, color: '#FFF' }}>Mapa de Localização em Tempo Real</span>
            <span style={{ fontSize: '11px', color: '#666', marginLeft: 'auto' }}>
              {dadosMapa.filter(d => d.coordenadas).length} veículos com localização
            </span>
          </div>
          <div id="map-container" style={{ width: '100%', height: '550px', borderRadius: '12px' }} />
        </div>
      )}

      {/* Rodapé com informações */}
      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #1A1A1A', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#666' }}>
        <div>
          📊 Dados em tempo real • {dadosFiltrados.length} motoristas exibidos de {dadosCombinados.length} total
        </div>
        <div>
          🔄 Auto-atualização a cada {refreshInterval / 1000} segundos
        </div>
      </div>
    </div>
  );
};

export default PainelGeral;
