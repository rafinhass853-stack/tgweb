import React, { useEffect, useState, useMemo } from 'react';
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
  getDoc,
  getDocs
} from 'firebase/firestore';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import {
  Truck, MapPin, Calendar, Clock, AlertCircle, BarChart3, Printer, X, Search, 
  UserCheck, UserMinus, CheckCircle, Edit3, Trash2, Flag, Camera, Images, 
  Navigation, Activity, Eye, RotateCcw, Filter, ChevronDown
} from 'lucide-react';
import MotoristaMapaModal from './ListaMotoristaMapaModal';

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
  ultimaMacro?: string;  // NOVO
}

interface ListaMotoristasProps {
  onSelectMotorista: (id: string) => void;
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
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [cargasPorMotorista, setCargasPorMotorista] = useState<Record<string, CargaProgramada | null>>({});
  const [escalaHojePorMotorista, setEscalaHojePorMotorista] = useState<Record<string, EventoEscala | null>>({});
  const [veiculos, setVeiculos] = useState<Record<string, VeiculoData>>({});
  
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
  const [ordenarDataEntrega, setOrdenarDataEntrega] = useState<'antigo' | 'novo'>('antigo');
  const [filtroStatusRelatorio, setFiltroStatusRelatorio] = useState<string>('todos');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  
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

  const hoje = new Date().toISOString().split('T')[0];

  useEffect(() => {
  const unsub = onSnapshot(collection(db, "veiculos"), (snap) => {
    const veiculosMap: Record<string, VeiculoData> = {};
    snap.forEach(doc => {
      const data = doc.data();
      veiculosMap[data.placa] = {
        placa: data.placa,
        ultimaLocalizacao: data.ultimaLocalizacao || '—',
        ultimaAtualizacaoRastreador: data.ultimaAtualizacaoRastreador,
        statusRastreador: data.statusRastreador || 'offline',
        velocidade: data.velocidade || 0,
        coordenadas: data.coordenadas,
        ultimaMacro: data.ultimaMacro || data.ultimoStatus || undefined  // NOVO
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

  const getStatusLabel = (status: string) => {
    const labels: any = {
      'programada': '📋 Programada',
      'aguardando_carregamento': '⏳ Aguardando Carregamento',
      'seguindo_para_entrega': '🚛 Seguindo para a entrega',
      'chegou_entrega': '📍 Chegou na Entrega'
    };
    return labels[status] || status;
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

  const getCheckinLabelShort = (tipo: string) => {
    const labels: any = {
      'chegada_coleta': '📍 Chegada Coleta',
      'saida_coleta': '🚚 Saída Coleta',
      'chegada_entrega': '🏭 Chegada Entrega',
      'saida_entrega': '✅ Saída Entrega',
      'inicio_viagem': '🚛 Início Viagem'
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
    setOrdenarDataEntrega('antigo');
    setFiltroStatusRelatorio('todos');
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

  const dadosRelatorio = useMemo(() => {
    const dados = motoristas.map(m => {
      const carga = cargasPorMotorista[m.id];
      const eventoEscala = escalaHojePorMotorista[m.id];
      const statusInfo = getStatusMotorista(m, carga, eventoEscala);
      const veiculoData = carga?.placa ? veiculos[carga.placa] : null;
      const checkin = checkinsPorMotorista.get(m.id);
      
      return {
        id: m.id,
        nome: m.nome,
        cpf: m.cpf,
        telefone: m.whatsapp || m.telefone || '—',
        cidade: m.cidade || '—',
        statusLabel: statusInfo.label,
        statusCor: statusInfo.cor,
        statusIcon: statusInfo.icon,
        statusValue: statusInfo.value,
        placa: carga?.placa || '—',
        carreta: carga?.carreta || '—',
        clienteEntrega: carga?.entregaLocal || '—',
        cidadeEntrega: carga?.entregaCidade || '—',
        dataEntrega: carga?.entregaData || '—',
        localizacao: veiculoData?.ultimaLocalizacao || '—',
        velocidade: veiculoData?.velocidade || 0,
        checkin: checkin?.tipo ? getCheckinLabelShort(checkin.tipo) : '⏳ Pendente',
        checkinData: checkin?.dataHora || '—',
        temProgramacao: carga !== null && carga !== undefined,
      };
    });
    
    let dadosFiltrados = dados;
    if (filtroStatusRelatorio !== 'todos') {
      dadosFiltrados = dados.filter(item => item.statusValue === filtroStatusRelatorio);
    }
    
    return dadosFiltrados.sort((a, b) => {
      if (a.dataEntrega === '—') return 1;
      if (b.dataEntrega === '—') return -1;
      
      const dateA = new Date(a.dataEntrega.split('/').reverse().join('-'));
      const dateB = new Date(b.dataEntrega.split('/').reverse().join('-'));
      
      if (ordenarDataEntrega === 'antigo') {
        return dateA.getTime() - dateB.getTime();
      } else {
        return dateB.getTime() - dateA.getTime();
      }
    });
  }, [motoristas, cargasPorMotorista, escalaHojePorMotorista, veiculos, checkinsPorMotorista, ordenarDataEntrega, filtroStatusRelatorio]);

  const containerStyle: React.CSSProperties = { padding: '40px 20px', backgroundColor: '#000', minHeight: '100vh', fontFamily: 'Inter, sans-serif' };
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

  return (
    <div style={containerStyle}>
      <style>{`
        * { box-sizing: border-box; }
        input:focus, select:focus, textarea:focus { border-color: #FFD700!important; outline: none; }
        button:hover { transform: translateY(-1px); filter: brightness(0.98); }
        .thumbnail-hover:hover { transform: scale(1.05); border-color: #FFD700; }
      `}</style>

      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>👥 Motoristas Cadastrados</h1>
          <p style={subtitleStyle}>Gerencie sua equipe de motoristas</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button style={reportBtnStyle} onClick={() => setShowReportModal(true)}>
            <BarChart3 size={18} /> Relatório
          </button>
          <div style={statsContainerStyle}>
            <div style={statItemStyle}>
              <span style={statNumberStyle}>{stats.total}</span>
              <span style={statLabelStyle}>Total</span>
            </div>
            <div style={statItemStyle}>
              <span style={{ ...statNumberStyle, color: '#22C55E' }}>{stats.comProgramacao}</span>
              <span style={statLabelStyle}>Programados</span>
            </div>
            <div style={statItemStyle}>
              <span style={{ ...statNumberStyle, color: '#EF4444' }}>{stats.semProgramacao}</span>
              <span style={statLabelStyle}>Disponíveis</span>
            </div>
            <div style={statItemStyle}>
              <span style={{ ...statNumberStyle, color: '#FFD700' }}>{stats.totalViagens}</span>
              <span style={statLabelStyle}>Viagens Realizadas</span>
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS PRINCIPAL */}
      <div style={filtersContainerStyle}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            style={{...filterBtnStyle, ...(filtrosAbertos ? filterBtnActiveStyle : {})}} 
            onClick={() => setFiltrosAbertos(!filtrosAbertos)}
          >
            <Filter size={15} /> Filtros Avançados
            <ChevronDown size={15} style={{ transform: filtrosAbertos ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
          </button>
          {temFiltrosAtivos() && (
            <button style={clearAllBtnStyle} onClick={limparTodosFiltros}>
              <X size={14} /> Limpar Filtros
            </button>
          )}
        </div>

        <div style={searchWrapperStyle}>
          <span style={searchIconStyle}>🔍</span>
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou cidade..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            style={searchInputStyle}
          />
          {filtroTexto && <button onClick={() => setFiltroTexto('')} style={clearButtonStyle}>✕</button>}
        </div>

        <div style={selectsContainerStyle}>
          <div style={filterGroupStyle}>
            <label style={filterLabelStyle}>Programação</label>
            <select value={filtroStatusProgramacao} onChange={(e) => setFiltroStatusProgramacao(e.target.value as any)} style={selectStyle}>
              <option value="todos">Todos</option>
              <option value="comProgramacao">Com Programação</option>
              <option value="semProgramacao">Sem Programação</option>
            </select>
          </div>

          <div style={filterGroupStyle}>
            <label style={filterLabelStyle}>MOPP</label>
            <select value={filtroMopp} onChange={(e) => setFiltroMopp(e.target.value as any)} style={selectStyle}>
              <option value="todos">Todos</option>
              <option value="comMopp">Com MOPP</option>
              <option value="semMopp">Sem MOPP</option>
            </select>
          </div>
        </div>
      </div>

      {/* PAINEL DE FILTROS AVANÇADOS */}
      {filtrosAbertos && (
        <div style={filtersPanelStyle}>
          <div style={filtersGridStyle}>
            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>📋 Status da Carga</label>
              <select value={filtroStatusCarga} onChange={(e) => setFiltroStatusCarga(e.target.value)} style={selectStyle}>
                <option value="todos">Todos os Status</option>
                <option value="programada">📋 Programada</option>
                <option value="aguardando_carregamento">⏳ Aguardando Carregamento</option>
                <option value="seguindo_para_entrega">🚛 Seguindo para Entrega</option>
                <option value="chegou_entrega">📍 Chegou na Entrega</option>
              </select>
            </div>

            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>📍 Cidade Residência</label>
              <input
                type="text"
                placeholder="Digite a cidade..."
                value={filtroCidade}
                onChange={(e) => setFiltroCidade(e.target.value)}
                style={filterInputStyle}
              />
            </div>

            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>🚛 Placa do Veículo</label>
              <input
                type="text"
                placeholder="Digite a placa..."
                value={filtroPlaca}
                onChange={(e) => setFiltroPlaca(e.target.value.toUpperCase())}
                style={filterInputStyle}
              />
            </div>

            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>📡 Status Rastreador</label>
              <select value={filtroRastreador} onChange={(e) => setFiltroRastreador(e.target.value as any)} style={selectStyle}>
                <option value="todos">Todos</option>
                <option value="online">🟢 Online</option>
                <option value="offline">🔴 Offline</option>
              </select>
            </div>

            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>📦 Cliente Coleta</label>
              <input
                type="text"
                placeholder="Nome do cliente..."
                value={filtroClienteColeta}
                onChange={(e) => setFiltroClienteColeta(e.target.value)}
                style={filterInputStyle}
              />
            </div>

            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>🏭 Cliente Entrega</label>
              <input
                type="text"
                placeholder="Nome do cliente..."
                value={filtroClienteEntrega}
                onChange={(e) => setFiltroClienteEntrega(e.target.value)}
                style={filterInputStyle}
              />
            </div>

            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>📅 Data Entrega</label>
              <input
                type="date"
                value={filtroDataEntrega}
                onChange={(e) => setFiltroDataEntrega(e.target.value)}
                style={filterInputStyle}
              />
            </div>
          </div>
        </div>
      )}

      {loadingData ? (
        <div style={emptyStateStyle}>
          <Clock size={48} color="#666" className="spin" />
          <h3>Carregando informações...</h3>
        </div>
      ) : motoristasFiltrados.length === 0 ? (
        <div style={emptyStateStyle}>
          <AlertCircle size={48} color="#666" />
          <h3>Nenhum motorista encontrado com os filtros aplicados</h3>
        </div>
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
            
            const placaVeiculo = carga?.placa || '';
            const veiculoData = veiculos[placaVeiculo];
            const localizacaoVeiculo = veiculoData?.ultimaLocalizacao || null;
            const velocidadeVeiculo = veiculoData?.velocidade || 0;
            const coordenadasVeiculo = veiculoData?.coordenadas || null;
            
            const isFolga = eventoHoje?.tipo === 'Descanso Semanal' || eventoHoje?.tipo === 'Férias';
            const isTrabalhando = eventoHoje?.tipo === 'Presente';

            return (
              <div key={m.id} onClick={(e) => handleCardClick(m, e)} style={cardStyle}>
                <div style={{ ...fotoWrapperStyle, background: `linear-gradient(135deg, ${getRandomColor(m.id)}, #1a1a1a)` }}>
                  {m.fotoPerfilUrl ? (
                    <img src={m.fotoPerfilUrl} alt={m.nome} style={fotoStyle} />
                  ) : (
                    <div style={initialsStyle}>{getInitials(m.nome)}</div>
                  )}
                  <div style={moppBadgeStyle}>
                    {m.temMopp === 'Sim' ? '✅ MOPP' : '❌ Sem MOPP'}
                  </div>
                </div>

                <div style={contentStyle}>
                  <h3 style={nomeStyle}>{m.nome}</h3>
                  <p style={cpfStyle}>{m.cpf}</p>

                  <div style={infoGridStyle}>
                    <div style={infoItemStyle}>
                      <MapPin size={12} color="#FFD700" />
                      <span><strong>Cidade Residência:</strong> {m.cidade || 'Não informada'}</span>
                    </div>
                    <div style={infoItemStyle}>
                      <span>📱</span>
                      <span><strong>Telefone:</strong> {m.whatsapp || m.telefone || 'Não informado'}</span>
                    </div>
                  </div>

                  <div style={{ ...infoItemStyle, marginBottom: '12px' }}>
                    <span>🚛</span>
                    <span><strong>Viagens Realizadas:</strong> {m.viagensRealizadas || 0}</span>
                  </div>

                  {temProgramacao && carga && (
                    <>
                      <div style={programacaoContainerStyle}>
                        <div style={programacaoHeaderStyle}>
                          <Truck size={14} color="#888" />
                          <h4 style={programacaoTitleStyle}>Programação Atual</h4>
                          {statusInfo && (
                            <span style={programacaoStatusStyle(statusInfo.cor, statusInfo.bg)}>
                              {statusInfo.icon} {statusInfo.label}
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

                      <div style={monitoriaCardStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                          <Activity size={12} color="#FFD700" />
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#FFD700' }}>MONITORAMENTO</span>
                        </div>

                        {localizacaoVeiculo && (
                          <div style={monitoriaRowStyle}>
                            <span style={monitoriaLabelStyle}>📍 LOCALIZAÇÃO RASTREADOR:</span>
                            <span style={{ ...monitoriaValueStyle, color: '#22C55E' }}>
                              {localizacaoVeiculo} {velocidadeVeiculo > 0 && `🏎️ ${velocidadeVeiculo} km/h`}
                            </span>
                          </div>
                        )}

                        {veiculoData?.ultimaMacro && (
    <div style={monitoriaRowStyle}>
      <span style={monitoriaLabelStyle}>🏷️ ÚLTIMA MACRO:</span>
      <span style={{ ...monitoriaValueStyle, color: '#FFD700' }}>
        {veiculoData.ultimaMacro}
      </span>
    </div>
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
                              onClick={(e) => { e.stopPropagation(); setSelectedPhoto(checkin.fotoUrl!); setShowPhotoModal(true); }}
                            >
                              <Camera size={12} /> Ver Foto Check-in
                            </button>
                          )}
                          
                          {canhotos && canhotos.length > 0 && (
                            <button 
                              style={{ ...smallButtonStyle, backgroundColor: '#FFD70020', color: '#FFD700', border: '1px solid #FFD700' }}
                              onClick={(e) => { e.stopPropagation(); setCanhotosModalData({ canhotos, cargaNome: m.nome }); setShowCanhotosModal(true); }}
                            >
                              <Images size={12} /> Ver {canhotos.length} Canhoto(s)
                            </button>
                          )}
                          
                          {isLoadingCanhotos && <span style={{ fontSize: '10px', color: '#AAA' }}>Carregando...</span>}
                        </div>
                      </div>

                      {/* BOTÕES DE AÇÃO */}
                      <div style={actionButtonsStyle}>
                        <button 
                          style={{ ...actionButtonStyle, backgroundColor: '#3B82F620', color: '#3B82F6', borderColor: '#3B82F6' }}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (carga) {
                              setEditandoCarga(carga); 
                              setShowEditCargaModal(true);
                            }
                          }}
                        >
                          <Edit3 size={14} /> Editar Carga
                        </button>
                        <button 
                          style={{ ...actionButtonStyle, backgroundColor: '#EF444420', color: '#EF4444', borderColor: '#EF4444' }}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (carga) {
                              handleExcluirCarga(carga);
                            }
                          }}
                        >
                          <Trash2 size={14} /> Excluir Carga
                        </button>
                        <button 
                          style={{ ...actionButtonStyle, backgroundColor: '#22C55E20', color: '#22C55E', borderColor: '#22C55E' }}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (carga) {
                              setSelectedCargaForStatus(carga); 
                              setNewStatus(carga.status); 
                              setShowStatusModal(true);
                            }
                          }}
                        >
                          <RotateCcw size={14} /> Alterar Status
                        </button>
                        <button 
                          style={{ ...actionButtonStyle, backgroundColor: '#FFD70020', color: '#FFD700', borderColor: '#FFD700' }}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (carga) {
                              handleFinalizarCarga(carga);
                            }
                          }}
                        >
                          <Flag size={14} /> Finalizar Carga
                        </button>
                      </div>
                    </>
                  )}

                  {!temProgramacao && (
                    <div style={{ padding: '12px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center', backgroundColor: statusMotorista.bg, border: `1px solid ${statusMotorista.cor}` }}>
                      <span style={{ fontSize: '24px', marginRight: '8px' }}>{statusMotorista.icon}</span>
                      <span style={{ fontWeight: 700, color: statusMotorista.cor, fontSize: '14px' }}>{statusMotorista.label}</span>
                      {isFolga && (
                        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                          {eventoHoje?.tipo === 'Descanso Semanal' ? 'Descanso semanal - Não programar' : 'Férias - Não programar'}
                        </div>
                      )}
                      {isTrabalhando && !carga && (
                        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>Motorista está disponível para nova programação</div>
                      )}
                    </div>
                  )}

                  <div style={actionButtonsStyle}>
                    <button style={actionButtonStyle} onClick={() => onSelectMotorista(m.id)}>
                      <UserCheck size={14} /> Ver Detalhes
                    </button>
                    <button
                      style={{ ...actionButtonStyle, backgroundColor: '#EF444420', color: '#EF4444', borderColor: '#EF4444' }}
                      onClick={() => setShowDeleteConfirm(m.id)}
                    >
                      <UserMinus size={14} /> Excluir Motorista
                    </button>
                    {/* BOTÃO VER LOCALIZAÇÃO */}
                    <button
  onClick={() => {
    setMapaModalMotorista({
      id: m.id,
      nome: m.nome,
      placa: placaVeiculo || undefined,
      veiculoId: carga?.veiculo || undefined,
      coordenadas: coordenadasVeiculo || undefined,
      ultimaLocalizacao: localizacaoVeiculo || veiculoData?.ultimaLocalizacao || undefined,
      ultimoEndereco: localizacaoVeiculo || veiculoData?.ultimaLocalizacao || undefined,
      ultimaAtualizacao: veiculoData?.ultimaAtualizacaoRastreador,
      status: veiculoData?.statusRastreador,
      ultimaMacro: veiculoData?.ultimaMacro || undefined  // NOVO: Adicione esta linha
    });
  }}
  style={{
    ...actionButtonStyle,
    background: coordenadasVeiculo?.lat && coordenadasVeiculo?.lng ? '#3B82F6' : '#555',
    color: '#FFF',
    borderColor: coordenadasVeiculo?.lat && coordenadasVeiculo?.lng ? '#3B82F6' : '#555',
    opacity: coordenadasVeiculo?.lat && coordenadasVeiculo?.lng ? 1 : 0.5
  }}
  disabled={!coordenadasVeiculo?.lat || !coordenadasVeiculo?.lng}
  title={!coordenadasVeiculo?.lat || !coordenadasVeiculo?.lng ? 'Coordenadas não disponíveis' : 'Ver no mapa'}
>
  <Navigation size={14} /> Ver Localização
</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
                <div style={formGroupStyle}>
                  <label style={formLabelStyle}>DT</label>
                  <input style={formInputStyle} value={editandoCarga.dt || ''} onChange={e => setEditandoCarga({...editandoCarga, dt: e.target.value})} />
                </div>
                <div style={formGroupStyle}>
                  <label style={formLabelStyle}>Placa</label>
                  <input style={formInputStyle} value={editandoCarga.placa || ''} onChange={e => setEditandoCarga({...editandoCarga, placa: e.target.value})} />
                </div>
                <div style={formGroupStyle}>
                  <label style={formLabelStyle}>Carreta</label>
                  <input style={formInputStyle} value={editandoCarga.carreta || ''} onChange={e => setEditandoCarga({...editandoCarga, carreta: e.target.value})} />
                </div>
                <div style={formGroupStyle}>
                  <label style={formLabelStyle}>Peso (kg)</label>
                  <input style={formInputStyle} value={editandoCarga.peso || ''} onChange={e => setEditandoCarga({...editandoCarga, peso: e.target.value})} />
                </div>
              </div>

              <h4 style={{ color: '#FFD700', fontSize: '14px', margin: '16px 0 12px 0' }}>📍 Coleta</h4>
              <div style={formGridStyle}>
                <div style={formGroupStyle}>
                  <label style={formLabelStyle}>Data Coleta</label>
                  <input style={formInputStyle} value={editandoCarga.coletaData || ''} onChange={e => setEditandoCarga({...editandoCarga, coletaData: e.target.value})} />
                </div>
                <div style={formGroupStyle}>
                  <label style={formLabelStyle}>Cidade Coleta</label>
                  <input style={formInputStyle} value={editandoCarga.coletaCidade || ''} onChange={e => setEditandoCarga({...editandoCarga, coletaCidade: e.target.value})} />
                </div>
                <div style={formGroupStyle}>
                  <label style={formLabelStyle}>Local Coleta</label>
                  <input style={formInputStyle} value={editandoCarga.coletaLocal || ''} onChange={e => setEditandoCarga({...editandoCarga, coletaLocal: e.target.value})} />
                </div>
              </div>

              <h4 style={{ color: '#FFD700', fontSize: '14px', margin: '16px 0 12px 0' }}>🏭 Entrega</h4>
              <div style={formGridStyle}>
                <div style={formGroupStyle}>
                  <label style={formLabelStyle}>Data Entrega</label>
                  <input style={formInputStyle} value={editandoCarga.entregaData || ''} onChange={e => setEditandoCarga({...editandoCarga, entregaData: e.target.value})} />
                </div>
                <div style={formGroupStyle}>
                  <label style={formLabelStyle}>Cidade Entrega</label>
                  <input style={formInputStyle} value={editandoCarga.entregaCidade || ''} onChange={e => setEditandoCarga({...editandoCarga, entregaCidade: e.target.value})} />
                </div>
                <div style={formGroupStyle}>
                  <label style={formLabelStyle}>Local Entrega</label>
                  <input style={formInputStyle} value={editandoCarga.entregaLocal || ''} onChange={e => setEditandoCarga({...editandoCarga, entregaLocal: e.target.value})} />
                </div>
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
              <button style={{ ...deleteConfirmBtnStyle, backgroundColor: '#EF4444', color: '#fff' }} onClick={() => handleDeleteMotorista(showDeleteConfirm)} disabled={loading}>
                {loading ? 'Excluindo...' : 'Excluir'}
              </button>
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
                    <span style={{ display: 'block', textAlign: 'center', color: '#999', fontSize: '11px', marginTop: '4px' }}>Canhoto {idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RELATÓRIO COM FILTROS */}
      {showReportModal && (
        <div style={modalOverlayStyle} onClick={() => setShowReportModal(false)}>
          <div style={{...modalContentStyle, maxWidth: '1300px'}} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ background: '#FFD700', padding: '10px', borderRadius: '14px' }}>
                  <BarChart3 size={22} color="#000" />
                </div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#FFF' }}>Relatório de Motoristas</h2>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '20px' }}>
                  <span style={{ fontSize: '12px', color: '#888' }}>Filtrar por status:</span>
                  <select 
                    value={filtroStatusRelatorio} 
                    onChange={(e) => setFiltroStatusRelatorio(e.target.value)}
                    style={{ ...selectStyle, padding: '6px 12px', fontSize: '12px' }}
                  >
                    <option value="todos">📋 Todos os Status</option>
                    <option value="disponivel">✅ Disponível para Programar</option>
                    <option value="folga">😴 Em Folga Hoje</option>
                    <option value="programada">📋 Programado</option>
                    <option value="aguardando_carregamento">⏳ Aguardando Carregamento</option>
                    <option value="seguindo_para_entrega">🚛 Seguindo para a Entrega</option>
                    <option value="chegou_entrega">📍 Chegou na Entrega</option>
                  </select>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#888' }}>Ordenar por data:</span>
                  <button 
                    onClick={() => setOrdenarDataEntrega('antigo')}
                    style={{ ...smallButtonStyle, background: ordenarDataEntrega === 'antigo' ? '#FFD700' : '#333', color: ordenarDataEntrega === 'antigo' ? '#000' : '#AAA' }}
                  >
                    📅 Mais Antigo
                  </button>
                  <button 
                    onClick={() => setOrdenarDataEntrega('novo')}
                    style={{ ...smallButtonStyle, background: ordenarDataEntrega === 'novo' ? '#FFD700' : '#333', color: ordenarDataEntrega === 'novo' ? '#000' : '#AAA' }}
                  >
                    📅 Mais Recente
                  </button>
                </div>
              </div>
              <button style={btnCloseStyle} onClick={() => setShowReportModal(false)}><X size={18} /></button>
            </div>
            
            <div style={modalBodyStyle}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(5, 1fr)', 
                gap: '12px', 
                marginBottom: '24px' 
              }}>
                <div style={{ background: '#1A1A1A', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Total Motoristas</p>
                  <p style={{ fontSize: '28px', fontWeight: 800, color: '#FFD700' }}>{stats.total}</p>
                </div>
                <div style={{ background: '#1A1A1A', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Com Programação</p>
                  <p style={{ fontSize: '28px', fontWeight: 800, color: '#22C55E' }}>{stats.comProgramacao}</p>
                </div>
                <div style={{ background: '#1A1A1A', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Disponíveis</p>
                  <p style={{ fontSize: '28px', fontWeight: 800, color: '#EF4444' }}>{stats.semProgramacao}</p>
                </div>
                <div style={{ background: '#1A1A1A', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Com MOPP</p>
                  <p style={{ fontSize: '28px', fontWeight: 800, color: '#8B5CF6' }}>{stats.comMopp}</p>
                </div>
                <div style={{ background: '#1A1A1A', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Total Viagens</p>
                  <p style={{ fontSize: '28px', fontWeight: 800, color: '#FFD700' }}>{stats.totalViagens}</p>
                </div>
              </div>

              <div style={{ marginBottom: '16px', textAlign: 'right' }}>
                <span style={{ fontSize: '12px', color: '#FFD700' }}>
                  📊 {dadosRelatorio.length} motorista(s) encontrado(s)
                </span>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#0A0A0A', zIndex: 10 }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#FFD700', borderBottom: '2px solid #FFD700', background: '#0A0A0A' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#FFD700', borderBottom: '2px solid #FFD700', background: '#0A0A0A' }}>Motorista</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#FFD700', borderBottom: '2px solid #FFD700', background: '#0A0A0A' }}>CPF</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#FFD700', borderBottom: '2px solid #FFD700', background: '#0A0A0A' }}>Telefone</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#FFD700', borderBottom: '2px solid #FFD700', background: '#0A0A0A' }}>Placa Veículo</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#FFD700', borderBottom: '2px solid #FFD700', background: '#0A0A0A' }}>Carreta</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#FFD700', borderBottom: '2px solid #FFD700', background: '#0A0A0A' }}>Cliente Entrega</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#FFD700', borderBottom: '2px solid #FFD700', background: '#0A0A0A' }}>Cidade Entrega</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#FFD700', borderBottom: '2px solid #FFD700', background: '#0A0A0A' }}>Data Entrega</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#FFD700', borderBottom: '2px solid #FFD700', background: '#0A0A0A' }}>Localização</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#FFD700', borderBottom: '2px solid #FFD700', background: '#0A0A0A' }}>Check-in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosRelatorio.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                          <AlertCircle size={32} color="#666" />
                          <p>Nenhum motorista encontrado com o filtro selecionado</p>
                        </td>
                      </tr>
                    ) : (
                      dadosRelatorio.map((item, idx) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #1F1F1F', backgroundColor: idx % 2 === 0 ? '#0A0A0A' : '#0F0F0F' }}>
                          <td style={{ padding: '10px 8px' }}>
                            <span style={{ color: item.statusCor, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {item.statusIcon} {item.statusLabel}
                            </span>
                          </td>
                          <td style={{ padding: '10px 8px', color: '#AAA' }}>
                            <strong style={{ color: '#FFF' }}>{item.nome}</strong>
                            <div style={{ fontSize: '10px', color: '#666' }}>📍 {item.cidade}</div>
                          </td>
                          <td style={{ padding: '10px 8px', color: '#AAA', fontFamily: 'monospace' }}>{item.cpf}</td>
                          <td style={{ padding: '10px 8px', color: '#AAA' }}>{item.telefone}</td>
                          <td style={{ padding: '10px 8px' }}>
                            {item.placa !== '—' ? (
                              <span style={{ color: '#FFD700', fontWeight: 600, fontFamily: 'monospace' }}>{item.placa}</span>
                            ) : <span style={{ color: '#666' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            {item.carreta !== '—' && item.carreta !== item.placa ? (
                              <span style={{ color: '#FF9500', fontFamily: 'monospace' }}>{item.carreta}</span>
                            ) : <span style={{ color: '#666' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 8px', color: '#AAA' }}>
                            {item.clienteEntrega !== '—' ? (
                              <div>
                                <div>{item.clienteEntrega.length > 40 ? item.clienteEntrega.substring(0, 37) + '...' : item.clienteEntrega}</div>
                                {item.cidadeEntrega !== '—' && <div style={{ fontSize: '10px', color: '#10b981' }}>🏭 {item.cidadeEntrega}</div>}
                              </div>
                            ) : <span style={{ color: '#666' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 8px', color: '#AAA' }}>
                            {item.cidadeEntrega !== '—' ? (
                              <span style={{ color: '#3B82F6' }}>{item.cidadeEntrega}</span>
                            ) : <span style={{ color: '#666' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 8px', color: '#AAA' }}>
                            {item.dataEntrega !== '—' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Calendar size={12} color="#FFD700" />
                                <span>{item.dataEntrega}</span>
                              </div>
                            ) : <span style={{ color: '#666' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            {item.localizacao !== '—' ? (
                              <div>
                                <div style={{ color: '#22C55E', fontSize: '11px' }}>📍 {item.localizacao}</div>
                                {item.velocidade > 0 && (
                                  <div style={{ fontSize: '10px', color: '#FFD700' }}>🏎️ {item.velocidade} km/h</div>
                                )}
                              </div>
                            ) : <span style={{ color: '#666' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <div>
                              <span style={{ color: '#10b981' }}>{item.checkin}</span>
                              {item.checkinData !== '—' && (
                                <div style={{ fontSize: '10px', color: '#666' }}>{item.checkinData}</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #1F1F1F' }}>
                <button style={btnSecondaryStyle} onClick={() => window.print()}>
                  <Printer size={16} /> Imprimir
                </button>
                <button style={btnPrimaryStyle} onClick={() => setShowReportModal(false)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO MAPA */}
      {mapaModalMotorista && (
        <MotoristaMapaModal
          key={mapaModalMotorista.id}
          isOpen={true}
          onClose={() => setMapaModalMotorista(null)}
          motorista={mapaModalMotorista}
        />
      )}
    </div>
  );
};

export default ListaMotoristas;