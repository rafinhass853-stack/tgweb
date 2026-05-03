import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation, Form } from 'react-router-dom';
import { db, storage } from './firebase';
import {
  collection,
  onSnapshot,
  query,
  where,
  deleteDoc,
  doc,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import {
  Truck, MapPin, Calendar, Clock, AlertCircle, BarChart3, Printer, X, Search, 
  UserCheck, UserMinus, Edit3, Trash2, Flag, Camera, Images, 
  Navigation, Activity, RotateCcw, Filter, ChevronDown, MessageCircle, Save, Gauge, Bell
} from 'lucide-react';
import MotoristaMapaModal from './ListaMotoristaMapaModal';
import WhatsAppHistorico from './WhatsAppHistorico';
import WhatsAppChatModal from './WhatsAppChatModal';
import io from 'socket.io-client';

interface Motorista {
  id: string;
  nome: string;
  cpf: string;
  cidade?: string;
  whatsapp?: string;
  telefone?: string;
  cnhCategoria?: string;
  temMopp?: string;
  fotoPerfilUrl?: string;
  uid?: string;
  viagensRealizadas?: number;
}

interface CargaProgramada {
  id: string;
  docId?: string;
  dt: string;
  coletaCidade: string;
  coletaLocal: string;
  coletaData: string;
  entregaCidade: string;
  entregaLocal: string;
  entregaData: string;
  placa: string;
  carreta?: string;
  peso: string;
  status: string;
  tipo: string;
  veiculo: string;
  motorista: string;
  cpf: string;
  criadoEm?: any;
  motoristaId?: string;
  ultimoStatus?: string;
  chegadaColeta?: {
    dataHora: string;
    pontualidade: string;
    fotoUrl: string;
  };
  chegadaEntrega?: {
    dataHora: string;
    pontualidade: string;
  };
  inicioViagem?: {
    dataHora: string;
  };
}

interface EventoEscala {
  id: string;
  tipo: string;
  dataInicio: string;
  criadoEm: any;
}

interface CheckinInfo {
  id: string;
  tipo: string;
  timestamp: any;
  fotoUrl?: string;
  dataHora?: string;
  pontualidade?: string;
  localizacaoReal?: string;
}

interface CanhotoInfo {
  url: string;
  name: string;
  fullPath: string;
}

interface VeiculoData {
  placa: string;
  ultimaLocalizacao?: string;
  ultimaAtualizacaoRastreador?: any;
  statusRastreador?: string;
  velocidade?: number;
  coordenadas?: { lat: number; lng: number };
  ultimaMacro?: string;
  ignicao?: string;
}

interface EscalaInfo {
  diasConsecutivosTrabalhados: number;
  precisaFolgar: boolean;
  porcentagemPresenca: number;
}

interface ListaMotoristasProps {
  onSelectMotorista: (id: string) => void;
}

interface Notification {
  id: string;
  from: string;
  message: string;
  timestamp: Date;
  telefone: string;
}

const TIPOS_ESCALA = {
  'Presente': { label: 'Disponível para Programar', icon: '✅', cor: '#22C55E', bg: '#1A2A1A' },
  'Descanso Semanal': { label: 'Em Folga Hoje', icon: '😴', cor: '#FFD700', bg: '#3A2A1A' },
  'Férias': { label: 'Em Folga Hoje', icon: '🏖️', cor: '#FFD700', bg: '#3A2A1A' },
  'Falta': { label: 'Falta', icon: '❌', cor: '#EF4444', bg: '#3A1A1A' },
  'Atestado': { label: 'Atestado', icon: '📋', cor: '#8B5CF6', bg: '#2A1A3A' },
};

const STATUS_CARGA_MAP: Record<string, { label: string; cor: string; bg: string; icon: string }> = {
  'programada': { label: 'Programado', cor: '#FFD700', bg: '#FFD70020', icon: '📋' },
  'aguardando_carregamento': { label: 'Aguardando Carregamento', cor: '#FF9500', bg: '#FF950020', icon: '⏳' },
  'seguindo_para_entrega': { label: 'Seguindo para a Entrega', cor: '#22C55E', bg: '#22C55E20', icon: '🚛' },
  'chegou_entrega': { label: 'Chegou na Entrega', cor: '#3B82F6', bg: '#3B82F620', icon: '📍' },
};

const STATUS_ATIVOS = ['programada', 'aguardando_carregamento', 'seguindo_para_entrega', 'chegou_entrega'];

const ListaMotoristas: React.FC<ListaMotoristasProps> = ({ onSelectMotorista }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [cargasPorMotorista, setCargasPorMotorista] = useState<Record<string, CargaProgramada | null>>({});
  const [escalaHojePorMotorista, setEscalaHojePorMotorista] = useState<Record<string, EventoEscala | null>>({});
  const [escalaInfoPorMotorista, setEscalaInfoPorMotorista] = useState<Record<string, EscalaInfo>>({});
  const [veiculos, setVeiculos] = useState<Record<string, VeiculoData>>({});
  const [observacoesMotoristas, setObservacoesMotoristas] = useState<Record<string, string>>({});
  const [observacaoEditando, setObservacaoEditando] = useState<string | null>(null);
  const [anotacoesMotoristas, setAnotacoesMotoristas] = useState<Record<string, string>>({});
  const [anotacaoEditando, setAnotacaoEditando] = useState<string | null>(null);
  
  // FILTROS
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroStatusProgramacao, setFiltroStatusProgramacao] = useState<'todos' | 'comProgramacao' | 'semProgramacao'>('todos');
  const [filtroMopp, setFiltroMopp] = useState<'todos' | 'comMopp' | 'semMopp'>('todos');
  const [filtroStatusCarga, setFiltroStatusCarga] = useState<string>('todos');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroPlaca, setFiltroPlaca] = useState('');
  const [filtroRastreador, setFiltroRastreador] = useState<'todos' | 'online' | 'offline'>('todos');
  const [filtroClienteColeta, setFiltroClienteColeta] = useState('');
  const [filtroClienteEntrega, setFiltroClienteEntrega] = useState('');
  const [filtroDataEntrega, setFiltroDataEntrega] = useState('');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingEscalaInfo, setLoadingEscalaInfo] = useState<Record<string, boolean>>({});
  
  const [showEditCargaModal, setShowEditCargaModal] = useState(false);
  const [editandoCarga, setEditandoCarga] = useState<CargaProgramada | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedCargaForStatus, setSelectedCargaForStatus] = useState<CargaProgramada | null>(null);
  const [newStatus, setNewStatus] = useState('');
  
  const [checkinsPorMotorista, setCheckinsPorMotorista] = useState<Map<string, CheckinInfo>>(new Map());
  const [canhotosPorCarga, setCanhotosPorCarga] = useState<Map<string, CanhotoInfo[]>>(new Map());
  const [loadingCanhotos, setLoadingCanhotos] = useState<Map<string, boolean>>(new Map());
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showCanhotosModal, setShowCanhotosModal] = useState(false);
  const [canhotosModalData, setCanhotosModalData] = useState<{ canhotos: CanhotoInfo[], cargaNome: string } | null>(null);
  
  // MODAL MAPA
  const [mapaModalMotorista, setMapaModalMotorista] = useState<any>(null);
  
  // WHATSAPP STATES
  const [whatsappHistoricoOpen, setWhatsappHistoricoOpen] = useState<{ open: boolean; telefone: string; nome: string }>({
    open: false,
    telefone: '',
    nome: ''
  });
  const [whatsappChatModalOpen, setWhatsappChatModalOpen] = useState<{ open: boolean; telefone: string; nome: string }>({
    open: false,
    telefone: '',
    nome: ''
  });
  const [whatsappReady, setWhatsappReady] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef<any>(null);

  const hoje = new Date().toISOString().split('T')[0];

  // FUNÇÕES DO WHATSAPP
  const checkWhatsAppStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/whatsapp/status');
      const data = await response.json();
      setWhatsappReady(data.ready);
    } catch (error) {
      console.error('Erro ao verificar status do WhatsApp:', error);
      setWhatsappReady(false);
    }
  };

  const sendWhatsAppMessage = async (telefone: string, mensagem: string): Promise<boolean> => {
    if (!whatsappReady) {
      alert('⚠️ WhatsApp não está conectado!\n\nPara conectar:\n1. Certifique-se que o servidor backend está rodando (npm run server)\n2. Escaneie o QR Code que aparece no terminal do servidor');
      return false;
    }

    setSendingMessage(true);
    try {
      const response = await fetch('http://localhost:3001/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone, mensagem })
      });
      
      const data = await response.json();
      if (data.success) {
        return true;
      } else {
        alert('❌ Erro ao enviar mensagem');
        return false;
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('❌ Erro ao enviar mensagem');
      return false;
    } finally {
      setSendingMessage(false);
    }
  };

  // Função para abrir WhatsApp Web diretamente
  const abrirWhatsAppWeb = (telefone: string | undefined, nome: string) => {
    if (!telefone || telefone === '—' || telefone === 'Não informado') {
      alert(`⚠️ Número de telefone não disponível para ${nome}`);
      return;
    }

    let numeroLimpo = telefone.replace(/\D/g, '');
    
    if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
      if (!numeroLimpo.startsWith('55')) {
        numeroLimpo = '55' + numeroLimpo;
      }
    }
    
    const whatsappUrl = `https://web.whatsapp.com/send?phone=${numeroLimpo}`;
    window.open(whatsappUrl, '_blank');
  };

  // Função para abrir modal de chat WhatsApp
  const abrirWhatsAppChat = (telefone: string | undefined, nome: string) => {
    if (!telefone || telefone === '—' || telefone === 'Não informado') {
      alert(`⚠️ Número de telefone não disponível para ${nome}`);
      return;
    }
    setWhatsappChatModalOpen({ open: true, telefone, nome });
  };

  const abrirWhatsAppHistorico = (telefone: string | undefined, nome: string) => {
    if (!telefone || telefone === '—' || telefone === 'Não informado') {
      alert(`⚠️ Número de telefone não disponível para ${nome}`);
      return;
    }
    setWhatsappHistoricoOpen({ open: true, telefone, nome });
  };

  const addNotification = (from: string, message: string, telefone: string) => {
    const newNotification: Notification = {
      id: Date.now().toString(),
      from,
      message,
      timestamp: new Date(),
      telefone
    };
    setNotifications(prev => [newNotification, ...prev].slice(0, 50));
    setUnreadCount(prev => prev + 1);
    
    if (Notification.permission === 'granted' && document.hidden) {
      new Notification(`📱 Mensagem de ${from}`, { body: message });
    }
  };

  // Conectar ao socket para notificações em tempo real
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    checkWhatsAppStatus();
    
    socketRef.current = io('http://localhost:3001');
    
    socketRef.current.on('whatsapp_message_received', (msg: any) => {
      const telefoneLimpo = msg.from.replace(/\D/g, '');
      const motorista = motoristas.find(m => {
        const whatsappLimpo = m.whatsapp?.replace(/\D/g, '');
        const telefoneLimpoMotorista = m.telefone?.replace(/\D/g, '');
        return whatsappLimpo === telefoneLimpo || telefoneLimpoMotorista === telefoneLimpo;
      });
      
      const nomeMotorista = motorista?.nome || msg.from;
      addNotification(nomeMotorista, msg.body, telefoneLimpo);
    });
    
    const statusInterval = setInterval(checkWhatsAppStatus, 5000);
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      clearInterval(statusInterval);
    };
  }, [motoristas]);

  // RECUPERAR ESTADO AO VOLTAR DO RELATÓRIO
  useEffect(() => {
    const savedState = sessionStorage.getItem('listaMotoristasState');
    if (savedState && location.pathname === '/motoristas') {
      try {
        const state = JSON.parse(savedState);
        setFiltroTexto(state.filtroTexto || '');
        setFiltroStatusProgramacao(state.filtroStatusProgramacao || 'todos');
        setFiltroMopp(state.filtroMopp || 'todos');
        setFiltroStatusCarga(state.filtroStatusCarga || 'todos');
        setFiltroCidade(state.filtroCidade || '');
        setFiltroPlaca(state.filtroPlaca || '');
        setFiltroRastreador(state.filtroRastreador || 'todos');
        setFiltroClienteColeta(state.filtroClienteColeta || '');
        setFiltroClienteEntrega(state.filtroClienteEntrega || '');
        setFiltroDataEntrega(state.filtroDataEntrega || '');
        setFiltrosAbertos(state.filtrosAbertos || false);
        
        setTimeout(() => {
          window.scrollTo(0, state.scrollPosition || 0);
        }, 100);
        
        sessionStorage.removeItem('listaMotoristasState');
      } catch (error) {
        console.error('Erro ao restaurar estado:', error);
      }
    }
  }, [location.pathname]);

  // GARANTIR QUE O LAYOUT DO MENU PERMANEÇA
  useEffect(() => {
    const timeout = setTimeout(() => {
      const appContainer = document.querySelector('.app-container') as HTMLElement;
      const sidebar = document.querySelector('.sidebar') as HTMLElement;
      const mainContent = document.querySelector('.main-content') as HTMLElement;
      
      if (appContainer && sidebar && mainContent) {
        appContainer.style.display = 'flex';
        appContainer.style.minHeight = '100vh';
        sidebar.style.display = 'flex';
        sidebar.style.flexShrink = '0';
        mainContent.style.flex = '1';
        mainContent.style.width = '100%';
      }
    }, 50);
    
    return () => clearTimeout(timeout);
  }, []);

  const handleOpenRelatorio = () => {
    sessionStorage.setItem('listaMotoristasState', JSON.stringify({
      filtroTexto,
      filtroStatusProgramacao,
      filtroMopp,
      filtroStatusCarga,
      filtroCidade,
      filtroPlaca,
      filtroRastreador,
      filtroClienteColeta,
      filtroClienteEntrega,
      filtroDataEntrega,
      filtrosAbertos,
      scrollPosition: window.scrollY
    }));
    
    navigate('/relatorio-motoristas');
  };

  const calcularEscalaInfo = async (motoristaId: string): Promise<EscalaInfo> => {
    try {
      const escalasRef = collection(db, "motoristas", motoristaId, "escalas_motoristas");
      const escalasSnap = await getDocs(escalasRef);
      
      const eventos = escalasSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EventoEscala[];
      
      const eventosOrdenados = eventos.sort((a, b) => b.dataInicio.localeCompare(a.dataInicio));
      
      let diasConsecutivos = 0;
      for (const ev of eventosOrdenados) {
        if (ev.tipo === 'Descanso Semanal' || ev.tipo === 'Férias') {
          break;
        }
        if (ev.tipo === 'Presente') {
          diasConsecutivos++;
        }
      }
      
      const anoAtual = new Date().getFullYear();
      const eventosAno = eventos.filter(ev => {
        const dataEv = new Date(ev.dataInicio);
        return dataEv.getFullYear() === anoAtual;
      });
      
      let totalDiasAno = 0;
      let diasPresente = 0;
      
      eventosAno.forEach(ev => {
        totalDiasAno++;
        if (ev.tipo === 'Presente') {
          diasPresente++;
        }
      });
      
      const porcentagemPresenca = totalDiasAno > 0 ? (diasPresente / totalDiasAno) * 100 : 0;
      const precisaFolgar = diasConsecutivos >= 6;
      
      return {
        diasConsecutivosTrabalhados: diasConsecutivos,
        precisaFolgar: precisaFolgar,
        porcentagemPresenca: porcentagemPresenca
      };
    } catch (error) {
      console.error(`Erro ao calcular escala info para motorista ${motoristaId}:`, error);
      return {
        diasConsecutivosTrabalhados: 0,
        precisaFolgar: false,
        porcentagemPresenca: 0
      };
    }
  };

  useEffect(() => {
    if (motoristas.length === 0) return;
    
    const carregarInfoEscalas = async () => {
      for (const motorista of motoristas) {
        if (!motorista.id) continue;
        
        setLoadingEscalaInfo(prev => ({ ...prev, [motorista.id]: true }));
        const info = await calcularEscalaInfo(motorista.id);
        setEscalaInfoPorMotorista(prev => ({ ...prev, [motorista.id]: info }));
        setLoadingEscalaInfo(prev => ({ ...prev, [motorista.id]: false }));
      }
    };
    
    carregarInfoEscalas();
  }, [motoristas]);

  const getVelocidade = (veiculoData: VeiculoData | null | undefined): number => {
    if (!veiculoData) return 0;
    const vel = veiculoData.velocidade;
    if (typeof vel === 'number' && !isNaN(vel)) return vel;
    if (typeof vel === 'string') {
      const parsed = parseFloat(vel);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const getVelocidadeColor = (velocidade: number): string => {
    if (velocidade === 0) return '#666';
    if (velocidade < 60) return '#22C55E';
    if (velocidade <= 80) return '#FFD700';
    return '#EF4444';
  };

  const getVelocidadeIcon = (velocidade: number): string => {
    if (velocidade === 0) return '🛑';
    if (velocidade < 30) return '🐢';
    if (velocidade < 60) return '🚚';
    if (velocidade < 80) return '💨';
    return '⚡';
  };

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

  useEffect(() => {
    const savedObservacoes: Record<string, string> = {};
    motoristas.forEach(m => {
      const saved = localStorage.getItem(`observacao_motorista_${m.id}`);
      if (saved) {
        savedObservacoes[m.id] = saved;
      }
    });
    setObservacoesMotoristas(savedObservacoes);
  }, [motoristas]);

  useEffect(() => {
    const savedAnotacoes: Record<string, string> = {};
    motoristas.forEach(m => {
      const saved = localStorage.getItem(`anotacao_motorista_${m.id}`);
      if (saved) {
        savedAnotacoes[m.id] = saved;
      }
    });
    setAnotacoesMotoristas(savedAnotacoes);
  }, [motoristas]);

  const salvarObservacao = (motoristaId: string, observacao: string) => {
    setObservacoesMotoristas(prev => ({ ...prev, [motoristaId]: observacao }));
    localStorage.setItem(`observacao_motorista_${motoristaId}`, observacao);
    setObservacaoEditando(null);
    showNotification('Observação salva com sucesso!', 'success');
  };

  const salvarAnotacao = (motoristaId: string, anotacao: string) => {
    setAnotacoesMotoristas(prev => ({ ...prev, [motoristaId]: anotacao }));
    localStorage.setItem(`anotacao_motorista_${motoristaId}`, anotacao);
    setAnotacaoEditando(null);
    showNotification('Anotação salva com sucesso!', 'success');
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "veiculos"), (snap) => {
      const veiculosMap: Record<string, VeiculoData> = {};
      snap.forEach(doc => {
        const data = doc.data();
        
        let velocidadeNum = 0;
        if (data.velocidade !== undefined && data.velocidade !== null) {
          velocidadeNum = typeof data.velocidade === 'string' 
            ? parseFloat(data.velocidade) 
            : data.velocidade;
        }
        
        veiculosMap[data.placa] = {
          placa: data.placa,
          ultimaLocalizacao: data.ultimaLocalizacao || data.ultimoEndereco || '—',
          ultimaAtualizacaoRastreador: data.ultimaAtualizacaoRastreador || data.ultimaConsulta,
          statusRastreador: data.statusRastreador || 'offline',
          velocidade: isNaN(velocidadeNum) ? 0 : velocidadeNum,
          coordenadas: (data.coordenadas?.lat && data.coordenadas?.lng) 
            ? data.coordenadas 
            : (data.ultimaLatitude && data.ultimaLongitude)
              ? { lat: data.ultimaLatitude, lng: data.ultimaLongitude }
              : undefined,
          ultimaMacro: data.ultimaMacro || data.ultimoStatus || undefined,
          ignicao: data.ignicao || undefined
        };
      });
      setVeiculos(veiculosMap);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'motoristas'), async (snap) => {
      const lista = await Promise.all(snap.docs.map(async (docMotorista) => {
        const motoristaData = { id: docMotorista.id, ...docMotorista.data() } as Motorista;
        
        let viagensCount = 0;
        try {
          const cargasRef = collection(db, 'motoristas', docMotorista.id, 'cargas');
          const cargasSnap = await getDocs(cargasRef);
          viagensCount = cargasSnap.docs.filter(docCarga => docCarga.data().status === 'finalizada').length;
        } catch (error) {
          console.error(`Erro ao contar viagens do motorista ${motoristaData.nome}:`, error);
        }
        
        return { ...motoristaData, viagensRealizadas: viagensCount };
      }));
      setMotoristas(lista);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (motoristas.length === 0) {
      setCargasPorMotorista({});
      return;
    }

    const unsubscribers: (() => void)[] = [];

    motoristas.forEach((motorista) => {
      if (!motorista.id) return;

      const cargasRef = collection(db, 'motoristas', motorista.id, 'cargas');
      const q = query(
        cargasRef,
        where('status', 'in', STATUS_ATIVOS),
        orderBy('criadoEm', 'desc'),
        limit(1)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setCargasPorMotorista(prev => {
          if (snapshot.empty) {
            return { ...prev, [motorista.id]: null };
          }
          const doc = snapshot.docs[0];
          const cargaData = doc.data();
          const novaCarga: CargaProgramada = {
            id: doc.id,
            docId: doc.ref.path,
            motoristaId: motorista.id,
            ...cargaData
          } as CargaProgramada;
          return { ...prev, [motorista.id]: novaCarga };
        });
      }, (error) => {
        console.error(`Erro ao buscar cargas do motorista ${motorista.nome}:`, error);
        setCargasPorMotorista(prev => ({ ...prev, [motorista.id]: null }));
      });

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [motoristas]);

  useEffect(() => {
    if (motoristas.length === 0) {
      setEscalaHojePorMotorista({});
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
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
          const evento = { id: doc.id, ...doc.data() } as EventoEscala;
          setEscalaHojePorMotorista(prev => ({ ...prev, [motorista.id]: evento }));
        }
        setLoadingData(false);
      }, (error) => {
        console.error(`Erro ao buscar escala do motorista ${motorista.nome}:`, error);
        setEscalaHojePorMotorista(prev => ({ ...prev, [motorista.id]: null }));
        setLoadingData(false);
      });

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [motoristas, hoje]);

  const recalcularPontualidade = (checkinInfo: CheckinInfo, carga: CargaProgramada): CheckinInfo => {
    if (!checkinInfo.dataHora || !carga) return checkinInfo;
    
    const checkinDate = new Date(checkinInfo.dataHora);
    let dataReferencia: Date | null = null;
    
    if (checkinInfo.tipo === 'chegada_coleta' && carga.coletaData) {
      dataReferencia = new Date(carga.coletaData);
    } else if (checkinInfo.tipo === 'chegada_entrega' && carga.entregaData) {
      dataReferencia = new Date(carga.entregaData);
    }
    
    if (dataReferencia) {
      const diffHoras = (checkinDate.getTime() - dataReferencia.getTime()) / (1000 * 60 * 60);
      const pontualidade = diffHoras <= 1 ? 'On Time' : 'No Show';
      return { ...checkinInfo, pontualidade };
    }
    
    return checkinInfo;
  };

  useEffect(() => {
    motoristas.forEach(async (motorista) => {
      const carga = cargasPorMotorista[motorista.id];
      if (!carga || !motorista.id) return;

      try {
        const checkinsQuery = query(
          collection(db, "motoristas", motorista.id, "historicoCheckins"),
          orderBy("timestamp", "desc"),
          limit(1)
        );
        const checkinsSnap = await getDocs(checkinsQuery);
        
        if (!checkinsSnap.empty) {
          const data = checkinsSnap.docs[0].data();
          let checkinInfo: CheckinInfo = {
            id: checkinsSnap.docs[0].id,
            tipo: data.tipo || "Não informado",
            timestamp: data.timestamp,
            fotoUrl: data.fotoUrl,
            dataHora: data.dataHora,
            pontualidade: data.pontualidade,
            localizacaoReal: data.localizacaoReal || data.cidadeMotorista
          };
          
          checkinInfo = recalcularPontualidade(checkinInfo, carga);
          
          setCheckinsPorMotorista(prev => new Map(prev).set(motorista.id, checkinInfo));
        }
      } catch (error) {
        console.error("Erro ao buscar check-in:", error);
      }

      if (carga.id) {
        buscarCanhotos(carga.id, motorista.nome);
      }
    });
  }, [cargasPorMotorista]);

  const buscarCanhotos = async (cargaId: string, motoristaNome: string) => {
    setLoadingCanhotos(prev => new Map(prev).set(cargaId, true));
    
    try {
      const viagensRef = ref(storage, 'viagens');
      const viagensResult = await listAll(viagensRef);
      const canhotosEncontrados: CanhotoInfo[] = [];
      
      for (const viagemFolder of viagensResult.prefixes) {
        const arquivosResult = await listAll(viagemFolder);
        
        for (const arquivo of arquivosResult.items) {
          if (arquivo.name.toLowerCase().includes(cargaId.toLowerCase()) && 
              arquivo.name.toLowerCase().includes('canhoto')) {
            const url = await getDownloadURL(arquivo);
            canhotosEncontrados.push({
              url,
              name: arquivo.name,
              fullPath: arquivo.fullPath
            });
          }
        }
      }
      
      setCanhotosPorCarga(prev => new Map(prev).set(cargaId, canhotosEncontrados));
    } catch (error) {
      console.error("Erro ao buscar canhotos:", error);
    } finally {
      setLoadingCanhotos(prev => {
        const newMap = new Map(prev);
        newMap.delete(cargaId);
        return newMap;
      });
    }
  };

  const handleDeleteMotorista = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'motoristas', id));
      setShowDeleteConfirm(null);
      showNotification('Motorista excluído com sucesso!', 'success');
    } catch {
      showNotification('Erro ao excluir motorista', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditarCarga = async () => {
    if (!editandoCarga || !editandoCarga.motoristaId || !editandoCarga.id) {
      showNotification('❌ Erro: Dados da carga não encontrados', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const cargaRef = doc(db, "motoristas", editandoCarga.motoristaId, "cargas", editandoCarga.id);
      const { id, docId, motoristaId: _, criadoEm, ...dadosParaAtualizar } = editandoCarga;
      await updateDoc(cargaRef, dadosParaAtualizar);
      
      const motoristaIdAtual = editandoCarga.motoristaId;
      const checkinAtual = checkinsPorMotorista.get(motoristaIdAtual);
      
      if (checkinAtual) {
        const checkinRecalculado = recalcularPontualidade(checkinAtual, editandoCarga);
        setCheckinsPorMotorista(prev => new Map(prev).set(motoristaIdAtual, checkinRecalculado));
      }
      
      showNotification("✅ Carga atualizada com sucesso!", "success");
      setShowEditCargaModal(false);
      setEditandoCarga(null);
    } catch (err) {
      console.error(err);
      showNotification("❌ Erro ao atualizar carga.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAlterarStatus = async () => {
    if (!selectedCargaForStatus || !newStatus) {
      showNotification('❌ Erro: Dados da carga não encontrados', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const cargaRef = doc(db, "motoristas", selectedCargaForStatus.motoristaId!, "cargas", selectedCargaForStatus.id!);
      
      const finalStatus = newStatus;
      
      await updateDoc(cargaRef, { 
        ultimoStatus: finalStatus,
        status: finalStatus,
        dataUltimoStatus: serverTimestamp(),
        [`statusHistory.${new Date().toISOString()}`]: {
          status: finalStatus,
          dataHora: new Date().toISOString(),
          alteradoPor: 'gestor'
        }
      });
      
      setCargasPorMotorista(prev => {
        const cargaAtualizada = { ...selectedCargaForStatus, status: finalStatus, ultimoStatus: finalStatus };
        return { ...prev, [selectedCargaForStatus.motoristaId!]: cargaAtualizada };
      });
      
      const statusLabel = STATUS_CARGA_MAP[finalStatus]?.label || finalStatus;
      showNotification(`✅ Status alterado para: ${statusLabel}`, "success");
      setShowStatusModal(false);
      setSelectedCargaForStatus(null);
      setNewStatus('');
    } catch (err) {
      console.error(err);
      showNotification('❌ Erro ao alterar status.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirCarga = async (carga: CargaProgramada) => {
    if (!carga || !carga.motoristaId || !carga.id) {
      showNotification('❌ Erro: Dados da carga não encontrados', 'error');
      return;
    }
    
    if (!window.confirm(`Deseja excluir a carga do motorista ${carga.motorista}?`)) return;
    
    setLoading(true);
    try {
      await deleteDoc(doc(db, "motoristas", carga.motoristaId, "cargas", carga.id));
      showNotification("✅ Carga excluída com sucesso!", "success");
    } catch (err) {
      console.error(err);
      showNotification("❌ Erro ao excluir carga.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizarCarga = async (carga: CargaProgramada) => {
    if (!carga || !carga.motoristaId || !carga.id) {
      showNotification('❌ Erro: Dados da carga não encontrados', 'error');
      return;
    }
    
    if (!window.confirm(`Deseja finalizar a carga do motorista ${carga.motorista}?`)) return;
    
    setLoading(true);
    try {
      const cargaRef = doc(db, "motoristas", carga.motoristaId, "cargas", carga.id);
      await updateDoc(cargaRef, { 
        status: 'finalizada',
        dataFinalizacao: serverTimestamp()
      });
      
      showNotification("✅ Carga finalizada com sucesso!", "success");
    } catch (err) {
      console.error(err);
      showNotification("❌ Erro ao finalizar carga.", "error");
    } finally {
      setLoading(false);
    }
  };

  const getCheckinLabel = (tipo: string) => {
    const labels: any = {
      'chegada_coleta': '✅ Chegada na Coleta',
      'saida_coleta': '🚚 Saída da Coleta',
      'chegada_entrega': '🏭 Chegada na Entrega',
      'saida_entrega': '✅ Saída da Entrega',
      'inicio_viagem': '🚛 Início da Viagem'
    };
    return labels[tipo] || tipo;
  };

  const getStatusMotorista = (motorista: Motorista, carga: CargaProgramada | null, eventoEscala: EventoEscala | null) => {
    if (eventoEscala) {
      if (eventoEscala.tipo === 'Descanso Semanal' || eventoEscala.tipo === 'Férias') {
        return { label: 'Em Folga Hoje', cor: '#FFD700', bg: '#FFD70020', icon: '😴', value: 'folga' };
      }
      if (eventoEscala.tipo === 'Presente' && !carga) {
        return { label: 'Disponível para Programar', cor: '#22C55E', bg: '#22C55E20', icon: '✅', value: 'disponivel' };
      }
    }
    
    if (carga) {
      const statusCarga = STATUS_CARGA_MAP[carga.status];
      if (statusCarga) {
        return { ...statusCarga, value: carga.status };
      }
    }
    
    if (!eventoEscala || eventoEscala.tipo === 'Presente') {
      return { label: 'Disponível para Programar', cor: '#22C55E', bg: '#22C55E20', icon: '✅', value: 'disponivel' };
    }
    
    return { label: 'Status Indefinido', cor: '#666', bg: '#666620', icon: '❓', value: 'indefinido' };
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `position: fixed; bottom: 20px; right: 20px; padding: 14px 26px; background: ${type === 'success' ? '#22C55E' : '#EF4444'}; color: #000; border-radius: 14px; font-weight: 700; z-index: 10000;`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3200);
  };

  const motoristasFiltrados = useMemo(() => {
    return motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      const temProgramacao = carga !== null && carga !== undefined;
      const temMopp = m.temMopp === 'Sim';
      const veiculoData = carga?.placa ? veiculos[carga.placa] : null;
      const rastreadorOnline = veiculoData?.statusRastreador === 'online';

      const matchTexto =
        m.nome?.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        m.cpf?.includes(filtroTexto) ||
        m.cidade?.toLowerCase().includes(filtroTexto.toLowerCase());

      let matchProgramacao = true;
      if (filtroStatusProgramacao === 'comProgramacao') matchProgramacao = temProgramacao;
      if (filtroStatusProgramacao === 'semProgramacao') matchProgramacao = !temProgramacao;

      let matchMopp = true;
      if (filtroMopp === 'comMopp') matchMopp = temMopp;
      if (filtroMopp === 'semMopp') matchMopp = !temMopp;

      let matchStatusCarga = true;
      if (filtroStatusCarga !== 'todos' && carga) {
        matchStatusCarga = carga.status === filtroStatusCarga;
      } else if (filtroStatusCarga !== 'todos' && !carga) {
        matchStatusCarga = false;
      }

      const matchCidade = filtroCidade === '' || 
        m.cidade?.toLowerCase().includes(filtroCidade.toLowerCase());

      const matchPlaca = filtroPlaca === '' || 
        carga?.placa?.toLowerCase().includes(filtroPlaca.toLowerCase());

      const matchRastreador = filtroRastreador === 'todos' ||
        (filtroRastreador === 'online' && rastreadorOnline) ||
        (filtroRastreador === 'offline' && !rastreadorOnline);

      const matchClienteColeta = filtroClienteColeta === '' || 
        carga?.coletaLocal?.toLowerCase().includes(filtroClienteColeta.toLowerCase()) ||
        carga?.coletaCidade?.toLowerCase().includes(filtroClienteColeta.toLowerCase());

      const matchClienteEntrega = filtroClienteEntrega === '' || 
        carga?.entregaLocal?.toLowerCase().includes(filtroClienteEntrega.toLowerCase()) ||
        carga?.entregaCidade?.toLowerCase().includes(filtroClienteEntrega.toLowerCase());

      const matchDataEntrega = filtroDataEntrega === '' || 
        (carga && carga.entregaData?.includes(filtroDataEntrega));

      return matchTexto && matchProgramacao && matchMopp && matchStatusCarga && matchCidade && 
             matchPlaca && matchRastreador && matchClienteColeta && 
             matchClienteEntrega && matchDataEntrega;
    });
  }, [motoristas, cargasPorMotorista, veiculos, filtroTexto, filtroStatusProgramacao, filtroMopp, 
      filtroStatusCarga, filtroCidade, filtroPlaca, filtroRastreador, filtroClienteColeta, 
      filtroClienteEntrega, filtroDataEntrega]);

  const limparTodosFiltros = () => {
    setFiltroTexto('');
    setFiltroStatusProgramacao('todos');
    setFiltroMopp('todos');
    setFiltroStatusCarga('todos');
    setFiltroCidade('');
    setFiltroPlaca('');
    setFiltroRastreador('todos');
    setFiltroClienteColeta('');
    setFiltroClienteEntrega('');
    setFiltroDataEntrega('');
  };

  const temFiltrosAtivos = () => {
    return filtroTexto !== '' || filtroStatusProgramacao !== 'todos' || filtroMopp !== 'todos' ||
           filtroStatusCarga !== 'todos' || filtroCidade !== '' || filtroPlaca !== '' || 
           filtroRastreador !== 'todos' || filtroClienteColeta !== '' || 
           filtroClienteEntrega !== '' || filtroDataEntrega !== '';
  };

  const stats = useMemo(() => {
    const total = motoristas.length;
    const comProgramacao = motoristas.filter(m => cargasPorMotorista[m.id] !== null && cargasPorMotorista[m.id] !== undefined).length;
    const semProgramacao = total - comProgramacao;
    const comMopp = motoristas.filter(m => m.temMopp === 'Sim').length;
    const semMopp = total - comMopp;
    const totalViagens = motoristas.reduce((sum, m) => sum + (m.viagensRealizadas || 0), 0);
    return { total, comProgramacao, semProgramacao, comMopp, semMopp, totalViagens };
  }, [motoristas, cargasPorMotorista]);

  const getInitials = (nome: string) => nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const getRandomColor = (id: string) => {
    const colors = ['#FFD700', '#FFB700', '#FF9500', '#FF7B00', '#FFC300'];
    return colors[parseInt(id.slice(0, 8), 16) % colors.length];
  };

  const handleCardClick = (motorista: Motorista, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onSelectMotorista(motorista.id);
  };

  // ESTILOS
  const containerStyle: React.CSSProperties = { padding: '40px 20px', backgroundColor: '#000', fontFamily: 'Inter, sans-serif', width: '100%' };
  const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' };
  const titleStyle: React.CSSProperties = { fontSize: '32px', fontWeight: 900, color: '#FFF', margin: 0 };
  const subtitleStyle: React.CSSProperties = { margin: '8px 0 0 0', color: '#666', fontSize: '14px' };
  const reportBtnStyle: React.CSSProperties = { backgroundColor: '#FFD700', color: '#000', padding: '10px 20px', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' };
  const statsContainerStyle: React.CSSProperties = { display: 'flex', gap: '24px', backgroundColor: '#0A0A0A', padding: '12px 24px', borderRadius: '16px', border: '1px solid #1A1A1A' };
  const statItemStyle: React.CSSProperties = { textAlign: 'center' };
  const statNumberStyle: React.CSSProperties = { fontSize: '20px', fontWeight: 800, color: '#FFF', margin: 0 };
  const statLabelStyle: React.CSSProperties = { fontSize: '11px', color: '#666', textTransform: 'uppercase', fontWeight: 700, marginTop: '4px' };
  
  const filtersContainerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '20px' };
  const filterBtnStyle: React.CSSProperties = { background: '#0f0f0f', border: '1px solid #27272a', borderRadius: '14px', padding: '11px 20px', color: '#e5e7eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '500' };
  const filterBtnActiveStyle: React.CSSProperties = { borderColor: '#FFD700', color: '#FFD700', background: 'rgba(255,215,0,0.07)' };
  const clearAllBtnStyle: React.CSSProperties = { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '14px', padding: '11px 18px', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' };
  const filtersPanelStyle: React.CSSProperties = { background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: '18px', marginBottom: '28px', padding: '20px 24px' };
  const filtersGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' };
  const filterInputStyle: React.CSSProperties = { background: '#111', border: '1px solid #27272a', borderRadius: '12px', padding: '10px 16px', fontSize: '13px', color: '#e5e7eb', outline: 'none' };
  
  const searchWrapperStyle: React.CSSProperties = { position: 'relative', flexGrow: 1, maxWidth: '400px' };
  const searchIconStyle: React.CSSProperties = { position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' };
  const searchInputStyle: React.CSSProperties = { width: '100%', padding: '12px 12px 12px 48px', borderRadius: '12px', border: '1px solid #333', fontSize: '15px', outline: 'none', backgroundColor: '#1A1A1A', color: '#FFF' };
  const clearButtonStyle: React.CSSProperties = { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '18px' };
  
  const selectsContainerStyle: React.CSSProperties = { display: 'flex', gap: '16px', flexWrap: 'wrap' };
  const filterGroupStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '6px' };
  const filterLabelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: '#666' };
  const selectStyle: React.CSSProperties = { padding: '10px 14px', borderRadius: '10px', border: '1px solid #333', fontSize: '14px', outline: 'none', backgroundColor: '#1A1A1A', color: '#FFF' };
  
  const emptyStateStyle: React.CSSProperties = { textAlign: 'center', padding: '60px 20px', color: '#666', backgroundColor: '#0A0A0A', borderRadius: '24px', border: '1px solid #1A1A1A', marginTop: '32px' };
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '24px' };

  // Estilos dos cards (mantidos os mesmos do seu código original)
  const cardStyle: React.CSSProperties = { backgroundColor: '#0A0A0A', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)', border: '1px solid #1A1A1A', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s' };
  const fotoWrapperStyle: React.CSSProperties = { height: '100px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: '40px', fontWeight: 800 };
  const fotoStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 };
  const initialsStyle: React.CSSProperties = { zIndex: 1 };
  const moppBadgeStyle: React.CSSProperties = { position: 'absolute', bottom: '10px', right: '10px', backgroundColor: 'rgba(0,0,0,0.7)', color: '#FFF', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600 };
  const contentStyle: React.CSSProperties = { padding: '20px' };
  const nomeStyle: React.CSSProperties = { fontSize: '18px', fontWeight: 800, color: '#FFF', margin: '0 0 4px 0' };
  const cpfStyle: React.CSSProperties = { fontSize: '13px', color: '#888', margin: '0 0 12px 0' };
  const infoGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' };
  const infoItemStyle: React.CSSProperties = { fontSize: '12px', color: '#AAA', display: 'flex', alignItems: 'center', gap: '6px' };
  const infoEscalaCardStyle: React.CSSProperties = { backgroundColor: '#1A1A2A', borderRadius: '12px', padding: '8px 12px', marginBottom: '12px', border: '1px solid #2A2A3A' };
  const infoEscalaRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const infoEscalaLabelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 600, color: '#888', textTransform: 'uppercase' };
  const infoEscalaValueStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: '#FFD700' };
  const anotacaoContainerStyle: React.CSSProperties = { marginTop: '12px', marginBottom: '12px', padding: '10px', backgroundColor: '#1A1A2A', borderRadius: '10px', borderLeft: `3px solid #FFD700` };
  const anotacaoTextStyle: React.CSSProperties = { fontSize: '11px', color: '#DDD', margin: '4px 0', wordBreak: 'break-word' };
  const anotacaoInputStyle: React.CSSProperties = { width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #FFD700', fontSize: '11px', backgroundColor: '#111', color: '#FFF', marginTop: '8px' };
  const programacaoContainerStyle: React.CSSProperties = { borderTop: '1px solid #1F1F1F', paddingTop: '16px', marginTop: '8px' };
  const programacaoHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' };
  const programacaoTitleStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 800, color: '#AAA', textTransform: 'uppercase', margin: 0 };
  const programacaoStatusStyle = (color: string, bg: string): React.CSSProperties => ({ padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, backgroundColor: bg, color: color });
  const programacaoInfoStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#AAA', marginBottom: '6px' };
  const programacaoPlacaStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: '#FFD700' };
  const monitoriaCardStyle: React.CSSProperties = { backgroundColor: '#1A1A1A', borderRadius: '12px', padding: '12px', marginTop: '12px', border: '1px solid #333' };
  const monitoriaRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' };
  const monitoriaLabelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: '#666', textTransform: 'uppercase' };
  const monitoriaValueStyle: React.CSSProperties = { fontSize: '11px', fontWeight: 600, color: '#FFF' };
  const buttonGroupStyle: React.CSSProperties = { display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' };
  const smallButtonStyle: React.CSSProperties = { padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 600 };
  const actionButtonsStyle: React.CSSProperties = { display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' };
  const actionButtonStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: '10px', backgroundColor: '#1A1A1A', color: '#AAA', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, border: '1px solid #333' };
  
  const deleteConfirmModalStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
  const deleteConfirmContentStyle: React.CSSProperties = { backgroundColor: '#0A0A0A', padding: '30px', borderRadius: '15px', textAlign: 'center', boxShadow: '0 5px 15px rgba(0,0,0,0.5)', border: '1px solid #1A1A1A' };
  const deleteConfirmButtonsStyle: React.CSSProperties = { display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '25px' };
  const deleteConfirmBtnStyle: React.CSSProperties = { padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 600 };
  const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' };
  const modalContentStyle: React.CSSProperties = { backgroundColor: '#0A0A0A', borderRadius: '24px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #FFD700' };
  const modalHeaderStyle: React.CSSProperties = { padding: '20px 24px', borderBottom: '1px solid #1A1A1A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const modalBodyStyle: React.CSSProperties = { padding: '24px' };
  const formGroupStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' };
  const formLabelStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: '#AAA' };
  const formInputStyle: React.CSSProperties = { padding: '12px 16px', borderRadius: '12px', border: '1px solid #333', fontSize: '14px', outline: 'none', backgroundColor: '#111', color: '#FFF' };
  const formGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' };
  const btnPrimaryStyle: React.CSSProperties = { backgroundColor: '#FFD700', color: '#000', padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' };
  const btnSecondaryStyle: React.CSSProperties = { backgroundColor: '#1A1A1A', color: '#AAA', padding: '12px 24px', borderRadius: '12px', border: '1px solid #333', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };
  const btnCloseStyle: React.CSSProperties = { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', border: 'none', borderRadius: '50%', width: '35px', height: '35px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const galeriaGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', marginTop: '16px' };
  const thumbnailStyle: React.CSSProperties = { width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #333', cursor: 'pointer' };

  const notificationsOverlayStyle: React.CSSProperties = { position: 'fixed', top: 80, right: 20, zIndex: 10000 };
  const notificationsPanelStyle: React.CSSProperties = { backgroundColor: '#0A0A0A', borderRadius: '16px', width: '320px', maxHeight: '400px', border: '1px solid #FFD700', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' };
  const notificationsHeaderStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid #1A1A1A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const notificationsListStyle: React.CSSProperties = { maxHeight: '350px', overflowY: 'auto' };
  const notificationItemStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid #1A1A1A', cursor: 'pointer' };
  const notificationFromStyle: React.CSSProperties = { fontWeight: 'bold', color: '#FFD700', fontSize: '13px' };
  const notificationMessageStyle: React.CSSProperties = { color: '#FFF', fontSize: '12px', marginTop: '4px', wordBreak: 'break-word' };
  const notificationTimeStyle: React.CSSProperties = { color: '#666', fontSize: '10px', marginTop: '4px' };
  const emptyNotificationsStyle: React.CSSProperties = { textAlign: 'center', padding: '40px', color: '#666' };

  return (
    <div style={containerStyle} className="motoristas-list-container">
      <style>{`
        * { box-sizing: border-box; }
        input:focus, select:focus, textarea:focus { border-color: #FFD700!important; outline: none; }
        button:hover { transform: translateY(-1px); filter: brightness(0.98); }
        .thumbnail-hover:hover { transform: scale(1.05); border-color: #FFD700; }
      `}</style>

      {/* PAINEL DE NOTIFICAÇÕES */}
      {showNotifications && (
        <div style={notificationsOverlayStyle} onClick={() => setShowNotifications(false)}>
          <div style={notificationsPanelStyle} onClick={e => e.stopPropagation()}>
            <div style={notificationsHeaderStyle}>
              <h3 style={{ margin: 0, color: '#FFF', fontSize: '14px' }}>📬 Notificações</h3>
              <button onClick={() => { setShowNotifications(false); setUnreadCount(0); }} style={btnCloseStyle}>✕</button>
            </div>
            <div style={notificationsListStyle}>
              {notifications.length === 0 ? (
                <p style={emptyNotificationsStyle}>Nenhuma notificação</p>
              ) : (
                notifications.map(notif => (
                  <div key={notif.id} style={notificationItemStyle} onClick={() => { abrirWhatsAppHistorico(notif.telefone, notif.from); setShowNotifications(false); setUnreadCount(0); }}>
                    <div style={notificationFromStyle}>{notif.from}</div>
                    <div style={notificationMessageStyle}>{notif.message}</div>
                    <div style={notificationTimeStyle}>{notif.timestamp.toLocaleTimeString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>👥 Motoristas Cadastrados</h1>
          <p style={subtitleStyle}>Gerencie sua equipe de motoristas</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button style={{ ...reportBtnStyle, backgroundColor: '#3B82F6', color: '#FFF', position: 'relative' }} onClick={() => setShowNotifications(!showNotifications)}>
            <Bell size={18} />
            {unreadCount > 0 && <span style={{ position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount}</span>}
          </button>
          <button style={{ ...reportBtnStyle, backgroundColor: whatsappReady ? '#075E54' : '#25D366', color: '#FFF' }} onClick={() => { if (!whatsappReady) alert('⚠️ WhatsApp não está conectado!\n\nPara conectar:\n1. Certifique-se que o servidor backend está rodando (npm run server)\n2. Escaneie o QR Code que aparece no terminal do servidor'); else alert('✅ WhatsApp conectado! Clique nos botões do motorista para conversar.'); }}>
            <MessageCircle size={18} /> {whatsappReady ? 'WhatsApp Conectado' : 'Conectar WhatsApp'}
          </button>
          <button style={reportBtnStyle} onClick={handleOpenRelatorio}><BarChart3 size={18} /> Relatório</button>
          <div style={statsContainerStyle}>
            <div style={statItemStyle}><span style={statNumberStyle}>{stats.total}</span><span style={statLabelStyle}>Total</span></div>
            <div style={statItemStyle}><span style={{ ...statNumberStyle, color: '#22C55E' }}>{stats.comProgramacao}</span><span style={statLabelStyle}>Programados</span></div>
            <div style={statItemStyle}><span style={{ ...statNumberStyle, color: '#EF4444' }}>{stats.semProgramacao}</span><span style={statLabelStyle}>Disponíveis</span></div>
            <div style={statItemStyle}><span style={{ ...statNumberStyle, color: '#FFD700' }}>{stats.totalViagens}</span><span style={statLabelStyle}>Viagens</span></div>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div style={filtersContainerStyle}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{...filterBtnStyle, ...(filtrosAbertos ? filterBtnActiveStyle : {})}} onClick={() => setFiltrosAbertos(!filtrosAbertos)}>
            <Filter size={15} /> Filtros Avançados <ChevronDown size={15} style={{ transform: filtrosAbertos ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
          </button>
          {temFiltrosAtivos() && <button style={clearAllBtnStyle} onClick={limparTodosFiltros}><X size={14} /> Limpar Filtros</button>}
        </div>
        <div style={searchWrapperStyle}>
          <span style={searchIconStyle}>🔍</span>
          <input type="text" placeholder="Buscar por nome, CPF ou cidade..." value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} style={searchInputStyle} />
          {filtroTexto && <button onClick={() => setFiltroTexto('')} style={clearButtonStyle}>✕</button>}
        </div>
        <div style={selectsContainerStyle}>
          <div style={filterGroupStyle}><label style={filterLabelStyle}>Programação</label><select value={filtroStatusProgramacao} onChange={(e) => setFiltroStatusProgramacao(e.target.value as any)} style={selectStyle}><option value="todos">Todos</option><option value="comProgramacao">Com Programação</option><option value="semProgramacao">Sem Programação</option></select></div>
          <div style={filterGroupStyle}><label style={filterLabelStyle}>MOPP</label><select value={filtroMopp} onChange={(e) => setFiltroMopp(e.target.value as any)} style={selectStyle}><option value="todos">Todos</option><option value="comMopp">Com MOPP</option><option value="semMopp">Sem MOPP</option></select></div>
        </div>
      </div>

      {/* PAINEL FILTROS AVANÇADOS */}
      {filtrosAbertos && (
        <div style={filtersPanelStyle}>
          <div style={filtersGridStyle}>
            <div style={filterGroupStyle}><label style={filterLabelStyle}>📋 Status da Carga</label><select value={filtroStatusCarga} onChange={(e) => setFiltroStatusCarga(e.target.value)} style={selectStyle}><option value="todos">Todos os Status</option><option value="programada">📋 Programada</option><option value="aguardando_carregamento">⏳ Aguardando Carregamento</option><option value="seguindo_para_entrega">🚛 Seguindo para Entrega</option><option value="chegou_entrega">📍 Chegou na Entrega</option></select></div>
            <div style={filterGroupStyle}><label style={filterLabelStyle}>📍 Cidade Residência</label><input type="text" placeholder="Digite a cidade..." value={filtroCidade} onChange={(e) => setFiltroCidade(e.target.value)} style={filterInputStyle} /></div>
            <div style={filterGroupStyle}><label style={filterLabelStyle}>🚛 Placa do Veículo</label><input type="text" placeholder="Digite a placa..." value={filtroPlaca} onChange={(e) => setFiltroPlaca(e.target.value.toUpperCase())} style={filterInputStyle} /></div>
            <div style={filterGroupStyle}><label style={filterLabelStyle}>📡 Status Rastreador</label><select value={filtroRastreador} onChange={(e) => setFiltroRastreador(e.target.value as any)} style={selectStyle}><option value="todos">Todos</option><option value="online">🟢 Online</option><option value="offline">🔴 Offline</option></select></div>
            <div style={filterGroupStyle}><label style={filterLabelStyle}>📦 Cliente Coleta</label><input type="text" placeholder="Nome do cliente..." value={filtroClienteColeta} onChange={(e) => setFiltroClienteColeta(e.target.value)} style={filterInputStyle} /></div>
            <div style={filterGroupStyle}><label style={filterLabelStyle}>🏭 Cliente Entrega</label><input type="text" placeholder="Nome do cliente..." value={filtroClienteEntrega} onChange={(e) => setFiltroClienteEntrega(e.target.value)} style={filterInputStyle} /></div>
            <div style={filterGroupStyle}><label style={filterLabelStyle}>📅 Data Entrega</label><input type="date" value={filtroDataEntrega} onChange={(e) => setFiltroDataEntrega(e.target.value)} style={filterInputStyle} /></div>
          </div>
        </div>
      )}

      {/* LISTA DE MOTORISTAS */}
      {loadingData ? (
        <div style={emptyStateStyle}><Clock size={48} color="#666" /><h3>Carregando informações...</h3></div>
      ) : motoristasFiltrados.length === 0 ? (
        <div style={emptyStateStyle}><AlertCircle size={48} color="#666" /><h3>Nenhum motorista encontrado com os filtros aplicados</h3></div>
      ) : (
        <div style={gridStyle}>
          {motoristasFiltrados.map((m) => {
            const carga = cargasPorMotorista[m.id];
            const temProgramacao = carga !== null && carga !== undefined;
            const eventoHoje = escalaHojePorMotorista[m.id];
            const statusInfo = carga ? STATUS_CARGA_MAP[carga.status] : null;
            const statusMotorista = getStatusMotorista(m, carga, eventoHoje);
            const checkin = checkinsPorMotorista.get(m.id);
            const canhotos = carga?.id ? canhotosPorCarga.get(carga.id) : [];
            const isLoadingCanhotos = carga?.id ? loadingCanhotos.get(carga.id) : false;
            const escalaInfo = escalaInfoPorMotorista[m.id] || { diasConsecutivosTrabalhados: 0, precisaFolgar: false, porcentagemPresenca: 0 };
            const isDisponivelParaProgramar = statusMotorista.value === 'disponivel';
            const placaVeiculo = carga?.placa || '';
            const veiculoData = veiculos[placaVeiculo];
            const localizacaoVeiculo = veiculoData?.ultimaLocalizacao || null;
            const velocidadeVeiculo = getVelocidade(veiculoData);
            const coordenadasVeiculo = veiculoData?.coordenadas || null;
            const ultimaAtualizacao = veiculoData?.ultimaAtualizacaoRastreador;
            const statusRastreador = veiculoData?.statusRastreador;
            const ignicao = veiculoData?.ignicao;

            return (
              <div key={m.id} onClick={(e) => handleCardClick(m, e)} style={cardStyle}>
                <div style={{ ...fotoWrapperStyle, background: `linear-gradient(135deg, ${getRandomColor(m.id)}, #1a1a1a)` }}>
                  {m.fotoPerfilUrl ? <img src={m.fotoPerfilUrl} alt={m.nome} style={fotoStyle} /> : <div style={initialsStyle}>{getInitials(m.nome)}</div>}
                  <div style={moppBadgeStyle}>{m.temMopp === 'Sim' ? '✅ MOPP' : '❌ Sem MOPP'}</div>
                </div>
                <div style={contentStyle}>
                  <h3 style={nomeStyle}>{m.nome}</h3>
                  <p style={cpfStyle}>{m.cpf}</p>
                  <div style={infoEscalaCardStyle}><div style={infoEscalaRowStyle}><span style={infoEscalaLabelStyle}><Clock size={10} style={{ marginRight: '4px' }} /> Dias consecutivos</span><span style={infoEscalaValueStyle}>{escalaInfo.diasConsecutivosTrabalhados}</span></div></div>
                  <div style={infoGridStyle}>
                    <div style={infoItemStyle}><MapPin size={12} color="#FFD700" /><span><strong>Cidade:</strong> {m.cidade || 'Não informada'}</span></div>
                    <div style={infoItemStyle}><span>📱</span><span><strong>Telefone:</strong> {m.whatsapp || m.telefone || 'Não informado'}</span></div>
                  </div>
                  <div style={{ ...infoItemStyle, marginBottom: '12px' }}><span>🚛</span><span><strong>Viagens Realizadas:</strong> {m.viagensRealizadas || 0}</span></div>

                  {/* ANOTAÇÕES */}
                  <div style={anotacaoContainerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}><span style={{ fontSize: '10px', color: '#FFD700' }}>📝</span><span style={{ fontSize: '10px', fontWeight: 700, color: '#FFD700' }}>ANOTAÇÕES</span></div>
                    {anotacaoEditando === m.id ? (
                      <div>
                        <textarea style={anotacaoInputStyle} rows={3} placeholder="Ex: motorista com restrição médica, aguardando documentação..." defaultValue={anotacoesMotoristas[m.id] || ''} id={`anotacao_${m.id}`} />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button style={{ ...smallButtonStyle, backgroundColor: '#22C55E', color: '#000' }} onClick={(e) => { e.stopPropagation(); const textarea = document.getElementById(`anotacao_${m.id}`) as HTMLTextAreaElement; if (textarea) salvarAnotacao(m.id, textarea.value); }}><Save size={10} /> Salvar</button>
                          <button style={{ ...smallButtonStyle, backgroundColor: '#EF4444', color: '#FFF' }} onClick={(e) => { e.stopPropagation(); setAnotacaoEditando(null); }}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p style={anotacaoTextStyle}>{anotacoesMotoristas[m.id] || 'Nenhuma anotação cadastrada'}</p>
                        <button style={{ ...smallButtonStyle, backgroundColor: '#FFD70020', color: '#FFD700', border: '1px solid #FFD700' }} onClick={(e) => { e.stopPropagation(); setAnotacaoEditando(m.id); }}><Edit3 size={10} /> {anotacoesMotoristas[m.id] ? 'Editar Anotação' : 'Adicionar Anotação'}</button>
                      </div>
                    )}
                  </div>

                  {/* PROGRAMAÇÃO ATUAL */}
                  {temProgramacao && carga && (
                    <>
                      <div style={programacaoContainerStyle}>
                        <div style={programacaoHeaderStyle}><Truck size={14} color="#888" /><h4 style={programacaoTitleStyle}>Programação Atual</h4>{statusInfo && <span style={programacaoStatusStyle(statusInfo.cor, statusInfo.bg)}>{statusInfo.icon} {statusInfo.label}</span>}</div>
                        <div style={programacaoInfoStyle}><strong style={{ color: '#FFD700' }}>DT:</strong> {carga.dt || '—'}</div>
                        <div style={{ ...programacaoInfoStyle, marginTop: '4px' }}><MapPin size={12} color="#FFD700" /><span><strong>Coleta:</strong> {carga.coletaCidade} - {carga.coletaLocal}</span></div>
                        <div style={programacaoInfoStyle}><Calendar size={12} color="#FFD700" /><span>{carga.coletaData || '—'}</span></div>
                        <div style={{ ...programacaoInfoStyle, marginTop: '4px' }}><MapPin size={12} color="#22C55E" /><span><strong>Entrega:</strong> {carga.entregaCidade} - {carga.entregaLocal}</span></div>
                        <div style={programacaoInfoStyle}><Calendar size={12} color="#22C55E" /><span>{carga.entregaData || '—'}</span></div>
                        <div style={{ ...programacaoInfoStyle, marginTop: '8px', borderTop: '1px solid #1F1F1F', paddingTop: '8px' }}><Truck size={12} color="#888" /><span><strong>Placa Cavalo:</strong> <span style={programacaoPlacaStyle}>{carga.placa || '—'}</span></span></div>
                        {carga.carreta && <div style={programacaoInfoStyle}><Truck size={12} color="#888" /><span><strong>Placa Carreta:</strong> <span style={programacaoPlacaStyle}>{carga.carreta}</span></span></div>}
                        <div style={programacaoInfoStyle}><strong>Peso:</strong> {carga.peso || '—'} kg</div>
                      </div>

                      {/* MONITORAMENTO */}
                      <div style={monitoriaCardStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><Activity size={12} color="#FFD700" /><span style={{ fontSize: '10px', fontWeight: 700, color: '#FFD700' }}>MONITORAMENTO</span></div>
                        <div style={monitoriaRowStyle}><span style={monitoriaLabelStyle}>📡 RASTREADOR:</span><span style={{ ...monitoriaValueStyle, color: statusRastreador === 'online' ? '#22C55E' : '#EF4444' }}>{statusRastreador === 'online' ? '🟢 ONLINE' : '🔴 OFFLINE'}</span></div>
                        {ignicao && <div style={monitoriaRowStyle}><span style={monitoriaLabelStyle}>🔑 IGNIÇÃO:</span><span style={{ ...monitoriaValueStyle, color: ignicao === 'LIGADO' ? '#22C55E' : '#EF4444' }}>{ignicao === 'LIGADO' ? '🟢 LIGADA' : '🔴 DESLIGADA'}</span></div>}
                        {localizacaoVeiculo && localizacaoVeiculo !== '—' ? (<div style={monitoriaRowStyle}><span style={monitoriaLabelStyle}>📍 LOCALIZAÇÃO:</span><span style={{ ...monitoriaValueStyle, color: '#22C55E', fontSize: '10px' }}>{localizacaoVeiculo.length > 50 ? localizacaoVeiculo.substring(0, 47) + '...' : localizacaoVeiculo}</span></div>) : <div style={monitoriaRowStyle}><span style={monitoriaLabelStyle}>📍 LOCALIZAÇÃO:</span><span style={{ ...monitoriaValueStyle, color: '#666' }}>Não disponível</span></div>}
                        <div style={monitoriaRowStyle}><span style={monitoriaLabelStyle}><Gauge size={10} style={{ display: 'inline', marginRight: '4px' }} /> 🏎️ VELOCIDADE:</span><span style={{ ...monitoriaValueStyle, color: getVelocidadeColor(velocidadeVeiculo), fontWeight: velocidadeVeiculo > 80 ? 800 : 600, fontSize: velocidadeVeiculo > 80 ? '13px' : '11px' }}>{getVelocidadeIcon(velocidadeVeiculo)} {velocidadeVeiculo > 0 ? `${velocidadeVeiculo} km/h` : 'Parado'}{velocidadeVeiculo > 80 && <span style={{ marginLeft: '6px', backgroundColor: '#EF4444', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '8px', fontWeight: 800 }}>EXCESSO!</span>}</span></div>
                        <div style={monitoriaRowStyle}><span style={monitoriaLabelStyle}>🕐 ÚLTIMA ATUALIZAÇÃO:</span><span style={{ ...monitoriaValueStyle, color: '#FFD700' }}>{formatarUltimaAtualizacao(ultimaAtualizacao)}</span></div>
                        {veiculoData?.ultimaMacro && <div style={monitoriaRowStyle}><span style={monitoriaLabelStyle}>🏷️ ÚLTIMA MACRO:</span><span style={{ ...monitoriaValueStyle, color: '#FFD700' }}>{veiculoData.ultimaMacro}</span></div>}
                        <div style={monitoriaRowStyle}><span style={monitoriaLabelStyle}>📋 CHECK-IN:</span><span style={{ ...monitoriaValueStyle, color: checkin?.tipo ? '#22C55E' : '#EF4444' }}>{checkin?.tipo ? getCheckinLabel(checkin.tipo) : 'Aguardando check-in'}</span></div>
                        {checkin?.dataHora && <div style={monitoriaRowStyle}><span style={monitoriaLabelStyle}>⏰ DATA/HORA:</span><span style={monitoriaValueStyle}>{checkin.dataHora}</span></div>}
                        {checkin?.pontualidade && <div style={monitoriaRowStyle}><span style={monitoriaLabelStyle}>⏱️ PONTUALIDADE:</span><span style={{ ...monitoriaValueStyle, color: checkin.pontualidade === 'On Time' ? '#22C55E' : '#EF4444' }}>{checkin.pontualidade}</span></div>}
                        {checkin?.localizacaoReal && <div style={monitoriaRowStyle}><span style={monitoriaLabelStyle}>📍 LOCALIZAÇÃO CHECK-IN:</span><span style={monitoriaValueStyle}>{checkin.localizacaoReal}</span></div>}
                        <div style={buttonGroupStyle}>
                          {checkin?.fotoUrl && <button style={{ ...smallButtonStyle, backgroundColor: '#3B82F620', color: '#3B82F6', border: '1px solid #3B82F6' }} onClick={(e) => { e.stopPropagation(); setSelectedPhoto(checkin.fotoUrl!); setShowPhotoModal(true); }}><Camera size={12} /> Ver Foto Check-in</button>}
                          {canhotos && canhotos.length > 0 && <button style={{ ...smallButtonStyle, backgroundColor: '#FFD70020', color: '#FFD700', border: '1px solid #FFD700' }} onClick={(e) => { e.stopPropagation(); setCanhotosModalData({ canhotos, cargaNome: m.nome }); setShowCanhotosModal(true); }}><Images size={12} /> Ver {canhotos.length} Canhoto(s)</button>}
                          {isLoadingCanhotos && <span style={{ fontSize: '10px', color: '#AAA' }}>Carregando...</span>}
                        </div>
                      </div>

                      {/* AÇÕES DA CARGA */}
                      <div style={actionButtonsStyle}>
                        <button style={{ ...actionButtonStyle, backgroundColor: '#3B82F620', color: '#3B82F6', borderColor: '#3B82F6' }} onClick={(e) => { e.stopPropagation(); if (carga) { setEditandoCarga(carga); setShowEditCargaModal(true); } }}><Edit3 size={14} /> Editar Carga</button>
                        <button style={{ ...actionButtonStyle, backgroundColor: '#EF444420', color: '#EF4444', borderColor: '#EF4444' }} onClick={(e) => { e.stopPropagation(); if (carga) { handleExcluirCarga(carga); } }}><Trash2 size={14} /> Excluir Carga</button>
                        <button style={{ ...actionButtonStyle, backgroundColor: '#22C55E20', color: '#22C55E', borderColor: '#22C55E' }} onClick={(e) => { e.stopPropagation(); if (carga) { setSelectedCargaForStatus(carga); setNewStatus(carga.status); setShowStatusModal(true); } }}><RotateCcw size={14} /> Alterar Status</button>
                        <button style={{ ...actionButtonStyle, backgroundColor: '#FFD70020', color: '#FFD700', borderColor: '#FFD700' }} onClick={(e) => { e.stopPropagation(); if (carga) { handleFinalizarCarga(carga); } }}><Flag size={14} /> Finalizar Carga</button>
                      </div>
                    </>
                  )}

                  {/* STATUS QUANDO SEM PROGRAMAÇÃO */}
                  {!temProgramacao && (
                    <div style={{ padding: '12px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center', backgroundColor: statusMotorista.bg, border: `1px solid ${statusMotorista.cor}` }}>
                      <span style={{ fontSize: '24px', marginRight: '8px' }}>{statusMotorista.icon}</span>
                      <span style={{ fontWeight: 700, color: statusMotorista.cor, fontSize: '14px' }}>{statusMotorista.label}</span>
                      {statusMotorista.value === 'folga' && <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{eventoHoje?.tipo === 'Descanso Semanal' ? 'Descanso semanal - Não programar' : 'Férias - Não programar'}</div>}
                      {isDisponivelParaProgramar && !carga && <div style={{ fontSize: '11px', color: '#22C55E', marginTop: '4px' }}>✅ Motorista está disponível para nova programação</div>}
                    </div>
                  )}

                  {/* BOTÕES DE AÇÃO DO MOTORISTA - WHATSAPP INTEGRATION */}
                  <div style={actionButtonsStyle}>
                    {/* Botão WhatsApp Web - Abre conversa direta no navegador */}
                    <button style={{ ...actionButtonStyle, backgroundColor: '#25D36620', color: '#25D366', borderColor: '#25D366' }} onClick={(e) => { e.stopPropagation(); abrirWhatsAppWeb(m.whatsapp || m.telefone, m.nome); }}>
                      <MessageCircle size={14} /> WhatsApp Web
                    </button>
                    
                    {/* Botão Enviar Mensagem - Modal com envio via servidor (requer backend) */}
                    {whatsappReady && (
                      <button style={{ ...actionButtonStyle, backgroundColor: '#075E5420', color: '#075E54', borderColor: '#075E54' }} onClick={(e) => { e.stopPropagation(); abrirWhatsAppChat(m.whatsapp || m.telefone, m.nome); }}>
                        <MessageCircle size={14} /> Enviar Mensagem
                      </button>
                    )}
                    
                    {/* Botão Histórico - Abre histórico de conversas */}
                    <button style={{ ...actionButtonStyle, backgroundColor: '#3B82F620', color: '#3B82F6', borderColor: '#3B82F6' }} onClick={(e) => { e.stopPropagation(); abrirWhatsAppHistorico(m.whatsapp || m.telefone, m.nome); }}>
                      <MessageCircle size={14} /> Histórico
                    </button>
                    
                    <button style={actionButtonStyle} onClick={() => onSelectMotorista(m.id)}><UserCheck size={14} /> Ver Detalhes</button>
                    <button style={{ ...actionButtonStyle, backgroundColor: '#EF444420', color: '#EF4444', borderColor: '#EF4444' }} onClick={() => setShowDeleteConfirm(m.id)}><UserMinus size={14} /> Excluir</button>
                    <button onClick={() => { setMapaModalMotorista({ id: m.id, nome: m.nome, placa: placaVeiculo || undefined, veiculoId: carga?.veiculo || undefined, coordenadas: coordenadasVeiculo || undefined, ultimaLocalizacao: localizacaoVeiculo || veiculoData?.ultimaLocalizacao || undefined, ultimoEndereco: localizacaoVeiculo || veiculoData?.ultimaLocalizacao || undefined, ultimaAtualizacao: veiculoData?.ultimaAtualizacaoRastreador, status: veiculoData?.statusRastreador, ultimaMacro: veiculoData?.ultimaMacro || undefined }); }} style={{ ...actionButtonStyle, backgroundColor: coordenadasVeiculo?.lat && coordenadasVeiculo?.lng ? '#3B82F6' : '#555', color: '#FFF', borderColor: coordenadasVeiculo?.lat && coordenadasVeiculo?.lng ? '#3B82F6' : '#555', opacity: coordenadasVeiculo?.lat && coordenadasVeiculo?.lng ? 1 : 0.5 }} disabled={!coordenadasVeiculo?.lat || !coordenadasVeiculo?.lng} title={!coordenadasVeiculo?.lat || !coordenadasVeiculo?.lng ? 'Coordenadas não disponíveis' : 'Ver no mapa'}><Navigation size={14} /> Ver Localização</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAIS - EDITAR CARGA, ALTERAR STATUS, EXCLUIR, FOTO, CANHOTOS, MAPA */}
      {showEditCargaModal && editandoCarga && (
        <div style={modalOverlayStyle} onClick={() => setShowEditCargaModal(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}><h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#FFF' }}>Editar Carga</h2><button style={btnCloseStyle} onClick={() => setShowEditCargaModal(false)}><X size={18} /></button></div>
            <div style={modalBodyStyle}>
              <div style={formGridStyle}>
                <div style={formGroupStyle}><label style={formLabelStyle}>DT</label><input style={formInputStyle} value={editandoCarga.dt || ''} onChange={e => setEditandoCarga({...editandoCarga, dt: e.target.value})} /></div>
                <div style={formGroupStyle}><label style={formLabelStyle}>Placa</label><input style={formInputStyle} value={editandoCarga.placa || ''} onChange={e => setEditandoCarga({...editandoCarga, placa: e.target.value})} /></div>
                <div style={formGroupStyle}><label style={formLabelStyle}>Carreta</label><input style={formInputStyle} value={editandoCarga.carreta || ''} onChange={e => setEditandoCarga({...editandoCarga, carreta: e.target.value})} /></div>
                <div style={formGroupStyle}><label style={formLabelStyle}>Peso (kg)</label><input style={formInputStyle} value={editandoCarga.peso || ''} onChange={e => setEditandoCarga({...editandoCarga, peso: e.target.value})} /></div>
              </div>
              <h4 style={{ color: '#FFD700', fontSize: '14px', margin: '16px 0 12px 0' }}>📍 Coleta</h4>
              <div style={formGridStyle}>
                <div style={formGroupStyle}><label style={formLabelStyle}>Data Coleta</label><input style={formInputStyle} value={editandoCarga.coletaData || ''} onChange={e => setEditandoCarga({...editandoCarga, coletaData: e.target.value})} /></div>
                <div style={formGroupStyle}><label style={formLabelStyle}>Cidade Coleta</label><input style={formInputStyle} value={editandoCarga.coletaCidade || ''} onChange={e => setEditandoCarga({...editandoCarga, coletaCidade: e.target.value})} /></div>
                <div style={formGroupStyle}><label style={formLabelStyle}>Local Coleta</label><input style={formInputStyle} value={editandoCarga.coletaLocal || ''} onChange={e => setEditandoCarga({...editandoCarga, coletaLocal: e.target.value})} /></div>
              </div>
              <h4 style={{ color: '#FFD700', fontSize: '14px', margin: '16px 0 12px 0' }}>🏭 Entrega</h4>
              <div style={formGridStyle}>
                <div style={formGroupStyle}><label style={formLabelStyle}>Data Entrega</label><input style={formInputStyle} value={editandoCarga.entregaData || ''} onChange={e => setEditandoCarga({...editandoCarga, entregaData: e.target.value})} /></div>
                <div style={formGroupStyle}><label style={formLabelStyle}>Cidade Entrega</label><input style={formInputStyle} value={editandoCarga.entregaCidade || ''} onChange={e => setEditandoCarga({...editandoCarga, entregaCidade: e.target.value})} /></div>
                <div style={formGroupStyle}><label style={formLabelStyle}>Local Entrega</label><input style={formInputStyle} value={editandoCarga.entregaLocal || ''} onChange={e => setEditandoCarga({...editandoCarga, entregaLocal: e.target.value})} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button style={btnSecondaryStyle} onClick={() => setShowEditCargaModal(false)}>Cancelar</button>
                <button style={btnPrimaryStyle} onClick={handleEditarCarga} disabled={loading}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStatusModal && selectedCargaForStatus && (
        <div style={modalOverlayStyle} onClick={() => setShowStatusModal(false)}>
          <div style={{...modalContentStyle, maxWidth: '450px'}} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}><h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#FFF' }}>Alterar Status da Carga</h2><button style={btnCloseStyle} onClick={() => setShowStatusModal(false)}><X size={18} /></button></div>
            <div style={modalBodyStyle}>
              <div style={formGroupStyle}>
                <label style={formLabelStyle}>Motorista: {selectedCargaForStatus.motorista}</label>
                <label style={formLabelStyle}>Novo Status</label>
                <select style={formInputStyle} value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  <option value="programada">📋 Programada</option>
                  <option value="aguardando_carregamento">⏳ Aguardando Carregamento</option>
                  <option value="seguindo_para_entrega">🚛 Seguindo para a entrega</option>
                  <option value="chegou_entrega">📍 Chegou na Entrega</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button style={btnSecondaryStyle} onClick={() => setShowStatusModal(false)}>Cancelar</button>
                <button style={btnPrimaryStyle} onClick={handleAlterarStatus} disabled={loading}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div style={deleteConfirmModalStyle}>
          <div style={deleteConfirmContentStyle}>
            <h3 style={{ color: '#EF4444', marginBottom: '20px' }}>Confirmar Exclusão</h3>
            <p style={{ color: '#AAA' }}>Tem certeza que deseja excluir este motorista?</p>
            <p style={{ color: '#666', fontSize: '12px' }}>Esta ação também excluirá todas as cargas e históricos do motorista.</p>
            <div style={deleteConfirmButtonsStyle}>
              <button style={{ ...deleteConfirmBtnStyle, backgroundColor: '#333', color: '#AAA' }} onClick={() => setShowDeleteConfirm(null)}>Cancelar</button>
              <button style={{ ...deleteConfirmBtnStyle, backgroundColor: '#EF4444', color: '#fff' }} onClick={() => handleDeleteMotorista(showDeleteConfirm)} disabled={loading}>{loading ? 'Excluindo...' : 'Excluir'}</button>
            </div>
          </div>
        </div>
      )}

      {showPhotoModal && selectedPhoto && (
        <div style={modalOverlayStyle} onClick={() => setShowPhotoModal(false)}>
          <div style={{...modalContentStyle, maxWidth: '500px'}} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}><h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#FFF' }}>Foto do Check-in</h2><button style={btnCloseStyle} onClick={() => setShowPhotoModal(false)}><X size={18} /></button></div>
            <div style={{...modalBodyStyle, textAlign: 'center'}}><img src={selectedPhoto} alt="Check-in" style={{ maxWidth: '100%', maxHeight: '50vh', borderRadius: '12px' }} /></div>
          </div>
        </div>
      )}

      {showCanhotosModal && canhotosModalData && (
        <div style={modalOverlayStyle} onClick={() => setShowCanhotosModal(false)}>
          <div style={{...modalContentStyle, maxWidth: '700px'}} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}><h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#FFF' }}>Canhotos - {canhotosModalData.cargaNome}</h2><button style={btnCloseStyle} onClick={() => setShowCanhotosModal(false)}><X size={18} /></button></div>
            <div style={modalBodyStyle}>
              <div style={galeriaGridStyle}>
                {canhotosModalData.canhotos.map((canhoto, idx) => (
                  <div key={idx}>
                    <img src={canhoto.url} alt={`Canhoto ${idx + 1}`} style={thumbnailStyle} className="thumbnail-hover" onClick={() => { setSelectedPhoto(canhoto.url); setShowCanhotosModal(false); setShowPhotoModal(true); }} />
                    <span style={{ display: 'block', textAlign: 'center', color: '#999', fontSize: '11px', marginTop: '4px' }}>Canhoto {idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {mapaModalMotorista && <MotoristaMapaModal key={mapaModalMotorista.id} isOpen={true} onClose={() => setMapaModalMotorista(null)} motorista={mapaModalMotorista} />}

      {/* WHATSAPP HISTÓRICO */}
      <WhatsAppHistorico 
        isOpen={whatsappHistoricoOpen.open}
        onClose={() => setWhatsappHistoricoOpen({ open: false, telefone: '', nome: '' })}
        telefone={whatsappHistoricoOpen.telefone}
        nome={whatsappHistoricoOpen.nome}
        sendMessage={sendWhatsAppMessage}
      />

      {/* WHATSAPP CHAT MODAL (Enviar Mensagem) */}
      <WhatsAppChatModal
        isOpen={whatsappChatModalOpen.open}
        onClose={() => setWhatsappChatModalOpen({ open: false, telefone: '', nome: '' })}
        telefone={whatsappChatModalOpen.telefone}
        nome={whatsappChatModalOpen.nome}
        sendMessage={sendWhatsAppMessage}
        sending={sendingMessage}
      />
    </div>
  );
};

export default ListaMotoristas;