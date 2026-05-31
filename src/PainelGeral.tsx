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
  Minimize2,
  Edit3,
  FileText,
  Wrench
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

// STATUS DO MOTORISTA
const STATUS_MOTORISTA_OPTS: Record<string, { label: string; icon: string; cor: string; bg: string }> = {
  'disponivel': { label: 'Disponível para Programar', icon: '✅', cor: '#22C55E', bg: '#22C55E20' },
  'folga': { label: 'Folga', icon: '😴', cor: '#FFD700', bg: '#FFD70020' },
  'ferias': { label: 'Férias', icon: '🏖️', cor: '#FFD700', bg: '#FFD70020' },
  'sem_veiculo': { label: 'Sem Veículo', icon: '🚫', cor: '#EF4444', bg: '#EF444420' },
  'falta': { label: 'Falta', icon: '❌', cor: '#EF4444', bg: '#EF444420' },
  'atestado': { label: 'Atestado', icon: '📋', cor: '#8B5CF6', bg: '#8B5CF620' },
  'veiculo_manutencao': { label: 'Veículo em Manutenção', icon: '🔧', cor: '#FF9500', bg: '#FF950020' }
};

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
  'disponivel': {
    tipo: 'disponivel',
    label: 'Disponível',
    cor: '#10B981',
    bg: '#10B98120',
    icon: <CheckCircle size={14} />,
    prioridade: 6
  },
  'folga': {
    tipo: 'folga',
    label: 'Folga',
    cor: '#8B5CF6',
    bg: '#8B5CF620',
    icon: <Moon size={14} />,
    prioridade: 5
  },
  'ferias': {
    tipo: 'ferias',
    label: 'Férias',
    cor: '#8B5CF6',
    bg: '#8B5CF620',
    icon: <Calendar size={14} />,
    prioridade: 5
  },
  'sem_veiculo': {
    tipo: 'sem_veiculo',
    label: 'Sem Veículo',
    cor: '#EF4444',
    bg: '#EF444420',
    icon: <AlertTriangle size={14} />,
    prioridade: 7
  },
  'falta': {
    tipo: 'falta',
    label: 'Falta',
    cor: '#EF4444',
    bg: '#EF444420',
    icon: <XCircle size={14} />,
    prioridade: 7
  },
  'atestado': {
    tipo: 'atestado',
    label: 'Atestado',
    cor: '#8B5CF6',
    bg: '#8B5CF620',
    icon: <FileText size={14} />,
    prioridade: 7
  },
  'veiculo_manutencao': {
    tipo: 'veiculo_manutencao',
    label: 'Veículo em Manutenção',
    cor: '#FF9500',
    bg: '#FF950020',
    icon: <Wrench size={14} />,
    prioridade: 7
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

// ============ INTERFACE STATUS DECISION ============
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
  motoristasFerias: number;
  motoristasSemVeiculo: number;
  motoristasFalta: number;
  motoristasAtestado: number;
  motoristasVeiculoManutencao: number;
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
  ultimaMacro?: string;
  rotaMonisat?: string;
  cargaAtual?: {
    coletaLocal: string;
    coletaCidade: string;
    entregaLocal: string;
    entregaCidade: string;
    observacoes?: string;
  };
}

// ============ COMPONENTE PRINCIPAL ============

const PainelGeral: React.FC = () => {
  // Estados
  const [motoristas, setMotoristas] = useState<MotoristaInfo[]>([]);
  const [veiculos, setVeiculos] = useState<Record<string, VeiculoInfo>>({});
  const [cargasPorMotorista, setCargasPorMotorista] = useState<Record<string, CargaInfo | null>>({});
  const [escalaHojePorMotorista, setEscalaHojePorMotorista] = useState<Record<string, EscalaInfo | null>>({});
  const [statusSelecionado, setStatusSelecionado] = useState<Record<string, string>>({});
  const [observacoesTemp, setObservacoesTemp] = useState<Record<string, string>>({});
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

  // Carregar status e observações salvos do localStorage
  useEffect(() => {
    motoristas.forEach(m => {
      const savedStatus = localStorage.getItem(`status_motorista_${m.id}`);
      if (savedStatus) {
        setStatusSelecionado(prev => ({ ...prev, [m.id]: savedStatus }));
      }
      const savedObservacao = localStorage.getItem(`observacao_temp_${m.id}`);
      if (savedObservacao) {
        setObservacoesTemp(prev => ({ ...prev, [m.id]: savedObservacao }));
      }
    });
  }, [motoristas]);

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
          ultimaAtualizacaoRastreador: data.ultimaAtualizacaoRastreador || data.ultimaConsulta,
          statusRastreador: data.statusRastreador || 'offline',
          coordenadas: data.coordenadas,
          ultimaMacro: data.ultimaMacro || data.ultimoStatus,
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

  // Buscar previsão do tempo (simulada - substituir por API real)
  useEffect(() => {
    const cidadesUnicas = new Set<string>();
    
    Object.values(cargasPorMotorista).forEach(carga => {
      if (carga) {
        cidadesUnicas.add(carga.coletaCidade);
        cidadesUnicas.add(carga.entregaCidade);
      }
    });

    const condicoes = ['clear', 'clouds', 'rain', 'drizzle', 'thunderstorm'];
    const tempoSimulado: PrevisaoTempo[] = Array.from(cidadesUnicas).map((cidade, idx) => ({
      cidade,
      temperatura: Math.floor(Math.random() * 25) + 15,
      condicao: condicoes[Math.floor(Math.random() * condicoes.length)],
      umidade: Math.floor(Math.random() * 50) + 30,
      vento: Math.floor(Math.random() * 25) + 5,
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

  // Função para obter o status do motorista (integrado com localStorage)
  const getMotoristaStatus = (motorista: MotoristaInfo, carga: CargaInfo | null, escala: EscalaInfo | null) => {
    // Se tem carga, mostra o status da carga
    if (carga) {
      return carga.status;
    }
    
    // Se tem status manual salvo, mostra ele
    const statusManual = statusSelecionado[motorista.id];
    if (statusManual) {
      return statusManual;
    }
    
    // Verifica escala do dia
    if (escala) {
      if (escala.tipo === 'Descanso Semanal') return 'folga';
      if (escala.tipo === 'Férias') return 'ferias';
      if (escala.tipo === 'Falta') return 'falta';
      if (escala.tipo === 'Atestado') return 'atestado';
    }
    
    return 'disponivel';
  };

  // Calcular estatísticas expandidas
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
    
    // Status baseados em escala e manual
    const motoristasFolga = motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      if (carga) return false;
      const statusManual = statusSelecionado[m.id];
      if (statusManual === 'folga') return true;
      const escala = escalaHojePorMotorista[m.id];
      return escala && escala.tipo === 'Descanso Semanal';
    }).length;
    
    const motoristasFerias = motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      if (carga) return false;
      const statusManual = statusSelecionado[m.id];
      if (statusManual === 'ferias') return true;
      const escala = escalaHojePorMotorista[m.id];
      return escala && escala.tipo === 'Férias';
    }).length;
    
    const motoristasSemVeiculo = motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      if (carga) return false;
      const statusManual = statusSelecionado[m.id];
      return statusManual === 'sem_veiculo';
    }).length;
    
    const motoristasFalta = motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      if (carga) return false;
      const statusManual = statusSelecionado[m.id];
      if (statusManual === 'falta') return true;
      const escala = escalaHojePorMotorista[m.id];
      return escala && escala.tipo === 'Falta';
    }).length;
    
    const motoristasAtestado = motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      if (carga) return false;
      const statusManual = statusSelecionado[m.id];
      if (statusManual === 'atestado') return true;
      const escala = escalaHojePorMotorista[m.id];
      return escala && escala.tipo === 'Atestado';
    }).length;
    
    const motoristasVeiculoManutencao = motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      if (carga) return false;
      const statusManual = statusSelecionado[m.id];
      return statusManual === 'veiculo_manutencao';
    }).length;
    
    const motoristasDisponiveis = motoristas.filter(m => {
      const status = getMotoristaStatus(m, cargasPorMotorista[m.id], escalaHojePorMotorista[m.id]);
      return status === 'disponivel';
    }).length;
    
    const veiculosOnline = Object.values(veiculos).filter(v => v.statusRastreador === 'online').length;
    const veiculosOffline = totalVeiculos - veiculosOnline;
    
    const motoristasMopp = motoristas.filter(m => m.temMopp === 'Sim').length;
    
    // Eficiência = (ComProgramacao + Disponiveis) / Total
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
      motoristasFerias,
      motoristasSemVeiculo,
      motoristasFalta,
      motoristasAtestado,
      motoristasVeiculoManutencao,
      motoristasDisponiveis,
      veiculosOnline,
      veiculosOffline,
      motoristasMopp,
      eficienciaFrota
    };
  }, [motoristas, cargasPorMotorista, escalaHojePorMotorista, veiculos, statusSelecionado]);

  // Dados combinados com informações de status
  const dadosCombinados = useMemo(() => {
    return motoristas.map(motorista => {
      const carga = cargasPorMotorista[motorista.id];
      const escala = escalaHojePorMotorista[motorista.id];
      const statusKey = getMotoristaStatus(motorista, carga, escala);
      const statusConfig = STATUS_CONFIG[statusKey] || STATUS_CONFIG['disponivel'];
      const statusManual = statusSelecionado[motorista.id];
      const statusManualInfo = statusManual ? STATUS_MOTORISTA_OPTS[statusManual] : null;
      const observacao = observacoesTemp[motorista.id] || '';
      
      const placaNormalizada = carga ? normalizarPlaca(carga.placa) : '';
      const veiculo = placaNormalizada ? veiculos[placaNormalizada] : undefined;
      
      const precisaAtencao = (
        (veiculo && veiculo.statusRastreador !== 'online') ||
        (veiculo && veiculo.velocidade && veiculo.velocidade > 80) ||
        (carga && carga.coletaData && new Date(carga.coletaData) < new Date() && carga.status === 'programada') ||
        (observacao && observacao.length > 0) ||
        (carga && carga.observacoes && carga.observacoes.length > 0)
      );
      
      // Formatar data de entrega para exibição
      const dataEntregaFormatada = carga ? new Date(carga.entregaData).toLocaleDateString('pt-BR') : null;
      const coletaComAtraso = carga && carga.coletaData && new Date(carga.coletaData) < new Date() && carga.status === 'programada';
      
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
        status: statusKey,
        statusInfo: statusConfig,
        statusManual: statusManualInfo,
        observacao,
        precisaAtencao,
        localizacao: veiculo?.ultimaLocalizacao || motorista.cidade || 'Não disponível',
        velocidade: veiculo?.velocidade || 0,
        ultimaAtualizacao: veiculo?.ultimaAtualizacaoRastreador,
        coordenadas: veiculo?.coordenadas,
        rotaMonisat: veiculo?.rotaMonisat,
        ultimaMacro: veiculo?.ultimaMacro,
        ultimaAtualizacaoRotaMonisat: veiculo?.ultimaAtualizacaoRotaMonisat,
        motoristaRastreador: veiculo?.motorista,
        statusRastreador: veiculo?.statusRastreador || 'offline',
        dataEntregaFormatada,
        coletaComAtraso
      };
    }).sort((a, b) => {
      // Prioridade: cargas em andamento primeiro
      const prioridadeA = a.carga ? 1 : 2;
      const prioridadeB = b.carga ? 1 : 2;
      if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;
      return a.statusInfo.prioridade - b.statusInfo.prioridade;
    });
  }, [motoristas, cargasPorMotorista, escalaHojePorMotorista, veiculos, statusSelecionado, observacoesTemp]);

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
      statusRastreador: item.statusRastreador as 'online' | 'offline' | 'parado',
      ultimaMacro: item.ultimaMacro,
      rotaMonisat: item.rotaMonisat,
      cargaAtual: item.carga ? {
        coletaLocal: item.carga.coletaLocal,
        coletaCidade: item.carga.coletaCidade,
        entregaLocal: item.carga.entregaLocal,
        entregaCidade: item.carga.entregaCidade,
        observacoes: item.carga.observacoes
      } : undefined
    })) as DadosMapaVeiculo[];
  }, [dadosFiltrados]);

  // Função para aplicar filtro rápido pelo dashboard
  const aplicarFiltroDashboard = (statusFiltro: string) => {
    setFiltroStatus(statusFiltro);
    setFiltrosAbertos(true);
    // Scroll para a lista de cards
    setTimeout(() => {
      const element = document.getElementById('cards-container');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  // Função para criar ícone de caminhão personalizado
  const createTruckIcon = (status: string, statusCor: string) => {
    let statusText = '';
    let statusBg = statusCor;
    
    switch(status) {
      case 'seguindo_para_entrega':
        statusText = '🚛 EM ROTA';
        statusBg = '#22C55E';
        break;
      case 'chegou_entrega':
        statusText = '📍 CHEGOU';
        statusBg = '#3B82F6';
        break;
      case 'aguardando_carregamento':
        statusText = '⏳ AGUARDANDO';
        statusBg = '#FF9500';
        break;
      case 'programada':
        statusText = '📋 PROGRAMADO';
        statusBg = '#FFD700';
        break;
      default:
        statusText = '✅ PARADO';
        statusBg = '#6B7280';
    }
    
    const html = `
      <div style="position: relative; width: 40px; height: 40px;">
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: ${statusBg}; border: 3px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.3); transition: all 0.2s ease; font-size: 22px;">
          🚛
        </div>
        <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); font-size: 9px; font-weight: bold; color: white; background: rgba(0,0,0,0.8); padding: 2px 6px; border-radius: 12px; white-space: nowrap;">
          ${statusText}
        </div>
      </div>
    `;
    
    return L.divIcon({
      html,
      iconSize: [40, 40],
      className: 'custom-truck-marker',
      popupAnchor: [0, -20]
    });
  };

  // Inicializar e atualizar mapa
  useEffect(() => {
    if (visaoAtiva !== 'mapa') return;

    if (!mapRef.current) {
      const mapContainer = document.getElementById('map-container');
      if (!mapContainer) return;

      mapRef.current = L.map('map-container').setView([-15.7975, -47.8919], 4);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    Object.values(markersRef.current).forEach(marker => {
      mapRef.current?.removeLayer(marker);
    });
    markersRef.current = {};

    dadosMapa.forEach(item => {
      if (item.coordenadas?.lat && item.coordenadas?.lng) {
        const icon = createTruckIcon(item.status, item.statusCor);
        
        const popupContent = `
          <div style="font-family: Arial, sans-serif; font-size: 12px; color: #333; min-width: 220px; max-width: 280px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #eee;">
              <strong style="font-size: 14px; color: ${item.statusCor};">🚛 ${item.nome}</strong>
            </div>
            <div><strong>Placa:</strong> ${item.placa || '—'}</div>
            <div><strong>Status:</strong> <span style="color: ${item.statusCor};">${item.statusLabel}</span></div>
            <div><strong>Velocidade:</strong> ${item.velocidade > 0 ? `${item.velocidade} km/h` : 'Parado'}</div>
            ${item.ultimaMacro ? `<div><strong>Última Macro:</strong> ${item.ultimaMacro}</div>` : ''}
            ${item.rotaMonisat ? `<div><strong>Rota Monisat:</strong> <span style="font-size: 10px;">${item.rotaMonisat.substring(0, 50)}...</span></div>` : ''}
            <div><strong>Localização:</strong> ${item.localizacao?.substring(0, 40) || '—'}${item.localizacao && item.localizacao.length > 40 ? '...' : ''}</div>
            ${item.cargaAtual ? `
              <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #eee;">
                <div><strong>📦 Coleta:</strong> ${item.cargaAtual.coletaCidade}</div>
                <div><strong>📍 Entrega:</strong> ${item.cargaAtual.entregaCidade}</div>
                ${item.cargaAtual.observacoes ? `<div style="margin-top: 4px; color: #FFD700;"><strong>⚠️ Obs:</strong> ${item.cargaAtual.observacoes.substring(0, 50)}${item.cargaAtual.observacoes.length > 50 ? '...' : ''}</div>` : ''}
              </div>
            ` : ''}
            <div style="margin-top: 8px; font-size: 10px; color: #666;">
              ⏱️ ${formatarUltimaAtualizacao(item.ultimaAtualizacao)}
            </div>
          </div>
        `;

        const marker = L.marker([item.coordenadas.lat, item.coordenadas.lng], { icon }).addTo(mapRef.current!);
        marker.bindPopup(popupContent);
        markersRef.current[item.id] = marker;
      }
    });

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

  // Componente de Card Estatístico Clicável
  const StatCard = ({ title, value, icon, color, subtitle, onClick, filterValue }: any) => (
    <div
      onClick={() => onClick && onClick(filterValue)}
      style={{
        backgroundColor: '#0A0A0A',
        borderRadius: '16px',
        border: `1px solid ${color}30`,
        padding: '16px',
        transition: 'all 0.2s ease',
        cursor: onClick ? 'pointer' : 'default'
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = `0 4px 12px ${color}40`;
          e.currentTarget.style.borderColor = color;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = `${color}30`;
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

  // Componente de Recomendações
  const RecomendacoesWidget = () => {
    const recomendacoes = [];
    
    if (estatisticas.motoristasDisponiveis > 0) {
      recomendacoes.push({
        text: `${estatisticas.motoristasDisponiveis} motoristas disponíveis para programação`,
        filter: 'disponivel',
        color: '#10B981'
      });
    }
    
    if (estatisticas.emRota > 0) {
      recomendacoes.push({
        text: `${estatisticas.emRota} motoristas em rota - Acompanhar entregas`,
        filter: 'seguindo_para_entrega',
        color: '#22C55E'
      });
    }
    
    if (estatisticas.chegouEntrega > 0) {
      recomendacoes.push({
        text: `${estatisticas.chegouEntrega} motoristas chegaram na entrega - Aguardando descarga`,
        filter: 'chegou_entrega',
        color: '#3B82F6'
      });
    }
    
    if (estatisticas.aguardandoCarregamento > 0) {
      recomendacoes.push({
        text: `${estatisticas.aguardandoCarregamento} motoristas aguardando carregamento`,
        filter: 'aguardando_carregamento',
        color: '#FF9500'
      });
    }
    
    if (estatisticas.motoristasFolga > 0) {
      recomendacoes.push({
        text: `${estatisticas.motoristasFolga} motoristas em folga hoje`,
        filter: 'folga',
        color: '#8B5CF6'
      });
    }
    
    if (estatisticas.motoristasFerias > 0) {
      recomendacoes.push({
        text: `${estatisticas.motoristasFerias} motoristas de férias`,
        filter: 'ferias',
        color: '#8B5CF6'
      });
    }
    
    if (estatisticas.motoristasSemVeiculo > 0) {
      recomendacoes.push({
        text: `${estatisticas.motoristasSemVeiculo} motoristas sem veículo - Verificar alocação`,
        filter: 'sem_veiculo',
        color: '#EF4444'
      });
    }
    
    if (estatisticas.motoristasVeiculoManutencao > 0) {
      recomendacoes.push({
        text: `${estatisticas.motoristasVeiculoManutencao} veículos em manutenção`,
        filter: 'veiculo_manutencao',
        color: '#FF9500'
      });
    }
    
    if (estatisticas.veiculosOffline > 5) {
      recomendacoes.push({
        text: `${estatisticas.veiculosOffline} veículos offline - Verificar rastreadores`,
        filter: null,
        color: '#EF4444'
      });
    }
    
    const veiculosAltaVelocidade = dadosCombinados.filter(d => d.velocidade > 80).length;
    if (veiculosAltaVelocidade > 0) {
      recomendacoes.push({
        text: `${veiculosAltaVelocidade} veículos em alta velocidade`,
        filter: null,
        color: '#EF4444'
      });
    }
    
    const cargasAtrasadas = dadosCombinados.filter(d => d.coletaComAtraso).length;
    if (cargasAtrasadas > 0) {
      recomendacoes.push({
        text: `${cargasAtrasadas} cargas programadas com atraso na coleta`,
        filter: 'programada',
        color: '#EF4444'
      });
    }

    const cargasComObservacoes = dadosCombinados.filter(d => 
      d.carga && d.carga.observacoes && d.carga.observacoes.trim().length > 0
    ).length;
    if (cargasComObservacoes > 0) {
      recomendacoes.push({
        text: `${cargasComObservacoes} cargas com observações importantes`,
        filter: null,
        color: '#FFD700'
      });
    }
    
    const motoristasComObservacao = dadosCombinados.filter(d => d.observacao && d.observacao.trim().length > 0).length;
    if (motoristasComObservacao > 0) {
      recomendacoes.push({
        text: `${motoristasComObservacao} motoristas com observações cadastradas`,
        filter: null,
        color: '#FFD700'
      });
    }
    
    if (recomendacoes.length === 0) {
      recomendacoes.push({
        text: 'Tudo em ordem! Nenhuma ação urgente necessária.',
        filter: null,
        color: '#22C55E'
      });
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
              onClick={() => rec.filter && aplicarFiltroDashboard(rec.filter)}
              style={{
                padding: '10px',
                background: '#1A1A1A',
                borderRadius: '10px',
                fontSize: '13px',
                color: rec.color,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: rec.filter ? 'pointer' : 'default',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (rec.filter) {
                  e.currentTarget.style.backgroundColor = `${rec.color}20`;
                  e.currentTarget.style.transform = 'translateX(4px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1A1A1A';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <AlertCircle size={14} />
              <span>{rec.text}</span>
              {rec.filter && <ChevronDown size={12} style={{ marginLeft: 'auto', transform: 'rotate(-90deg)' }} />}
            </div>
          ))}
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
          {previsaoTempo.slice(0, 12).map((cidade, idx) => {
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
                  {cidade.cidade.length > 15 ? cidade.cidade.substring(0, 12) + '...' : cidade.cidade}
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

  // Componente de Card Informativo
  const CardInformativo = ({ item }: { item: typeof dadosCombinados[0] }) => {
    const temObservacoesMotorista = item.observacao && item.observacao.trim().length > 0;
    const temObservacoesCarga = item.carga?.observacoes && item.carga.observacoes.trim().length > 0;
    const mostrarObservacoes = showObservacoes[item.id] || false;
    const statusExibido = item.statusManual || item.statusInfo;

    // Determinar ícone da cidade
    const cidadeIcon = () => {
      if (item.coletaComAtraso) return '🔴';
      if (item.carga?.status === 'chegou_entrega') return '📍';
      if (item.carga?.status === 'seguindo_para_entrega') return '🚛';
      return '📍';
    };

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
            background: statusExibido.bg || '#1A1A1A',
            borderBottom: `1px solid ${statusExibido.cor || '#FFD700'}`,
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
                background: statusExibido.cor || '#FFD700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000'
              }}
            >
              {statusExibido.icon || <CheckCircle size={14} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#FFF' }}>
                {item.nome}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: statusExibido.cor || '#FFD700' }}>
                {statusExibido.label}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {item.precisaAtencao && (
              <div style={{ color: '#EF4444' }}>
                <AlertCircle size={20} />
              </div>
            )}
            {(temObservacoesMotorista || temObservacoesCarga) && (
              <div style={{ color: '#FFD700' }}>
                <MessageSquare size={20} />
              </div>
            )}
            {item.temMopp === 'Sim' && (
              <div style={{ color: '#22C55E' }}>
                <CheckCircle size={16} />
              </div>
            )}
          </div>
        </div>

        {/* Conteúdo do Card */}
        <div style={{ padding: '16px 20px' }}>
          {/* Informações Básicas */}
          <div style={{ fontSize: '13px', color: '#AAA', marginBottom: '12px' }}>
            {item.cidade || 'Cidade não informada'}
          </div>

          {/* Viagens Realizadas */}
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
            🚛 Viagens realizadas: {item.viagensRealizadas}
          </div>

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
              <div style={{ fontSize: '12px', color: '#FFF', marginBottom: '8px' }}>
                <strong>Placa:</strong> {item.carga.placa}
              </div>
              <div style={{ fontSize: '12px', color: item.coletaComAtraso ? '#EF4444' : '#AAA', marginBottom: '4px' }}>
                {item.coletaComAtraso ? '🔴' : '📍'} {item.carga.coletaCidade} → {item.carga.entregaCidade}
              </div>
              <div style={{ fontSize: '11px', color: item.coletaComAtraso ? '#EF4444' : '#888' }}>
                📅 Entrega: {item.dataEntregaFormatada}
              </div>
            </div>
          )}

          {/* Status quando sem programação e disponível */}
          {!item.carga && item.status === 'disponivel' && (
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
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#000', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #1A1A1A; border-radius: 3px; }
        ::-webkit-scrollbar-thumb { background: #FFD700; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #FFB700; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        #map-container { width: 100%; height: 100%; border-radius: 12px; overflow: hidden; }
        .custom-truck-marker { background: transparent; }
        .custom-truck-marker div { transition: transform 0.2s ease; }
        .custom-truck-marker:hover div { transform: scale(1.1); }
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

      {/* Cards de Estatísticas Expandidas - CLICÁVEIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard
          title="Total Motoristas"
          value={estatisticas.totalMotoristas}
          icon={<Users size={24} />}
          color="#FFD700"
          subtitle={`${estatisticas.motoristasComProgramacao} com carga`}
          onClick={aplicarFiltroDashboard}
          filterValue="todos"
        />
        <StatCard
          title="Total Veículos"
          value={estatisticas.totalVeiculos}
          icon={<Car size={24} />}
          color="#3B82F6"
          subtitle={`${estatisticas.veiculosOnline} online • ${estatisticas.veiculosOffline} offline`}
          onClick={() => {}}
          filterValue={null}
        />
        <StatCard
          title="Em Rota"
          value={estatisticas.emRota}
          icon={<Truck size={24} />}
          color="#22C55E"
          subtitle="Veículos em deslocamento"
          onClick={aplicarFiltroDashboard}
          filterValue="seguindo_para_entrega"
        />
        <StatCard
          title="Disponíveis"
          value={estatisticas.motoristasDisponiveis}
          icon={<CheckCircle size={24} />}
          color="#10B981"
          subtitle="Prontos para programar"
          onClick={aplicarFiltroDashboard}
          filterValue="disponivel"
        />
        <StatCard
          title="Folga/Férias"
          value={estatisticas.motoristasFolga + estatisticas.motoristasFerias}
          icon={<Moon size={24} />}
          color="#8B5CF6"
          subtitle={`${estatisticas.motoristasFolga} folga • ${estatisticas.motoristasFerias} férias`}
          onClick={aplicarFiltroDashboard}
          filterValue="folga"
        />
        <StatCard
          title="Sem Veículo"
          value={estatisticas.motoristasSemVeiculo}
          icon={<AlertTriangle size={24} />}
          color="#EF4444"
          subtitle="Aguardando veículo"
          onClick={aplicarFiltroDashboard}
          filterValue="sem_veiculo"
        />
        <StatCard
          title="Falta/Atestado"
          value={estatisticas.motoristasFalta + estatisticas.motoristasAtestado}
          icon={<XCircle size={24} />}
          color="#EF4444"
          subtitle={`${estatisticas.motoristasFalta} falta • ${estatisticas.motoristasAtestado} atestado`}
          onClick={aplicarFiltroDashboard}
          filterValue="falta"
        />
        <StatCard
          title="Eficiência"
          value={`${estatisticas.eficienciaFrota}%`}
          icon={<Target size={24} />}
          color="#FFD700"
          subtitle="Programados + Disponíveis"
          onClick={() => {}}
          filterValue={null}
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
                  {dadosMapa.filter(d => d.coordenadas).slice(0, 8).map(item => (
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
                  {dadosMapa.filter(d => d.coordenadas).length > 8 && (
                    <div style={{ textAlign: 'center', padding: '8px', color: '#666', fontSize: '11px' }}>
                      +{dadosMapa.filter(d => d.coordenadas).length - 8} veículos na lista completa
                    </div>
                  )}
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
                <option value="folga">😴 Folga</option>
                <option value="ferias">🏖️ Férias</option>
                <option value="disponivel">✅ Disponível</option>
                <option value="sem_veiculo">🚫 Sem Veículo</option>
                <option value="falta">❌ Falta</option>
                <option value="atestado">📋 Atestado</option>
                <option value="veiculo_manutencao">🔧 Veículo em Manutenção</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Grid de Cards ou Mapa Completo */}
      <div id="cards-container">
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
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
      </div>

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