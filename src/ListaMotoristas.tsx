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
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import {
  Truck, MapPin, Calendar, Clock, AlertCircle, BarChart3, Printer, X, Search, 
  UserCheck, UserMinus, Edit3, Trash2, Flag, Camera, 
  Navigation, Activity, RotateCcw, Filter, ChevronDown, MessageCircle, Save, Gauge, Bell, Route
} from 'lucide-react';
import MotoristaMapaModal from './ListaMotoristaMapaModal';
import WhatsAppChatModal from './WhatsAppChatModal';
import VisaoMapa from './VisaoMapa';
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
  statusMotorista?: string;
  observacaoMotorista?: string;
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
  rotaMonisat?: string;
  ultimaAtualizacaoRotaMonisat?: any;
}

interface VeiculoCompleto {
  id: string;
  placa: string;
  tipo: string;
  motorista?: string;
  ultimoMotorista?: string;
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

// STATUS DO MOTORISTA PARA FILTRO SEM PROGRAMAÇÃO
const STATUS_MOTORISTA_OPTS = {
  'disponivel': { label: 'Disponível para Programar', icon: '✅', cor: '#22C55E', bg: '#22C55E20' },
  'folga': { label: 'Folga', icon: '😴', cor: '#FFD700', bg: '#FFD70020' },
  'ferias': { label: 'Férias', icon: '🏖️', cor: '#FFD700', bg: '#FFD70020' },
  'sem_veiculo': { label: 'Sem Veículo', icon: '🚫', cor: '#EF4444', bg: '#EF444420' },
  'falta': { label: 'Falta', icon: '❌', cor: '#EF4444', bg: '#EF444420' },
  'atestado': { label: 'Atestado', icon: '📋', cor: '#8B5CF6', bg: '#8B5CF620' },
  'veiculo_manutencao': { label: 'Veículo em Manutenção', icon: '🔧', cor: '#FF9500', bg: '#FF950020' }
};

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
  const [veiculosCompletos, setVeiculosCompletos] = useState<Record<string, VeiculoCompleto>>({});
  const [observacoesMotoristas, setObservacoesMotoristas] = useState<Record<string, string>>({});
  const [observacaoEditando, setObservacaoEditando] = useState<string | null>(null);
  const [statusMotoristaEditando, setStatusMotoristaEditando] = useState<string | null>(null);
  const [statusSelecionado, setStatusSelecionado] = useState<Record<string, string>>({});
  const [observacaoTemp, setObservacaoTemp] = useState<Record<string, string>>({});
  const [visaoAtiva, setVisaoAtiva] = useState<'lista' | 'mapa'>('lista');
  const [motoristasParaMapa, setMotoristasParaMapa] = useState<any[]>([]);
  
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
  const [showDeleteAllCargasConfirm, setShowDeleteAllCargasConfirm] = useState(false);
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
  
  // WHATSAPP STATES - APENAS MODAL
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

  // Função para encontrar veículo que o motorista está embarcado
  const getVeiculoEmbarcado = (motoristaNome: string): VeiculoCompleto | null => {
    const veiculoEncontrado = Object.values(veiculosCompletos).find(veiculo => 
      veiculo.motorista?.toUpperCase() === motoristaNome.toUpperCase() ||
      veiculo.ultimoMotorista?.toUpperCase() === motoristaNome.toUpperCase()
    );
    return veiculoEncontrado || null;
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
        setObservacaoTemp(prev => ({ ...prev, [m.id]: savedObservacao }));
      }
    });
  }, [motoristas]);

  const salvarStatusMotorista = (motoristaId: string, status: string) => {
    setStatusSelecionado(prev => ({ ...prev, [motoristaId]: status }));
    localStorage.setItem(`status_motorista_${motoristaId}`, status);
    setStatusMotoristaEditando(null);
    showNotification(`Status alterado para: ${STATUS_MOTORISTA_OPTS[status as keyof typeof STATUS_MOTORISTA_OPTS]?.label || status}`, 'success');
  };

  const salvarObservacaoTemp = (motoristaId: string, observacao: string) => {
    setObservacaoTemp(prev => ({ ...prev, [motoristaId]: observacao }));
    localStorage.setItem(`observacao_temp_${motoristaId}`, observacao);
    setObservacaoEditando(null);
    showNotification('Observação salva com sucesso!', 'success');
  };

  // FUNÇÃO PARA EXCLUIR TODAS AS CARGAS
  const handleDeleteAllCargas = async () => {
    setLoading(true);
    let totalDeleted = 0;
    let errors = 0;

    try {
      for (const motorista of motoristas) {
        if (!motorista.id) continue;

        try {
          const cargasRef = collection(db, 'motoristas', motorista.id, 'cargas');
          const cargasSnapshot = await getDocs(cargasRef);
          
          if (cargasSnapshot.empty) continue;

          const batch = writeBatch(db);
          let batchCount = 0;
          
          for (const cargaDoc of cargasSnapshot.docs) {
            batch.delete(cargaDoc.ref);
            batchCount++;
            totalDeleted++;

            if (batchCount >= 500) {
              await batch.commit();
              batchCount = 0;
            }
          }
          
          if (batchCount > 0) {
            await batch.commit();
          }
          
        } catch (error) {
          console.error(`Erro ao excluir cargas do motorista ${motorista.nome}:`, error);
          errors++;
        }
      }

      if (errors === 0) {
        showNotification(`✅ ${totalDeleted} carga(s) excluída(s) com sucesso!`, 'success');
      } else {
        showNotification(`⚠️ ${totalDeleted} carga(s) excluída(s) com ${errors} erro(s)`, 'error');
      }
      
      setShowDeleteAllCargasConfirm(false);
      setCargasPorMotorista({});
      
    } catch (error) {
      console.error('Erro ao excluir todas as cargas:', error);
      showNotification('❌ Erro ao excluir todas as cargas', 'error');
    } finally {
      setLoading(false);
    }
  };

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

  const abrirWhatsAppChat = (telefone: string | undefined, nome: string) => {
    if (!telefone || telefone === '—' || telefone === 'Não informado') {
      alert(`⚠️ Número de telefone não disponível para ${nome}`);
      return;
    }
    setWhatsappChatModalOpen({ open: true, telefone, nome });
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

  const formatarUltimaAtualizacaoRota = (timestamp: any): string => {
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

  // Buscar veículos completos (com motorista)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "veiculos"), (snap) => {
      const veiculosCompletosMap: Record<string, VeiculoCompleto> = {};
      snap.forEach(doc => {
        const data = doc.data();
        veiculosCompletosMap[data.placa] = {
          id: doc.id,
          placa: data.placa,
          tipo: data.tipo,
          motorista: data.motorista,
          ultimoMotorista: data.ultimoMotorista
        };
      });
      setVeiculosCompletos(veiculosCompletosMap);
    });
    return () => unsub();
  }, []);

  // Buscar dados de rastreamento dos veículos
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
          ignicao: data.ignicao || undefined,
          rotaMonisat: data.rotaMonisat || undefined,
          ultimaAtualizacaoRotaMonisat: data.ultimaAtualizacaoRotaMonisat || undefined
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

  useEffect(() => {
    const dadosParaMapa = motoristas.map(m => {
      const carga = cargasPorMotorista[m.id];
      const veiculoData = carga?.placa ? veiculos[carga.placa] : null;
      const statusCarga = carga?.status || 'sem_carga';
      
      return {
        id: m.id,
        nome: m.nome,
        cpf: m.cpf,
        cidade: m.cidade,
        whatsapp: m.whatsapp,
        placa: carga?.placa || '—',
        status: statusCarga,
        statusLabel: STATUS_CARGA_MAP[statusCarga]?.label || 'Sem Carga',
        statusCor: STATUS_CARGA_MAP[statusCarga]?.cor || '#6B7280',
        coordenadas: veiculoData?.coordenadas,
        ultimaLocalizacao: veiculoData?.ultimaLocalizacao,
        ultimaAtualizacao: veiculoData?.ultimaAtualizacaoRastreador,
        velocidade: veiculoData?.velocidade,
        rotaMonisat: veiculoData?.rotaMonisat,
        cargaAtual: carga ? {
          id: carga.id,
          coletaLocal: carga.coletaLocal,
          coletaCidade: carga.coletaCidade,
          entregaLocal: carga.entregaLocal,
          entregaCidade: carga.entregaCidade,
          coletaData: carga.coletaData,
          entregaData: carga.entregaData,
          peso: carga.peso
        } : undefined
      };
    });
    setMotoristasParaMapa(dadosParaMapa);
  }, [motoristas, cargasPorMotorista, veiculos]);

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
    // Se tem carga, mostra o status da carga
    if (carga) {
      const statusCarga = STATUS_CARGA_MAP[carga.status];
      if (statusCarga) {
        return { ...statusCarga, value: carga.status, isCarga: true };
      }
    }
    
    // Se tem status manual salvo, mostra ele
    const statusManual = statusSelecionado[motorista.id];
    if (statusManual && STATUS_MOTORISTA_OPTS[statusManual as keyof typeof STATUS_MOTORISTA_OPTS]) {
      const statusOpt = STATUS_MOTORISTA_OPTS[statusManual as keyof typeof STATUS_MOTORISTA_OPTS];
      return { label: statusOpt.label, cor: statusOpt.cor, bg: statusOpt.bg, icon: statusOpt.icon, value: statusManual, isManual: true };
    }
    
    // Verifica escala do dia
    if (eventoEscala) {
      if (eventoEscala.tipo === 'Descanso Semanal') {
        return { label: 'Folga', cor: '#FFD700', bg: '#FFD70020', icon: '😴', value: 'folga' };
      }
      if (eventoEscala.tipo === 'Férias') {
        return { label: 'Férias', cor: '#FFD700', bg: '#FFD70020', icon: '🏖️', value: 'ferias' };
      }
      if (eventoEscala.tipo === 'Falta') {
        return { label: 'Falta', cor: '#EF4444', bg: '#EF444420', icon: '❌', value: 'falta' };
      }
      if (eventoEscala.tipo === 'Atestado') {
        return { label: 'Atestado', cor: '#8B5CF6', bg: '#8B5CF620', icon: '📋', value: 'atestado' };
      }
    }
    
    // Se não tem carga, nem escala, está disponível
    return { label: 'Disponível para Programar', cor: '#22C55E', bg: '#22C55E20', icon: '✅', value: 'disponivel' };
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

  // Função para obter o status atual do motorista (considerando carga, status manual e escala)
  const getMotoristaStatusKey = (motorista: Motorista) => {
    const carga = cargasPorMotorista[motorista.id];
    const eventoHoje = escalaHojePorMotorista[motorista.id];
    
    if (carga) return 'comProgramacao';
    
    const statusManual = statusSelecionado[motorista.id];
    if (statusManual) return statusManual;
    
    if (eventoHoje) {
      if (eventoHoje.tipo === 'Descanso Semanal') return 'folga';
      if (eventoHoje.tipo === 'Férias') return 'ferias';
      if (eventoHoje.tipo === 'Falta') return 'falta';
      if (eventoHoje.tipo === 'Atestado') return 'atestado';
    }
    
    return 'disponivel';
  };

  // Estatísticas detalhadas
  const stats = useMemo(() => {
    const total = motoristas.length;
    const comProgramacao = motoristas.filter(m => cargasPorMotorista[m.id] !== null && cargasPorMotorista[m.id] !== undefined).length;
    const semProgramacao = total - comProgramacao;
    const comMopp = motoristas.filter(m => m.temMopp === 'Sim').length;
    const semMopp = total - comMopp;
    const totalViagens = motoristas.reduce((sum, m) => sum + (m.viagensRealizadas || 0), 0);
    
    // Estatísticas de status dos motoristas sem programação
    const disponiveis = motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      if (carga) return false;
      const statusManual = statusSelecionado[m.id];
      if (statusManual) return statusManual === 'disponivel';
      const eventoHoje = escalaHojePorMotorista[m.id];
      if (eventoHoje?.tipo === 'Descanso Semanal' || eventoHoje?.tipo === 'Férias' || 
          eventoHoje?.tipo === 'Falta' || eventoHoje?.tipo === 'Atestado') return false;
      return true;
    }).length;
    
    const folga = motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      if (carga) return false;
      const statusManual = statusSelecionado[m.id];
      if (statusManual === 'folga') return true;
      const eventoHoje = escalaHojePorMotorista[m.id];
      return eventoHoje?.tipo === 'Descanso Semanal';
    }).length;
    
    const ferias = motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      if (carga) return false;
      const statusManual = statusSelecionado[m.id];
      if (statusManual === 'ferias') return true;
      const eventoHoje = escalaHojePorMotorista[m.id];
      return eventoHoje?.tipo === 'Férias';
    }).length;
    
    const semVeiculo = motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      if (carga) return false;
      const statusManual = statusSelecionado[m.id];
      return statusManual === 'sem_veiculo';
    }).length;
    
    const veiculoManutencao = motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      if (carga) return false;
      const statusManual = statusSelecionado[m.id];
      return statusManual === 'veiculo_manutencao';
    }).length;
    
    const falta = motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      if (carga) return false;
      const statusManual = statusSelecionado[m.id];
      if (statusManual === 'falta') return true;
      const eventoHoje = escalaHojePorMotorista[m.id];
      return eventoHoje?.tipo === 'Falta';
    }).length;
    
    const atestado = motoristas.filter(m => {
      const carga = cargasPorMotorista[m.id];
      if (carga) return false;
      const statusManual = statusSelecionado[m.id];
      if (statusManual === 'atestado') return true;
      const eventoHoje = escalaHojePorMotorista[m.id];
      return eventoHoje?.tipo === 'Atestado';
    }).length;
    
    return { 
      total, comProgramacao, semProgramacao, comMopp, semMopp, totalViagens,
      disponiveis, folga, ferias, semVeiculo, veiculoManutencao, falta, atestado
    };
  }, [motoristas, cargasPorMotorista, statusSelecionado, escalaHojePorMotorista]);

  const getInitials = (nome: string) => nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const getRandomColor = (id: string) => {
    const colors = ['#FFD700', '#FFB700', '#FF9500', '#FF7B00', '#FFC300'];
    return colors[parseInt(id.slice(0, 8), 16) % colors.length];
  };

  // NOVA FUNÇÃO - Clique apenas no nome ou botão de ver detalhes
  const handleNomeClick = (motoristaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectMotorista(motoristaId);
  };

  const handleVerDetalhes = (motoristaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectMotorista(motoristaId);
  };

  // ESTILOS
  const containerStyle: React.CSSProperties = { padding: '40px 20px', backgroundColor: '#000', fontFamily: 'Inter, sans-serif', width: '100%' };
  const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' };
  const titleStyle: React.CSSProperties = { fontSize: '32px', fontWeight: 900, color: '#FFF', margin: 0 };
  const subtitleStyle: React.CSSProperties = { margin: '8px 0 0 0', color: '#666', fontSize: '14px' };
  const reportBtnStyle: React.CSSProperties = { backgroundColor: '#FFD700', color: '#000', padding: '10px 20px', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' };
  
  // Novo estilo para o dashboard expandido
  const statsGridStyle: React.CSSProperties = { display: 'flex', gap: '12px', backgroundColor: '#0A0A0A', padding: '16px 24px', borderRadius: '16px', border: '1px solid #1A1A1A', flexWrap: 'wrap', justifyContent: 'center' };
  const statsGridItemStyle: React.CSSProperties = { textAlign: 'center', minWidth: '70px' };
  const statsGridNumberStyle: React.CSSProperties = { fontSize: '18px', fontWeight: 800, color: '#FFF', margin: 0 };
  const statsGridLabelStyle: React.CSSProperties = { fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 700, marginTop: '4px' };
  
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

  const cardStyle: React.CSSProperties = { backgroundColor: '#0A0A0A', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)', border: '1px solid #1A1A1A', overflow: 'hidden', transition: 'all 0.2s' };
  const fotoWrapperStyle: React.CSSProperties = { height: '100px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: '40px', fontWeight: 800 };
  const fotoStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 };
  const initialsStyle: React.CSSProperties = { zIndex: 1 };
  const moppBadgeStyle: React.CSSProperties = { position: 'absolute', bottom: '10px', right: '10px', backgroundColor: 'rgba(0,0,0,0.7)', color: '#FFF', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600 };
  const contentStyle: React.CSSProperties = { padding: '20px' };
  const nomeStyle: React.CSSProperties = { fontSize: '18px', fontWeight: 800, color: '#FFF', margin: '0 0 4px 0', cursor: 'pointer' };
  const cpfStyle: React.CSSProperties = { fontSize: '13px', color: '#888', margin: '0 0 12px 0' };
  const infoGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' };
  const infoItemStyle: React.CSSProperties = { fontSize: '12px', color: '#AAA', display: 'flex', alignItems: 'center', gap: '6px' };
  const infoEscalaCardStyle: React.CSSProperties = { backgroundColor: '#1A1A2A', borderRadius: '12px', padding: '8px 12px', marginBottom: '12px', border: '1px solid #2A2A3A' };
  const infoEscalaRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const infoEscalaLabelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 600, color: '#888', textTransform: 'uppercase' };
  const infoEscalaValueStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: '#FFD700' };
  
  // Estilo para o card de status do motorista (para filtro sem programação)
  const statusCardStyle = (bg: string, border: string): React.CSSProperties => ({ 
    padding: '12px', 
    borderRadius: '12px', 
    marginBottom: '16px', 
    backgroundColor: bg, 
    border: `1px solid ${border}`,
    cursor: 'pointer'
  });
  
  const observacaoContainerStyle: React.CSSProperties = { marginTop: '12px', marginBottom: '12px', padding: '10px', backgroundColor: '#1A1A2A', borderRadius: '10px', borderLeft: `3px solid #FFD700` };
  const observacaoTextStyle: React.CSSProperties = { fontSize: '11px', color: '#DDD', margin: '4px 0', wordBreak: 'break-word' };
  const observacaoInputStyle: React.CSSProperties = { width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #FFD700', fontSize: '11px', backgroundColor: '#111', color: '#FFF', marginTop: '8px' };
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
  const dangerBtnStyle: React.CSSProperties = { backgroundColor: '#DC2626', color: '#FFF', padding: '10px 20px', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' };
  const statusSelectStyle: React.CSSProperties = { width: '100%', padding: '8px', borderRadius: '8px', border: `1px solid #FFD700`, fontSize: '12px', backgroundColor: '#111', color: '#FFF', marginTop: '8px' };
  const observacaoTextareaStyle: React.CSSProperties = { width: '100%', padding: '8px', borderRadius: '8px', border: `1px solid #FFD700`, fontSize: '11px', backgroundColor: '#111', color: '#FFF', marginTop: '8px', resize: 'vertical' };

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
        .rota-text { 
          font-size: 10px; 
          color: #FFD700; 
          word-break: break-word;
          white-space: normal;
          line-height: 1.4;
        }
        .nome-motorista:hover {
          text-decoration: underline;
          color: #FFD700;
        }
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
                  <div key={notif.id} style={notificationItemStyle} onClick={() => { abrirWhatsAppChat(notif.telefone, notif.from); setShowNotifications(false); setUnreadCount(0); }}>
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
          <button style={{ ...reportBtnStyle, backgroundColor: whatsappReady ? '#075E54' : '#25D366', color: '#FFF' }} onClick={() => { if (!whatsappReady) alert('⚠️ WhatsApp não está conectado!\n\nPara conectar:\n1. Certifique-se que o servidor backend está rodando (npm run server)\n2. Escaneie o QR Code que aparece no terminal do servidor'); else alert('✅ WhatsApp conectado! Clique no botão do motorista para conversar.'); }}>
            <MessageCircle size={18} /> {whatsappReady ? 'WhatsApp Conectado' : 'Conectar WhatsApp'}
          </button>
          <button style={reportBtnStyle} onClick={handleOpenRelatorio}><BarChart3 size={18} /> Relatório</button>
          <button 
            style={{ 
              ...reportBtnStyle, 
              backgroundColor: visaoAtiva === 'mapa' ? '#FFD700' : '#1A1A1A', 
              color: visaoAtiva === 'mapa' ? '#000' : '#FFF',
              border: visaoAtiva === 'mapa' ? 'none' : '1px solid #333'
            }} 
            onClick={() => setVisaoAtiva(visaoAtiva === 'lista' ? 'mapa' : 'lista')}
          >
            {visaoAtiva === 'lista' ? '🗺️ Visão em Mapa' : '📋 Voltar para Lista'}
          </button>
          <button 
            style={dangerBtnStyle} 
            onClick={() => setShowDeleteAllCargasConfirm(true)}
            disabled={loading}
          >
            <Trash2 size={18} /> Excluir Todas as Cargas
          </button>
        </div>
      </div>

      {/* DASHBOARD EXPANDIDO COM TODOS OS STATUS */}
      <div style={statsGridStyle}>
        <div style={statsGridItemStyle}><span style={statsGridNumberStyle}>{stats.total}</span><span style={statsGridLabelStyle}>Total</span></div>
        <div style={{ width: '1px', backgroundColor: '#333', margin: '0 8px' }} />
        <div style={statsGridItemStyle}><span style={{ ...statsGridNumberStyle, color: '#22C55E' }}>{stats.comProgramacao}</span><span style={statsGridLabelStyle}>Programados</span></div>
        <div style={statsGridItemStyle}><span style={{ ...statsGridNumberStyle, color: '#3B82F6' }}>{stats.disponiveis}</span><span style={statsGridLabelStyle}>Disponíveis</span></div>
        <div style={{ width: '1px', backgroundColor: '#333', margin: '0 8px' }} />
        <div style={statsGridItemStyle}><span style={{ ...statsGridNumberStyle, color: '#FFD700' }}>{stats.folga}</span><span style={statsGridLabelStyle}>Folga</span></div>
        <div style={statsGridItemStyle}><span style={{ ...statsGridNumberStyle, color: '#FFD700' }}>{stats.ferias}</span><span style={statsGridLabelStyle}>Férias</span></div>
        <div style={{ width: '1px', backgroundColor: '#333', margin: '0 8px' }} />
        <div style={statsGridItemStyle}><span style={{ ...statsGridNumberStyle, color: '#EF4444' }}>{stats.semVeiculo}</span><span style={statsGridLabelStyle}>Sem Veículo</span></div>
        <div style={statsGridItemStyle}><span style={{ ...statsGridNumberStyle, color: '#FF9500' }}>{stats.veiculoManutencao}</span><span style={statsGridLabelStyle}>Veic. Manut.</span></div>
        <div style={{ width: '1px', backgroundColor: '#333', margin: '0 8px' }} />
        <div style={statsGridItemStyle}><span style={{ ...statsGridNumberStyle, color: '#EF4444' }}>{stats.falta}</span><span style={statsGridLabelStyle}>Falta</span></div>
        <div style={statsGridItemStyle}><span style={{ ...statsGridNumberStyle, color: '#8B5CF6' }}>{stats.atestado}</span><span style={statsGridLabelStyle}>Atestado</span></div>
        <div style={{ width: '1px', backgroundColor: '#333', margin: '0 8px' }} />
        <div style={statsGridItemStyle}><span style={{ ...statsGridNumberStyle, color: '#FFD700' }}>{stats.totalViagens}</span><span style={statsGridLabelStyle}>Viagens</span></div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO PARA EXCLUIR TODAS AS CARGAS */}
      {showDeleteAllCargasConfirm && (
        <div style={deleteConfirmModalStyle}>
          <div style={deleteConfirmContentStyle}>
            <h3 style={{ color: '#EF4444', marginBottom: '20px' }}>⚠️ Atenção!</h3>
            <p style={{ color: '#AAA', marginBottom: '10px' }}>
              Esta ação irá <strong style={{ color: '#EF4444' }}>EXCLUIR PERMANENTEMENTE</strong> TODAS as cargas de <strong>TODOS</strong> os motoristas.
            </p>
            <p style={{ color: '#666', fontSize: '12px', marginBottom: '20px' }}>
              Isso inclui cargas programadas, em andamento e finalizadas. Esta ação não pode ser desfeita.
            </p>
            <p style={{ color: '#FFD700', fontSize: '13px', marginBottom: '25px' }}>
              Deseja realmente continuar?
            </p>
            <div style={deleteConfirmButtonsStyle}>
              <button 
                style={{ ...deleteConfirmBtnStyle, backgroundColor: '#333', color: '#AAA' }} 
                onClick={() => setShowDeleteAllCargasConfirm(false)}
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                style={{ ...deleteConfirmBtnStyle, backgroundColor: '#EF4444', color: '#fff' }} 
                onClick={handleDeleteAllCargas}
                disabled={loading}
              >
                {loading ? 'Excluindo...' : 'Sim, Excluir Todas'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* CONTEÚDO PRINCIPAL - LISTA OU MAPA */}
      {visaoAtiva === 'lista' ? (
        <>
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
                const statusMotoristaInfo = getStatusMotorista(m, carga, eventoHoje);
                const statusSalvo = statusSelecionado[m.id];
                const observacaoTempVal = observacaoTemp[m.id] || '';
                const checkin = checkinsPorMotorista.get(m.id);
                const canhotos = carga?.id ? canhotosPorCarga.get(carga.id) : [];
                const isLoadingCanhotos = carga?.id ? loadingCanhotos.get(carga.id) : false;
                const escalaInfo = escalaInfoPorMotorista[m.id] || { diasConsecutivosTrabalhados: 0, precisaFolgar: false, porcentagemPresenca: 0 };
                const placaVeiculo = carga?.placa || '';
                const veiculoData = veiculos[placaVeiculo];
                const localizacaoVeiculo = veiculoData?.ultimaLocalizacao || null;
                const velocidadeVeiculo = getVelocidade(veiculoData);
                const coordenadasVeiculo = veiculoData?.coordenadas || null;
                const ultimaAtualizacao = veiculoData?.ultimaAtualizacaoRastreador;
                const statusRastreador = veiculoData?.statusRastreador;
                const ignicao = veiculoData?.ignicao;
                const rotaMonisat = veiculoData?.rotaMonisat || null;
                const ultimaAtualizacaoRota = veiculoData?.ultimaAtualizacaoRotaMonisat;
                const veiculoEmbarcado = getVeiculoEmbarcado(m.nome);
                const veiculoEmbarcadoData = veiculoEmbarcado?.placa ? veiculos[veiculoEmbarcado.placa] : null;

                return (
                  <div key={m.id} style={cardStyle}>
                    <div style={{ ...fotoWrapperStyle, background: `linear-gradient(135deg, ${getRandomColor(m.id)}, #1a1a1a)` }}>
                      {m.fotoPerfilUrl ? <img src={m.fotoPerfilUrl} alt={m.nome} style={fotoStyle} /> : <div style={initialsStyle}>{getInitials(m.nome)}</div>}
                      <div style={moppBadgeStyle}>{m.temMopp === 'Sim' ? '✅ MOPP' : '❌ Sem MOPP'}</div>
                    </div>
                    <div style={contentStyle}>
                      {/* Nome clicável */}
                      <h3 
                        style={nomeStyle} 
                        className="nome-motorista"
                        onClick={(e) => handleNomeClick(m.id, e)}
                      >
                        {m.nome}
                      </h3>
                      <p style={cpfStyle}>{m.cpf}</p>
                      <div style={infoEscalaCardStyle}>
                        <div style={infoEscalaRowStyle}>
                          <span style={infoEscalaLabelStyle}><Clock size={10} style={{ marginRight: '4px' }} /> Dias consecutivos</span>
                          <span style={infoEscalaValueStyle}>{escalaInfo.diasConsecutivosTrabalhados}</span>
                        </div>
                      </div>
                      <div style={infoGridStyle}>
                        <div style={infoItemStyle}><MapPin size={12} color="#FFD700" /><span><strong>Cidade:</strong> {m.cidade || 'Não informada'}</span></div>
                        <div style={infoItemStyle}><span>📱</span><span><strong>Telefone:</strong> {m.whatsapp || m.telefone || 'Não informado'}</span></div>
                      </div>
                      <div style={{ ...infoItemStyle, marginBottom: '12px' }}>
                        <span>🚛</span><span><strong>Viagens Realizadas:</strong> {m.viagensRealizadas || 0}</span>
                      </div>

                      {/* VEÍCULO EMBARCADO - Mostra mesmo sem programação */}
                      {veiculoEmbarcado && (
                        <>
                          <div style={monitoriaRowStyle}>
                            <span style={monitoriaLabelStyle}>🚛 VEÍCULO EMBARCADO:</span>
                            <span style={{ ...monitoriaValueStyle, color: '#22C55E', fontWeight: 'bold' }}>
                              {veiculoEmbarcado.placa}
                              {veiculoEmbarcado.tipo && ` (${veiculoEmbarcado.tipo === 'toco' ? 'Toco' : veiculoEmbarcado.tipo === 'trucado' ? 'Trucado' : 'Truck'})`}
                            </span>
                          </div>
                          
                          {/* LOCALIZAÇÃO DO VEÍCULO EMBARCADO (mesmo sem programação) */}
                          {veiculoEmbarcadoData && (
                            <>
                              <div style={monitoriaRowStyle}>
                                <span style={monitoriaLabelStyle}>📡 RASTREADOR:</span>
                                <span style={{ ...monitoriaValueStyle, color: veiculoEmbarcadoData.statusRastreador === 'online' ? '#22C55E' : '#EF4444' }}>
                                  {veiculoEmbarcadoData.statusRastreador === 'online' ? '🟢 ONLINE' : '🔴 OFFLINE'}
                                </span>
                              </div>
                              
                              {veiculoEmbarcadoData.ignicao && (
                                <div style={monitoriaRowStyle}>
                                  <span style={monitoriaLabelStyle}>🔑 IGNIÇÃO:</span>
                                  <span style={{ ...monitoriaValueStyle, color: veiculoEmbarcadoData.ignicao === 'LIGADO' ? '#22C55E' : '#EF4444' }}>
                                    {veiculoEmbarcadoData.ignicao === 'LIGADO' ? '🟢 LIGADA' : '🔴 DESLIGADA'}
                                  </span>
                                </div>
                              )}
                              
                              {veiculoEmbarcadoData.ultimaLocalizacao && veiculoEmbarcadoData.ultimaLocalizacao !== '—' ? (
                                <div style={monitoriaRowStyle}>
                                  <span style={monitoriaLabelStyle}>📍 LOCALIZAÇÃO:</span>
                                  <span style={{ ...monitoriaValueStyle, color: '#22C55E', fontSize: '10px' }}>
                                    {veiculoEmbarcadoData.ultimaLocalizacao.length > 50 
                                      ? veiculoEmbarcadoData.ultimaLocalizacao.substring(0, 47) + '...' 
                                      : veiculoEmbarcadoData.ultimaLocalizacao}
                                  </span>
                                </div>
                              ) : (
                                <div style={monitoriaRowStyle}>
                                  <span style={monitoriaLabelStyle}>📍 LOCALIZAÇÃO:</span>
                                  <span style={{ ...monitoriaValueStyle, color: '#666' }}>Não disponível</span>
                                </div>
                              )}
                              
                              <div style={monitoriaRowStyle}>
                                <span style={monitoriaLabelStyle}><Gauge size={10} style={{ display: 'inline', marginRight: '4px' }} /> 🏎️ VELOCIDADE:</span>
                                <span style={{ 
                                  ...monitoriaValueStyle, 
                                  color: getVelocidadeColor(getVelocidade(veiculoEmbarcadoData)), 
                                  fontWeight: getVelocidade(veiculoEmbarcadoData) > 80 ? 800 : 600 
                                }}>
                                  {getVelocidadeIcon(getVelocidade(veiculoEmbarcadoData))} 
                                  {getVelocidade(veiculoEmbarcadoData) > 0 
                                    ? `${getVelocidade(veiculoEmbarcadoData)} km/h` 
                                    : 'Parado'}
                                  {getVelocidade(veiculoEmbarcadoData) > 80 && (
                                    <span style={{ marginLeft: '6px', backgroundColor: '#EF4444', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '8px', fontWeight: 800 }}>
                                      EXCESSO!
                                    </span>
                                  )}
                                </span>
                              </div>
                              
                              <div style={monitoriaRowStyle}>
                                <span style={monitoriaLabelStyle}>🕐 ÚLTIMA ATUALIZAÇÃO:</span>
                                <span style={{ ...monitoriaValueStyle, color: '#FFD700' }}>
                                  {formatarUltimaAtualizacao(veiculoEmbarcadoData.ultimaAtualizacaoRastreador)}
                                </span>
                              </div>
                              
                              {veiculoEmbarcadoData.ultimaMacro && (
                                <div style={monitoriaRowStyle}>
                                  <span style={monitoriaLabelStyle}>🏷️ ÚLTIMA MACRO:</span>
                                  <span style={{ ...monitoriaValueStyle, color: '#FFD700' }}>
                                    {veiculoEmbarcadoData.ultimaMacro}
                                  </span>
                                </div>
                              )}
                              
                              {/* ROTA MONISAT do veículo embarcado */}
                              {veiculoEmbarcadoData.rotaMonisat && (
                                <>
                                  <div style={{ ...monitoriaRowStyle, borderTop: '1px solid #2A2A2A', marginTop: '4px', paddingTop: '8px' }}>
                                    <span style={monitoriaLabelStyle}><Route size={10} style={{ display: 'inline', marginRight: '4px' }} /> 🛣️ ROTA MONISAT:</span>
                                    <span className="rota-text" style={{ ...monitoriaValueStyle, color: '#FFD700', fontSize: '10px', maxWidth: '70%', textAlign: 'right' }}>
                                      {veiculoEmbarcadoData.rotaMonisat}
                                    </span>
                                  </div>
                                  {veiculoEmbarcadoData.ultimaAtualizacaoRotaMonisat && (
                                    <div style={monitoriaRowStyle}>
                                      <span style={monitoriaLabelStyle}>🕐 ATUALIZAÇÃO ROTA:</span>
                                      <span style={{ ...monitoriaValueStyle, color: '#888', fontSize: '9px' }}>
                                        {formatarUltimaAtualizacaoRota(veiculoEmbarcadoData.ultimaAtualizacaoRotaMonisat)}
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </>
                      )}

                      {/* STATUS DO MOTORISTA (para filtro sem programação) */}
                      {!temProgramacao && (
                        <div 
                          style={statusCardStyle(statusMotoristaInfo.bg, statusMotoristaInfo.cor)}
                          onClick={() => setStatusMotoristaEditando(m.id)}
                        >
                          {statusMotoristaEditando === m.id ? (
                            <>
                              <select 
                                style={statusSelectStyle}
                                value={statusSalvo || statusMotoristaInfo.value}
                                onChange={(e) => salvarStatusMotorista(m.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="disponivel">✅ Disponível para Programar</option>
                                <option value="folga">😴 Folga</option>
                                <option value="ferias">🏖️ Férias</option>
                                <option value="sem_veiculo">🚫 Sem Veículo</option>
                                <option value="falta">❌ Falta</option>
                                <option value="atestado">📋 Atestado</option>
                                <option value="veiculo_manutencao">🔧 Veículo em Manutenção</option>
                              </select>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button 
                                  style={{ ...smallButtonStyle, backgroundColor: '#22C55E', color: '#000' }} 
                                  onClick={(e) => { e.stopPropagation(); const select = e.currentTarget.parentElement?.querySelector('select'); if (select) salvarStatusMotorista(m.id, select.value); }}
                                >
                                  <Save size={10} /> Salvar
                                </button>
                                <button 
                                  style={{ ...smallButtonStyle, backgroundColor: '#EF4444', color: '#FFF' }} 
                                  onClick={(e) => { e.stopPropagation(); setStatusMotoristaEditando(null); }}
                                >
                                  Cancelar
                                </button>
                              </div>
                            </>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div>
                                <span style={{ fontSize: '20px', marginRight: '8px' }}>{statusMotoristaInfo.icon}</span>
                                <span style={{ fontWeight: 700, color: statusMotoristaInfo.cor, fontSize: '14px' }}>{statusMotoristaInfo.label}</span>
                              </div>
                              <Edit3 size={14} style={{ color: '#888' }} />
                            </div>
                          )}
                        </div>
                      )}

                      {/* OBSERVAÇÃO */}
                      <div style={observacaoContainerStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '10px', color: '#FFD700' }}>📝</span>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#FFD700' }}>OBSERVAÇÃO</span>
                        </div>
                        {observacaoEditando === m.id ? (
                          <div>
                            <textarea 
                              style={observacaoTextareaStyle} 
                              rows={3} 
                              placeholder="Digite uma observação sobre o motorista..." 
                              defaultValue={observacaoTempVal || ''} 
                              id={`obs_${m.id}`} 
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              <button 
                                style={{ ...smallButtonStyle, backgroundColor: '#22C55E', color: '#000' }} 
                                onClick={(e) => { e.stopPropagation(); const textarea = document.getElementById(`obs_${m.id}`) as HTMLTextAreaElement; if (textarea) salvarObservacaoTemp(m.id, textarea.value); }}
                              >
                                <Save size={10} /> Salvar
                              </button>
                              <button 
                                style={{ ...smallButtonStyle, backgroundColor: '#EF4444', color: '#FFF' }} 
                                onClick={(e) => { e.stopPropagation(); setObservacaoEditando(null); }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p style={observacaoTextStyle}>{observacaoTempVal || 'Nenhuma observação cadastrada'}</p>
                            <button 
                              style={{ ...smallButtonStyle, backgroundColor: '#FFD70020', color: '#FFD700', border: '1px solid #FFD700' }} 
                              onClick={(e) => { e.stopPropagation(); setObservacaoEditando(m.id); }}
                            >
                              <Edit3 size={10} /> {observacaoTempVal ? 'Editar Observação' : 'Adicionar Observação'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* PROGRAMAÇÃO ATUAL */}
                      {temProgramacao && carga && (
                        <>
                          <div style={programacaoContainerStyle}>
                            <div style={programacaoHeaderStyle}>
                              <Truck size={14} color="#888" />
                              <h4 style={programacaoTitleStyle}>Programação Atual</h4>
                              {STATUS_CARGA_MAP[carga.status] && (
                                <span style={programacaoStatusStyle(STATUS_CARGA_MAP[carga.status].cor, STATUS_CARGA_MAP[carga.status].bg)}>
                                  {STATUS_CARGA_MAP[carga.status].icon} {STATUS_CARGA_MAP[carga.status].label}
                                </span>
                              )}
                            </div>
                            <div style={programacaoInfoStyle}>
                              <strong style={{ color: '#FFD700' }}>DT:</strong> {carga.dt || '—'}
                            </div>
                            <div style={{ ...programacaoInfoStyle, marginTop: '4px' }}>
                              <MapPin size={12} color="#FFD700" />
                              <span><strong>Coleta:</strong> {carga.coletaCidade} - {carga.coletaLocal}</span>
                            </div>
                            <div style={programacaoInfoStyle}>
                              <Calendar size={12} color="#FFD700" />
                              <span>{carga.coletaData || '—'}</span>
                            </div>
                            <div style={{ ...programacaoInfoStyle, marginTop: '4px' }}>
                              <MapPin size={12} color="#22C55E" />
                              <span><strong>Entrega:</strong> {carga.entregaCidade} - {carga.entregaLocal}</span>
                            </div>
                            <div style={programacaoInfoStyle}>
                              <Calendar size={12} color="#22C55E" />
                              <span>{carga.entregaData || '—'}</span>
                            </div>
                            <div style={{ ...programacaoInfoStyle, marginTop: '8px', borderTop: '1px solid #1F1F1F', paddingTop: '8px' }}>
                              <Truck size={12} color="#888" />
                              <span><strong>Placa Cavalo:</strong> <span style={programacaoPlacaStyle}>{carga.placa || '—'}</span></span>
                            </div>
                            {carga.carreta && (
                              <div style={programacaoInfoStyle}>
                                <Truck size={12} color="#888" />
                                <span><strong>Placa Carreta:</strong> <span style={programacaoPlacaStyle}>{carga.carreta}</span></span>
                              </div>
                            )}
                            <div style={programacaoInfoStyle}>
                              <strong>Peso:</strong> {carga.peso || '—'} kg
                            </div>
                          </div>

                          {/* MONITORAMENTO - Só mostra se NÃO tiver veículo embarcado já mostrando */}
                          {!veiculoEmbarcado && (
                            <div style={monitoriaCardStyle}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <Activity size={12} color="#FFD700" />
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#FFD700' }}>MONITORAMENTO</span>
                              </div>
                              <div style={monitoriaRowStyle}>
                                <span style={monitoriaLabelStyle}>📡 RASTREADOR:</span>
                                <span style={{ ...monitoriaValueStyle, color: statusRastreador === 'online' ? '#22C55E' : '#EF4444' }}>
                                  {statusRastreador === 'online' ? '🟢 ONLINE' : '🔴 OFFLINE'}
                                </span>
                              </div>
                              {ignicao && (
                                <div style={monitoriaRowStyle}>
                                  <span style={monitoriaLabelStyle}>🔑 IGNIÇÃO:</span>
                                  <span style={{ ...monitoriaValueStyle, color: ignicao === 'LIGADO' ? '#22C55E' : '#EF4444' }}>
                                    {ignicao === 'LIGADO' ? '🟢 LIGADA' : '🔴 DESLIGADA'}
                                  </span>
                                </div>
                              )}
                              {localizacaoVeiculo && localizacaoVeiculo !== '—' ? (
                                <div style={monitoriaRowStyle}>
                                  <span style={monitoriaLabelStyle}>📍 LOCALIZAÇÃO:</span>
                                  <span style={{ ...monitoriaValueStyle, color: '#22C55E', fontSize: '10px' }}>
                                    {localizacaoVeiculo.length > 50 ? localizacaoVeiculo.substring(0, 47) + '...' : localizacaoVeiculo}
                                  </span>
                                </div>
                              ) : (
                                <div style={monitoriaRowStyle}>
                                  <span style={monitoriaLabelStyle}>📍 LOCALIZAÇÃO:</span>
                                  <span style={{ ...monitoriaValueStyle, color: '#666' }}>Não disponível</span>
                                </div>
                              )}
                              <div style={monitoriaRowStyle}>
                                <span style={monitoriaLabelStyle}><Gauge size={10} style={{ display: 'inline', marginRight: '4px' }} /> 🏎️ VELOCIDADE:</span>
                                <span style={{ ...monitoriaValueStyle, color: getVelocidadeColor(velocidadeVeiculo), fontWeight: velocidadeVeiculo > 80 ? 800 : 600 }}>
                                  {getVelocidadeIcon(velocidadeVeiculo)} {velocidadeVeiculo > 0 ? `${velocidadeVeiculo} km/h` : 'Parado'}
                                  {velocidadeVeiculo > 80 && (
                                    <span style={{ marginLeft: '6px', backgroundColor: '#EF4444', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '8px', fontWeight: 800 }}>
                                      EXCESSO!
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div style={monitoriaRowStyle}>
                                <span style={monitoriaLabelStyle}>🕐 ÚLTIMA ATUALIZAÇÃO:</span>
                                <span style={{ ...monitoriaValueStyle, color: '#FFD700' }}>
                                  {formatarUltimaAtualizacao(ultimaAtualizacao)}
                                </span>
                              </div>
                              {veiculoData?.ultimaMacro && (
                                <div style={monitoriaRowStyle}>
                                  <span style={monitoriaLabelStyle}>🏷️ ÚLTIMA MACRO:</span>
                                  <span style={{ ...monitoriaValueStyle, color: '#FFD700' }}>
                                    {veiculoData.ultimaMacro}
                                  </span>
                                </div>
                              )}
                              {rotaMonisat && (
                                <>
                                  <div style={{ ...monitoriaRowStyle, borderTop: '1px solid #2A2A2A', marginTop: '4px', paddingTop: '8px' }}>
                                    <span style={monitoriaLabelStyle}><Route size={10} style={{ display: 'inline', marginRight: '4px' }} /> 🛣️ ROTA MONISAT:</span>
                                    <span className="rota-text" style={{ ...monitoriaValueStyle, color: '#FFD700', fontSize: '10px', maxWidth: '70%', textAlign: 'right' }}>
                                      {rotaMonisat}
                                    </span>
                                  </div>
                                  {ultimaAtualizacaoRota && (
                                    <div style={monitoriaRowStyle}>
                                      <span style={monitoriaLabelStyle}>🕐 ATUALIZAÇÃO ROTA:</span>
                                      <span style={{ ...monitoriaValueStyle, color: '#888', fontSize: '9px' }}>
                                        {formatarUltimaAtualizacaoRota(ultimaAtualizacaoRota)}
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                              <div style={monitoriaRowStyle}>
                                <span style={monitoriaLabelStyle}>📋 CHECK-IN:</span>
                                <span style={{ ...monitoriaValueStyle, color: checkin?.tipo ? '#22C55E' : '#EF4444' }}>
                                  {checkin?.tipo ? getCheckinLabel(checkin.tipo) : 'Aguardando check-in'}
                                </span>
                              </div>
                              {checkin?.dataHora && (
                                <div style={monitoriaRowStyle}>
                                  <span style={monitoriaLabelStyle}>⏰ DATA/HORA:</span>
                                  <span style={monitoriaValueStyle}>{checkin.dataHora}</span>
                                </div>
                              )}
                              {checkin?.pontualidade && (
                                <div style={monitoriaRowStyle}>
                                  <span style={monitoriaLabelStyle}>⏱️ PONTUALIDADE:</span>
                                  <span style={{ ...monitoriaValueStyle, color: checkin.pontualidade === 'On Time' ? '#22C55E' : '#EF4444' }}>
                                    {checkin.pontualidade}
                                  </span>
                                </div>
                              )}
                              {checkin?.localizacaoReal && (
                                <div style={monitoriaRowStyle}>
                                  <span style={monitoriaLabelStyle}>📍 LOCALIZAÇÃO CHECK-IN:</span>
                                  <span style={monitoriaValueStyle}>{checkin.localizacaoReal}</span>
                                </div>
                              )}
                              <div style={buttonGroupStyle}>
                                {checkin?.fotoUrl && (
                                  <button 
                                    style={{ ...smallButtonStyle, backgroundColor: '#3B82F620', color: '#3B82F6', border: '1px solid #3B82F6' }} 
                                    onClick={(e) => { e.stopPropagation(); setSelectedPhoto(checkin.fotoUrl!); setShowPhotoModal(true); }}>
                                    <Camera size={12} /> Ver Foto Check-in
                                  </button>
                                )}
                                {canhotos && canhotos.length > 0 && (
                                  <button 
                                    style={{ ...smallButtonStyle, backgroundColor: '#FFD70020', color: '#FFD700', border: '1px solid #FFD700' }} 
                                    onClick={(e) => { e.stopPropagation(); setCanhotosModalData({ canhotos, cargaNome: m.nome }); setShowCanhotosModal(true); }}>
                                    <Printer size={12} /> Ver {canhotos.length} Canhoto(s)
                                  </button>
                                )}
                                {isLoadingCanhotos && <span style={{ fontSize: '10px', color: '#AAA' }}>Carregando...</span>}
                              </div>
                            </div>
                          )}

                          {/* Se tem veículo embarcado, mostrar apenas CHECK-IN e AÇÕES (sem repetir rastreador/localização/etc) */}
                          {veiculoEmbarcado && (
                            <div style={monitoriaCardStyle}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <Activity size={12} color="#FFD700" />
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#FFD700' }}>CHECK-IN</span>
                              </div>
                              <div style={monitoriaRowStyle}>
                                <span style={monitoriaLabelStyle}>📋 CHECK-IN:</span>
                                <span style={{ ...monitoriaValueStyle, color: checkin?.tipo ? '#22C55E' : '#EF4444' }}>
                                  {checkin?.tipo ? getCheckinLabel(checkin.tipo) : 'Aguardando check-in'}
                                </span>
                              </div>
                              {checkin?.dataHora && (
                                <div style={monitoriaRowStyle}>
                                  <span style={monitoriaLabelStyle}>⏰ DATA/HORA:</span>
                                  <span style={monitoriaValueStyle}>{checkin.dataHora}</span>
                                </div>
                              )}
                              {checkin?.pontualidade && (
                                <div style={monitoriaRowStyle}>
                                  <span style={monitoriaLabelStyle}>⏱️ PONTUALIDADE:</span>
                                  <span style={{ ...monitoriaValueStyle, color: checkin.pontualidade === 'On Time' ? '#22C55E' : '#EF4444' }}>
                                    {checkin.pontualidade}
                                  </span>
                                </div>
                              )}
                              {checkin?.localizacaoReal && (
                                <div style={monitoriaRowStyle}>
                                  <span style={monitoriaLabelStyle}>📍 LOCALIZAÇÃO CHECK-IN:</span>
                                  <span style={monitoriaValueStyle}>{checkin.localizacaoReal}</span>
                                </div>
                              )}
                              <div style={buttonGroupStyle}>
                                {checkin?.fotoUrl && (
                                  <button 
                                    style={{ ...smallButtonStyle, backgroundColor: '#3B82F620', color: '#3B82F6', border: '1px solid #3B82F6' }} 
                                    onClick={(e) => { e.stopPropagation(); setSelectedPhoto(checkin.fotoUrl!); setShowPhotoModal(true); }}>
                                    <Camera size={12} /> Ver Foto Check-in
                                  </button>
                                )}
                                {canhotos && canhotos.length > 0 && (
                                  <button 
                                    style={{ ...smallButtonStyle, backgroundColor: '#FFD70020', color: '#FFD700', border: '1px solid #FFD700' }} 
                                    onClick={(e) => { e.stopPropagation(); setCanhotosModalData({ canhotos, cargaNome: m.nome }); setShowCanhotosModal(true); }}>
                                    <Printer size={12} /> Ver {canhotos.length} Canhoto(s)
                                  </button>
                                )}
                                {isLoadingCanhotos && <span style={{ fontSize: '10px', color: '#AAA' }}>Carregando...</span>}
                              </div>
                            </div>
                          )}

                          {/* AÇÕES DA CARGA */}
                          <div style={actionButtonsStyle}>
                            <button 
                              style={{ ...actionButtonStyle, backgroundColor: '#3B82F620', color: '#3B82F6', borderColor: '#3B82F6' }} 
                              onClick={(e) => { e.stopPropagation(); if (carga) { setEditandoCarga(carga); setShowEditCargaModal(true); } }}>
                              <Edit3 size={14} /> Editar Carga
                            </button>
                            <button 
                              style={{ ...actionButtonStyle, backgroundColor: '#EF444420', color: '#EF4444', borderColor: '#EF4444' }} 
                              onClick={(e) => { e.stopPropagation(); if (carga) { handleExcluirCarga(carga); } }}>
                              <Trash2 size={14} /> Excluir Carga
                            </button>
                            <button 
                              style={{ ...actionButtonStyle, backgroundColor: '#22C55E20', color: '#22C55E', borderColor: '#22C55E' }} 
                              onClick={(e) => { e.stopPropagation(); if (carga) { setSelectedCargaForStatus(carga); setNewStatus(carga.status); setShowStatusModal(true); } }}>
                              <RotateCcw size={14} /> Alterar Status
                            </button>
                            <button 
                              style={{ ...actionButtonStyle, backgroundColor: '#FFD70020', color: '#FFD700', borderColor: '#FFD700' }} 
                              onClick={(e) => { e.stopPropagation(); if (carga) { handleFinalizarCarga(carga); } }}>
                              <Flag size={14} /> Finalizar Carga
                            </button>
                          </div>
                        </>
                      )}

                      {/* BOTÕES DE AÇÃO DO MOTORISTA */}
                      <div style={actionButtonsStyle}>
                        <button 
                          style={{ ...actionButtonStyle, backgroundColor: '#25D36620', color: '#25D366', borderColor: '#25D366' }} 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            abrirWhatsAppChat(m.whatsapp || m.telefone, m.nome); 
                          }}
                        >
                          <MessageCircle size={14} /> Conversar / Histórico
                        </button>
                        
                        <button 
                          style={actionButtonStyle} 
                          onClick={(e) => handleVerDetalhes(m.id, e)}
                        >
                          <UserCheck size={14} /> Ver Detalhes
                        </button>
                        
                        <button 
                          style={{ ...actionButtonStyle, backgroundColor: '#EF444420', color: '#EF4444', borderColor: '#EF4444' }} 
                          onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(m.id); }}>
                          <UserMinus size={14} /> Excluir
                        </button>
                        
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setMapaModalMotorista({ 
                              id: m.id, 
                              nome: m.nome, 
                              placa: placaVeiculo || veiculoEmbarcado?.placa || undefined, 
                              veiculoId: carga?.veiculo || undefined, 
                              coordenadas: coordenadasVeiculo || veiculoEmbarcadoData?.coordenadas || undefined, 
                              ultimaLocalizacao: localizacaoVeiculo || veiculoEmbarcadoData?.ultimaLocalizacao || undefined, 
                              ultimoEndereco: localizacaoVeiculo || veiculoEmbarcadoData?.ultimaLocalizacao || undefined, 
                              ultimaAtualizacao: ultimaAtualizacao || veiculoEmbarcadoData?.ultimaAtualizacaoRastreador, 
                              status: statusRastreador || veiculoEmbarcadoData?.statusRastreador, 
                              ultimaMacro: veiculoData?.ultimaMacro || veiculoEmbarcadoData?.ultimaMacro || undefined, 
                              rotaMonisat: rotaMonisat || veiculoEmbarcadoData?.rotaMonisat || undefined 
                            }); 
                          }} 
                          style={{ 
                            ...actionButtonStyle, 
                            backgroundColor: (coordenadasVeiculo?.lat && coordenadasVeiculo?.lng) || (veiculoEmbarcadoData?.coordenadas?.lat && veiculoEmbarcadoData?.coordenadas?.lng) ? '#3B82F6' : '#555', 
                            color: '#FFF', 
                            borderColor: (coordenadasVeiculo?.lat && coordenadasVeiculo?.lng) || (veiculoEmbarcadoData?.coordenadas?.lat && veiculoEmbarcadoData?.coordenadas?.lng) ? '#3B82F6' : '#555', 
                            opacity: (coordenadasVeiculo?.lat && coordenadasVeiculo?.lng) || (veiculoEmbarcadoData?.coordenadas?.lat && veiculoEmbarcadoData?.coordenadas?.lng) ? 1 : 0.5 
                          }} 
                          disabled={!((coordenadasVeiculo?.lat && coordenadasVeiculo?.lng) || (veiculoEmbarcadoData?.coordenadas?.lat && veiculoEmbarcadoData?.coordenadas?.lng))} 
                          title={!((coordenadasVeiculo?.lat && coordenadasVeiculo?.lng) || (veiculoEmbarcadoData?.coordenadas?.lat && veiculoEmbarcadoData?.coordenadas?.lng)) ? 'Coordenadas não disponíveis' : 'Ver no mapa'}>
                            <Navigation size={14} /> Ver Localização
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <VisaoMapa 
          motoristas={motoristasParaMapa}
          onSelectMotorista={onSelectMotorista}
          onRefresh={() => {
            console.log('Refresh mapa');
          }}
          loading={loadingData}
        />
      )}

      {/* MODAIS */}
      {showEditCargaModal && editandoCarga && (
        <div style={modalOverlayStyle} onClick={() => setShowEditCargaModal(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#FFF' }}>Editar Carga</h2>
              <button style={btnCloseStyle} onClick={() => setShowEditCargaModal(false)}><X size={18} /></button>
            </div>
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
            <div style={modalHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#FFF' }}>Alterar Status da Carga</h2>
              <button style={btnCloseStyle} onClick={() => setShowStatusModal(false)}><X size={18} /></button>
            </div>
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
            <div style={modalHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#FFF' }}>Foto do Check-in</h2>
              <button style={btnCloseStyle} onClick={() => setShowPhotoModal(false)}><X size={18} /></button>
            </div>
            <div style={{...modalBodyStyle, textAlign: 'center'}}>
              <img src={selectedPhoto} alt="Check-in" style={{ maxWidth: '100%', maxHeight: '50vh', borderRadius: '12px' }} />
            </div>
          </div>
        </div>
      )}

      {showCanhotosModal && canhotosModalData && (
        <div style={modalOverlayStyle} onClick={() => setShowCanhotosModal(false)}>
          <div style={{...modalContentStyle, maxWidth: '700px'}} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#FFF' }}>Canhotos - {canhotosModalData.cargaNome}</h2>
              <button style={btnCloseStyle} onClick={() => setShowCanhotosModal(false)}><X size={18} /></button>
            </div>
            <div style={modalBodyStyle}>
              <div style={galeriaGridStyle}>
                {canhotosModalData.canhotos.map((canhoto, idx) => (
                  <div key={idx}>
                    <img 
                      src={canhoto.url} 
                      alt={`Canhoto ${idx + 1}`} 
                      style={thumbnailStyle} 
                      className="thumbnail-hover" 
                      onClick={() => { setSelectedPhoto(canhoto.url); setShowCanhotosModal(false); setShowPhotoModal(true); }} 
                    />
                    <span style={{ display: 'block', textAlign: 'center', color: '#999', fontSize: '11px', marginTop: '4px' }}>
                      Canhoto {idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {mapaModalMotorista && (
        <MotoristaMapaModal 
          key={mapaModalMotorista.id} 
          isOpen={true} 
          onClose={() => setMapaModalMotorista(null)} 
          motorista={mapaModalMotorista} 
        />
      )}

      {/* MODAL ÚNICO - WHATSAPP CHAT/HISTÓRICO */}
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