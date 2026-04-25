import React, { useState, useEffect, useMemo } from 'react';
import { db, storage } from './firebase';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  serverTimestamp,
  where,
  getDocs,
  writeBatch,
  getDoc,
  addDoc  // <-- ADICIONADO addDoc AQUI
} from 'firebase/firestore';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import {
  Truck,
  ClipboardList,
  MapPin,
  Calendar,
  CheckCircle2,
  Trash2,
  Edit3,
  RefreshCw,
  Info,
  User,
  CreditCard,
  Hash,
  ExternalLink,
  X,
  Flag,
  RotateCcw,
  AlertCircle,
  Images,
  ChevronLeft,
  ChevronRight,
  Download,
  Camera,
  Activity,
  Navigation,
  Filter,
  Eye,
  Layers
} from 'lucide-react';

interface CargaData {
  id?: string;
  veiculo: string;
  dt: string;
  peso: string;
  motorista: string;
  cpf: string;
  placa: string;
  carreta: string;
  coletaData: string;
  coletaLocal: string;
  coletaCidade: string;
  coletaLink: string;
  entregaData: string;
  entregaLocal: string;
  entregaCidade: string;
  entregaLink: string;
  obs: string;
  pvs: string[];
  tipo: 'normal' | 'com_troca';
  status: 'programada' | 'finalizada' | 'em_andamento' | 'cancelada';
  troca?: {
    cliente: string;
    cidade: string;
    link: string;
  };
  criadoEm?: any;
  motoristaId?: string;
  statusViagem?: 'pendente' | 'em_andamento' | 'concluida';
  ultimoStatus?: string;
  dataUltimoStatus?: any;
}

interface HistoricoStatus {
  id?: string;
  cargaId: string;
  status: string;
  timestamp: any;
  motoristaNome: string;
}

interface LocalizacaoAtual {
  cidadeNome: string;
  latitude?: number;
  longitude?: number;
  timestamp?: any;
}

interface CheckinInfo {
  id: string;
  tipo: string;
  timestamp: any;
  fotoUrl?: string;
  cidadeMotorista?: string;
  coletaCidade?: string;
  coletaLocal?: string;
  dataHora?: string;
  pontualidade?: string;
  tipoFoto?: string;
  viagemId?: string;
  tipoCheckin?: string;
  localizacaoReal?: string;
}

interface CanhotoInfo {
  url: string;
  name: string;
  fullPath: string;
}

interface GaleriaData {
  cargaId: string;
  cargaNome: string;
  canhotos: CanhotoInfo[];
  urlsCanhotos: string[];
  quantidadeFotos: number;
  observacoesMotorista: string;
}

interface ImagemModalData {
  urls: string[];
  currentIndex: number;
  cargaNome: string;
  cargaId: string;
}

const VisualizarProgramacoes: React.FC = () => {
  const [listaCargas, setListaCargas] = useState<CargaData[]>([]);
  const [historicoStatus, setHistoricoStatus] = useState<HistoricoStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedCargaForStatus, setSelectedCargaForStatus] = useState<CargaData | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [editandoCarga, setEditandoCarga] = useState<CargaData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [filtroDataColeta, setFiltroDataColeta] = useState('');
  const [filtroDataEntrega, setFiltroDataEntrega] = useState('');
  const [filtroCidadeColeta, setFiltroCidadeColeta] = useState('');
  const [filtroCidadeEntrega, setFiltroCidadeEntrega] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroMotorista, setFiltroMotorista] = useState('');
  const [mostrarFinalizadas, setMostrarFinalizadas] = useState(false);
  const [localizacoesMotoristas, setLocalizacoesMotoristas] = useState<Map<string, LocalizacaoAtual>>(new Map());
  const [checkinsMotoristas, setCheckinsMotoristas] = useState<Map<string, CheckinInfo>>(new Map());
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedCheckinData, setSelectedCheckinData] = useState<CheckinInfo | null>(null);
  const [canhotosMotoristas, setCanhotosMotoristas] = useState<Map<string, CanhotoInfo[]>>(new Map());
  const [loadingCanhotos, setLoadingCanhotos] = useState<Map<string, boolean>>(new Map());
  const [fotosCheckinMotoristas, setFotosCheckinMotoristas] = useState<Map<string, string>>(new Map());
  const [showGaleriaModal, setShowGaleriaModal] = useState(false);
  const [galeriaData, setGaleriaData] = useState<GaleriaData | null>(null);
  const [showImagemModal, setShowImagemModal] = useState(false);
  const [imagemModalData, setImagemModalData] = useState<ImagemModalData | null>(null);

  const proximaImagem = () => {
    if (imagemModalData && imagemModalData.urls.length > 1) {
      const novoIndex = (imagemModalData.currentIndex + 1) % imagemModalData.urls.length;
      setImagemModalData({ ...imagemModalData, currentIndex: novoIndex });
    }
  };

  const imagemAnterior = () => {
    if (imagemModalData && imagemModalData.urls.length > 1) {
      const novoIndex = (imagemModalData.currentIndex - 1 + imagemModalData.urls.length) % imagemModalData.urls.length;
      setImagemModalData({ ...imagemModalData, currentIndex: novoIndex });
    }
  };

  const abrirModalGaleria = (carga: CargaData, canhotos: CanhotoInfo[]) => {
    if (!canhotos || canhotos.length === 0) return;
    
    setGaleriaData({
      cargaId: carga.id || '',
      cargaNome: carga.motorista,
      canhotos: canhotos,
      urlsCanhotos: canhotos.map(c => c.url),
      quantidadeFotos: canhotos.length,
      observacoesMotorista: carga.obs || ''
    });
    setShowGaleriaModal(true);
  };

  const abrirModalImagem = (urls: string[], index: number, cargaNome: string, cargaId: string) => {
    setImagemModalData({
      urls: urls,
      currentIndex: index,
      cargaNome: cargaNome,
      cargaId: cargaId
    });
    setShowImagemModal(true);
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "historicoStatus"), (snap) => {
      const historico: HistoricoStatus[] = [];
      snap.forEach(doc => {
        historico.push({ id: doc.id, ...doc.data() } as HistoricoStatus);
      });
      setHistoricoStatus(historico);
    });
    return () => unsub();
  }, []);

  const buscarCanhotos = async (cargaId: string) => {
    if (!cargaId) return;
    
    setLoadingCanhotos(prev => new Map(prev).set(cargaId, true));
    
    try {
      const storageRef = ref(storage);
      const viagensRef = ref(storage, 'viagens');
      
      try {
        const viagensResult = await listAll(viagensRef);
        const canhotosEncontrados: CanhotoInfo[] = [];
        
        for (const viagemFolder of viagensResult.prefixes) {
          const arquivosRef = ref(storage, viagemFolder.fullPath);
          const arquivosResult = await listAll(arquivosRef);
          
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
        
        setCanhotosMotoristas(prev => new Map(prev).set(cargaId, canhotosEncontrados));
      } catch (error) {
        console.error("Erro ao listar pastas de viagens:", error);
      }
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

  const buscarDadosMotorista = async (motoristaId: string, cargaId?: string) => {
    if (!motoristaId) return;

    try {
      const localizacaoRef = doc(db, "motoristas", motoristaId, "localizacoes", "atual");
      const localizacaoSnap = await getDoc(localizacaoRef);
      if (localizacaoSnap.exists()) {
        const data = localizacaoSnap.data();
        setLocalizacoesMotoristas(prev => new Map(prev).set(motoristaId, {
          cidadeNome: data.cidadeNome || "Localização não disponível",
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.timestamp
        }));
      } else {
        setLocalizacoesMotoristas(prev => new Map(prev).set(motoristaId, { cidadeNome: "Não disponível" }));
      }

      const checkinsQuery = query(
        collection(db, "motoristas", motoristaId, "historicoCheckins"),
        orderBy("timestamp", "desc")
      );
      const checkinsSnap = await getDocs(checkinsQuery);
      
      if (!checkinsSnap.empty) {
        let checkinDoc = checkinsSnap.docs[0];
        if (cargaId) {
          const checkinFiltrado = checkinsSnap.docs.find(doc => doc.data().viagemId === cargaId);
          if (checkinFiltrado) {
            checkinDoc = checkinFiltrado;
          }
        }
        
        const data = checkinDoc.data();
        const localizacaoReal = data.localizacaoReal || data.cidadeAtual || data.cidadeMotorista;
        
        const checkinInfo = {
          id: checkinDoc.id,
          tipo: data.tipo || "Não informado",
          timestamp: data.timestamp,
          fotoUrl: data.fotoUrl,
          cidadeMotorista: data.cidadeMotorista,
          coletaCidade: data.coletaCidade,
          coletaLocal: data.coletaLocal,
          dataHora: data.dataHora,
          pontualidade: data.pontualidade,
          tipoFoto: data.tipoFoto,
          viagemId: data.viagemId,
          tipoCheckin: data.tipo,
          localizacaoReal: localizacaoReal
        };
        
        setCheckinsMotoristas(prev => new Map(prev).set(motoristaId, checkinInfo));
        
        if (data.fotoUrl) {
          setFotosCheckinMotoristas(prev => new Map(prev).set(motoristaId, data.fotoUrl));
        }
      } else {
        setCheckinsMotoristas(prev => new Map(prev).set(motoristaId, { 
          id: "", 
          tipo: "Nenhum check-in",
          timestamp: null 
        }));
      }

      if (cargaId) {
        await buscarCanhotos(cargaId);
      }
    } catch (error) {
      console.error("Erro ao buscar dados do motorista:", error);
    }
  };

  useEffect(() => {
    listaCargas.forEach(carga => {
      if (carga.motoristaId && carga.status !== 'finalizada' && carga.status !== 'cancelada') {
        buscarDadosMotorista(carga.motoristaId, carga.id);
      }
    });
  }, [listaCargas]);

  useEffect(() => {
    const qMotoristas = query(collection(db, "motoristas"));
    const unsubMotoristas = onSnapshot(qMotoristas, (snapMotoristas) => {
      const unsubscribesCargas: (() => void)[] = [];
      const todasAsCargasMap = new Map<string, CargaData[]>();

      snapMotoristas.forEach((docMot) => {
        const motoristaId = docMot.id;
        const qCargas = query(collection(db, "motoristas", motoristaId, "cargas"), orderBy("criadoEm", "desc"));
        const unsubCargas = onSnapshot(qCargas, (snapCargas) => {
          const cargasDoMotorista: CargaData[] = [];
          snapCargas.forEach((docCarga) => {
            cargasDoMotorista.push({ id: docCarga.id, motoristaId, ...docCarga.data() } as CargaData);
          });
          todasAsCargasMap.set(motoristaId, cargasDoMotorista);
          const listaConsolidada: CargaData[] = [];
          todasAsCargasMap.forEach((cargas) => listaConsolidada.push(...cargas));
          listaConsolidada.sort((a, b) => {
            const timeA = a.criadoEm?.seconds || 0;
            const timeB = b.criadoEm?.seconds || 0;
            return timeB - timeA;
          });
          setListaCargas(listaConsolidada);
        });
        unsubscribesCargas.push(unsubCargas);
      });

      return () => {
        unsubscribesCargas.forEach(unsub => unsub());
      };
    });

    return () => unsubMotoristas();
  }, []);

  const podeFinalizarViagem = (carga: CargaData): boolean => {
    if (carga.status === 'finalizada' || carga.status === 'cancelada') return false;
    
    const ultimoRegistro = historicoStatus
      .filter(h => h.cargaId === carga.id)
      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))[0];
    
    if (!ultimoRegistro) return true;
    
    const statusQueBloqueiam = ['em_andamento', 'chegada_coleta', 'saida_coleta', 'chegada_entrega', 'saida_entrega', 'inicio_viagem'];
    return !statusQueBloqueiam.includes(ultimoRegistro.status);
  };

  const getStatusFormatado = (carga: CargaData) => {
    if (carga.status === 'finalizada') return { label: 'FINALIZADA', color: '#22C55E', icon: '✅' };
    if (carga.status === 'cancelada') return { label: 'CANCELADA', color: '#EF4444', icon: '❌' };
    
    const ultimoRegistro = historicoStatus
      .filter(h => h.cargaId === carga.id)
      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))[0];
    
    if (!ultimoRegistro) return { label: 'PROGRAMADA', color: '#FFD700', icon: '📋' };
    
    const statusMap: any = {
      'chegada_coleta': { label: 'CHEGADA NA COLETA', color: '#3B82F6', icon: '📍' },
      'saida_coleta': { label: 'SAÍDA DA COLETA', color: '#10B981', icon: '🚚' },
      'chegada_entrega': { label: 'CHEGADA NA ENTREGA', color: '#8B5CF6', icon: '🏭' },
      'saida_entrega': { label: 'SAÍDA DA ENTREGA', color: '#059669', icon: '✅' },
      'inicio_viagem': { label: 'INÍCIO DA VIAGEM', color: '#F59E0B', icon: '🚛' },
      'em_andamento': { label: 'EM ANDAMENTO', color: '#F97316', icon: '⚡' },
    };
    
    return statusMap[ultimoRegistro.status] || { label: ultimoRegistro.status.toUpperCase(), color: '#6B7280', icon: '📌' };
  };

  const editarStatusMotorista = async () => {
    if (!selectedCargaForStatus || !newStatus) return;
    
    setLoading(true);
    try {
      const cargaRef = doc(db, "motoristas", selectedCargaForStatus.motoristaId!, "cargas", selectedCargaForStatus.id!);
      
      await addDoc(collection(db, "historicoStatus"), {
        cargaId: selectedCargaForStatus.id,
        status: newStatus,
        timestamp: serverTimestamp(),
        motoristaNome: selectedCargaForStatus.motorista,
        acao: 'status_alterado_pelo_gestor',
        statusAnterior: selectedCargaForStatus.ultimoStatus || 'programada'
      });
      
      await updateDoc(cargaRef, { 
        ultimoStatus: newStatus,
        dataUltimoStatus: serverTimestamp()
      });
      
      alert(`✅ Status alterado para: ${getStatusLabel(newStatus)}`);
      setShowStatusModal(false);
      setSelectedCargaForStatus(null);
      setNewStatus('');
    } catch (err) {
      console.error(err);
      alert('❌ Erro ao alterar status.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: any = {
      'chegada_coleta': '📍 Chegada na Coleta',
      'saida_coleta': '🚚 Saída da Coleta',
      'chegada_entrega': '🏭 Chegada na Entrega',
      'saida_entrega': '✅ Saída da Entrega',
      'inicio_viagem': '🚛 Início da Viagem',
      'em_andamento': '⚡ Em Andamento',
      'programada': '📋 Programada'
    };
    return labels[status] || status;
  };

  const finalizarViagem = async (carga: CargaData) => {
    if (!podeFinalizarViagem(carga)) {
      alert('❌ Não é possível finalizar esta viagem pois o motorista já iniciou o transporte!');
      return;
    }
    
    if (!window.confirm(`Deseja finalizar a viagem do motorista ${carga.motorista}?`)) return;
    
    setLoading(true);
    try {
      const cargaRef = doc(db, "motoristas", carga.motoristaId!, "cargas", carga.id!);
      await updateDoc(cargaRef, { 
        status: 'finalizada',
        dataFinalizacao: serverTimestamp()
      });
      
      await addDoc(collection(db, "historicoStatus"), {
        cargaId: carga.id,
        status: 'finalizada_gestor',
        timestamp: serverTimestamp(),
        motoristaNome: carga.motorista,
        acao: 'finalizada_pelo_gestor'
      });
      
      alert('✅ Viagem finalizada com sucesso!');
    } catch (err) {
      console.error(err);
      alert('❌ Erro ao finalizar viagem.');
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarEdicao = async () => {
    if (!editandoCarga || !editandoCarga.id || !editandoCarga.motoristaId) return;
    setLoading(true);
    try {
      const cargaRef = doc(db, "motoristas", editandoCarga.motoristaId, "cargas", editandoCarga.id);
      const { id, criadoEm, motoristaId, ...dadosParaAtualizar } = editandoCarga;
      await updateDoc(cargaRef, dadosParaAtualizar);
      setShowEditModal(false); setEditandoCarga(null);
      alert("✅ Carga atualizada com sucesso!");
    } catch (err) { console.error(err); alert("❌ Erro ao atualizar carga."); } finally { setLoading(false); }
  };

  const cidadesColeta = useMemo(() => {
    const cidades = new Map<string, number>();
    listaCargas.forEach(c => { if (c.coletaCidade) cidades.set(c.coletaCidade, (cidades.get(c.coletaCidade) || 0) + 1); });
    return Array.from(cidades.entries()).sort((a, b) => b[1] - a[1]);
  }, [listaCargas]);

  const cidadesEntrega = useMemo(() => {
    const cidades = new Map<string, number>();
    listaCargas.forEach(c => { if (c.entregaCidade) cidades.set(c.entregaCidade, (cidades.get(c.entregaCidade) || 0) + 1); });
    return Array.from(cidades.entries()).sort((a, b) => b[1] - a[1]);
  }, [listaCargas]);

  const cargasFiltradas = useMemo(() => {
    let resultado = listaCargas.filter(carga => {
      if (!mostrarFinalizadas && carga.status === 'finalizada') return false;

      const dataColetaFormatada = filtroDataColeta ? filtroDataColeta.split('-').reverse().join('/') : '';
      const dataEntregaFormatada = filtroDataEntrega ? filtroDataEntrega.split('-').reverse().join('/') : '';
      const bateDataColeta = !filtroDataColeta || (carga.coletaData && carga.coletaData.includes(dataColetaFormatada));
      const bateDataEntrega = !filtroDataEntrega || (carga.entregaData && carga.entregaData.includes(dataEntregaFormatada));
      const bateCidadeColeta = !filtroCidadeColeta || (carga.coletaCidade && carga.coletaCidade.toLowerCase() === filtroCidadeColeta.toLowerCase());
      const bateCidadeEntrega = !filtroCidadeEntrega || (carga.entregaCidade && carga.entregaCidade.toLowerCase() === filtroCidadeEntrega.toLowerCase());
      const bateCliente = !filtroCliente ||
        (carga.coletaLocal && carga.coletaLocal.toLowerCase().includes(filtroCliente.toLowerCase())) ||
        (carga.entregaLocal && carga.entregaLocal.toLowerCase().includes(filtroCliente.toLowerCase()));
      const bateMotorista = !filtroMotorista || (carga.motorista && carga.motorista.toLowerCase().includes(filtroMotorista.toLowerCase()));

      return bateDataColeta && bateDataEntrega && bateCidadeColeta && bateCidadeEntrega && bateCliente && bateMotorista;
    });

    return resultado;
  }, [listaCargas, filtroDataColeta, filtroDataEntrega, filtroCidadeColeta, filtroCidadeEntrega, filtroCliente, filtroMotorista, mostrarFinalizadas]);

  const cargasAgrupadas = useMemo(() => {
    const grupos: { [key: string]: CargaData[] } = {};
    cargasFiltradas.forEach(carga => {
      const chave = `${carga.coletaCidade || 'Sem Origem'} (${carga.coletaLocal || 'Sem Cliente'})`;
      if (!grupos[chave]) grupos[chave] = [];
      grupos[chave].push(carga);
    });
    return grupos;
  }, [cargasFiltradas]);

  const styles = {
    container: { padding: '20px', backgroundColor: '#000', minHeight: '100vh', fontFamily: 'Inter, sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' as const, gap: '16px' },
    title: { fontSize: '24px', fontWeight: 900, color: '#FFF', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' },
    filterBar: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px', backgroundColor: '#0A0A0A', padding: '20px', borderRadius: '20px', border: '1px solid #1A1A1A' },
    filterGroup: { display: 'flex', flexDirection: 'column' as const, gap: '6px' },
    filterLabel: { fontSize: '12px', fontWeight: 700, color: '#666' },
    filterInput: { padding: '10px 14px', borderRadius: '10px', border: '1px solid #333', fontSize: '14px', outline: 'none', backgroundColor: '#111', color: '#FFF' },
    filterSelect: { padding: '10px 14px', borderRadius: '10px', border: '1px solid #333', fontSize: '14px', outline: 'none', backgroundColor: '#111', color: '#FFF' },
    clearBtn: { padding: '10px', borderRadius: '10px', border: 'none', backgroundColor: '#EF444420', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 },
    badge: { backgroundColor: '#1A1A1A', color: '#FFD700', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #333' },
    groupHeader: { backgroundColor: '#111', padding: '12px 20px', borderRadius: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #333' },
    groupTitle: { fontSize: '15px', fontWeight: 800, color: '#AAA', margin: 0, textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
    itemCard: (status: string) => ({ backgroundColor: '#0A0A0A', borderRadius: '20px', padding: '20px', marginBottom: '20px', border: '1px solid #1A1A1A', opacity: status === 'finalizada' ? 0.8 : 1 }),
    itemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap' as const, gap: '16px' },
    statusBadge: (status: string, color: string) => ({ padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, backgroundColor: `${color}20`, color: color, display: 'flex', alignItems: 'center', gap: '6px' }),
    logisticsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px' },
    locationBox: (color: string) => ({ padding: '16px', borderRadius: '16px', backgroundColor: `${color}10`, border: `1px solid ${color}30`, position: 'relative' as const }),
    dot: (color: string) => ({ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: color, position: 'absolute' as const, top: '20px', left: '10px' }),
    locationTitle: (color: string) => ({ fontSize: '10px', fontWeight: 800, color: color, margin: '0 0 10px 14px', letterSpacing: '1px' }),
    cityName: { fontSize: '16px', fontWeight: 800, color: '#FFF', margin: '0 0 4px 0' },
    localName: { fontSize: '13px', color: '#888', margin: 0, fontWeight: 500 },
    mapLink: (color: string) => ({ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: color, textDecoration: 'none', fontWeight: 700, marginTop: '10px', padding: '4px 10px', backgroundColor: '#1A1A1A', borderRadius: '8px' }),
    vehicleDetails: { padding: '16px', borderRadius: '16px', backgroundColor: '#111', border: '1px solid #333' },
    detailRow: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' },
    footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #1F1F1F', flexWrap: 'wrap' as const, gap: '12px' },
    actionBtn: (bg: string, color: string) => ({ padding: '6px 12px', borderRadius: '8px', border: 'none', backgroundColor: bg, color: color, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600 }),
    btnFinalizar: { backgroundColor: '#22C55E20', color: '#22C55E', padding: '6px 16px', borderRadius: '8px', border: '1px solid #22C55E', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 },
    btnFinalizarDisabled: { backgroundColor: '#333', color: '#666', padding: '6px 16px', borderRadius: '8px', border: '1px solid #444', cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 },
    motoristaInfoCard: { backgroundColor: '#1A1A1A', borderRadius: '14px', padding: '14px', marginBottom: '16px', border: '1px solid #333' },
    infoRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap' as const, gap: '8px' },
    infoLabel: { fontSize: '10px', fontWeight: 700, color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
    infoValue: { fontSize: '12px', fontWeight: 600, color: '#FFF' },
    photoBtn: { backgroundColor: '#3B82F620', color: '#3B82F6', padding: '6px 12px', borderRadius: '8px', border: '1px solid #3B82F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600 },
    canhotoBtn: { backgroundColor: '#FFD70020', color: '#FFD700', padding: '6px 12px', borderRadius: '8px', border: '1px solid #FFD700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600 },
    galeriaBtn: { backgroundColor: '#8B5CF620', color: '#8B5CF6', padding: '6px 12px', borderRadius: '8px', border: '1px solid #8B5CF6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600 },
    buttonGroup: { display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' as const },
    modalOverlay: { position: 'fixed' as const, top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0.95)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
    modalContent: { backgroundColor: '#0A0A0A', borderRadius: '24px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' as const, border: '1px solid #FFD700' },
    modalHeader: { padding: '20px 24px', borderBottom: '1px solid #1A1A1A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    modalBody: { padding: '24px' },
    formGroup: { display: 'flex', flexDirection: 'column' as const, gap: '8px', marginBottom: '20px' },
    formLabel: { fontSize: '13px', fontWeight: 700, color: '#AAA' },
    formInput: { padding: '12px 16px', borderRadius: '12px', border: '1px solid #333', fontSize: '14px', outline: 'none', backgroundColor: '#111', color: '#FFF' },
    btnPrimary: { backgroundColor: '#FFD700', color: '#000', padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' },
    btnSecondary: { backgroundColor: '#1A1A1A', color: '#AAA', padding: '12px 24px', borderRadius: '12px', border: '1px solid #333', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' },
    formSectionTitle: { fontSize: '14px', fontWeight: 800, color: '#FFF', margin: '20px 0 12px 0', paddingBottom: '6px', borderBottom: '2px solid #FFD700' },
    galeriaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', marginTop: '16px' },
    thumbnail: { width: '100%', height: '100px', objectFit: 'cover' as const, borderRadius: '8px', border: '2px solid #333', cursor: 'pointer' },
    thumbnailLabel: { display: 'block', textAlign: 'center' as const, color: '#999', fontSize: '11px', marginTop: '4px' },
    modalImagemContainer: { backgroundColor: '#111', borderRadius: '15px', width: '90vw', maxWidth: '900px', height: '80vh', display: 'flex', flexDirection: 'column' as const, border: '1px solid #333', overflow: 'hidden' },
    modalImagemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 25px', borderBottom: '1px solid #222', backgroundColor: '#0A0A0A' },
    modalImagemContent: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundColor: '#000', position: 'relative' as const },
    imagemCanhoto: { maxWidth: '100%', maxHeight: 'calc(100% - 80px)', objectFit: 'contain' as const, borderRadius: '8px' },
    navegacaoFotos: { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px', position: 'absolute' as const, top: '15px', left: 0, right: 0, justifyContent: 'center' },
    btnNavegacao: { backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid #333', width: '35px', height: '35px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    contadorFotos: { color: '#FFD700', fontSize: '13px', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.7)', padding: '4px 12px', borderRadius: '20px' },
    modalImagemFooter: { display: 'flex', justifyContent: 'space-between', padding: '15px 25px', borderTop: '1px solid #222', backgroundColor: '#0A0A0A' },
    btnDownload: { backgroundColor: 'rgba(52,152,219,0.1)', color: '#3498db', border: '1px solid rgba(52,152,219,0.3)', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' },
    btnFecharImagem: { backgroundColor: '#222', color: '#fff', border: '1px solid #333', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' },
    btnClose: { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', border: 'none', borderRadius: '50%', width: '35px', height: '35px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  };

  return (
    <div style={styles.container}>
      <style>{`
        * { box-sizing: border-box; }
        input:focus, select:focus, textarea:focus { border-color: #FFD700!important; outline: none; }
        button:hover { transform: translateY(-1px); filter: brightness(0.98); }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .thumbnail-hover:hover { transform: scale(1.05); border-color: #FFD700; }
      `}</style>

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <div style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', padding: '8px', borderRadius: '14px' }}>
              <Eye size={24} color="#000" />
            </div>
            Visualizar Programações
          </h1>
          <p style={{ margin: '6px 0 0', color: '#666', fontSize: '13px' }}>Acompanhe e gerencie todas as cargas do sistema</p>
        </div>
        <div style={styles.badge}>
          <ClipboardList size={14} /> {listaCargas.filter(c => c.status !== 'finalizada' && c.status !== 'cancelada').length} Ativas
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{...styles.actionBtn(showFilters ? '#FFD700' : '#1A1A1A', showFilters ? '#000' : '#AAA'), border: '1px solid #333' }}
          >
            <Filter size={14} /> {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setMostrarFinalizadas(!mostrarFinalizadas)}
            style={styles.actionBtn(mostrarFinalizadas ? '#22C55E' : '#1A1A1A', mostrarFinalizadas ? '#000' : '#AAA')}
          >
            {mostrarFinalizadas ? 'Ocultar Finalizadas' : 'Mostrar Finalizadas'}
          </button>
        </div>
      </div>

      {showFilters && (
        <div style={styles.filterBar}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Data Coleta</label>
            <input type="date" style={styles.filterInput} value={filtroDataColeta} onChange={e => setFiltroDataColeta(e.target.value)} />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Data Entrega</label>
            <input type="date" style={styles.filterInput} value={filtroDataEntrega} onChange={e => setFiltroDataEntrega(e.target.value)} />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Motorista</label>
            <input style={styles.filterInput} placeholder="Filtrar motorista..." value={filtroMotorista} onChange={e => setFiltroMotorista(e.target.value)} />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Cliente / Local</label>
            <input style={styles.filterInput} placeholder="Filtrar cliente..." value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Cidade Coleta</label>
            <select style={styles.filterSelect} value={filtroCidadeColeta} onChange={e => setFiltroCidadeColeta(e.target.value)}>
              <option value="">Todas</option>
              {cidadesColeta.map(([c]) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Cidade Entrega</label>
            <select style={styles.filterSelect} value={filtroCidadeEntrega} onChange={e => setFiltroCidadeEntrega(e.target.value)}>
              <option value="">Todas</option>
              {cidadesEntrega.map(([c]) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{...styles.filterGroup, justifyContent: 'flex-end' }}>
            <button style={styles.clearBtn} onClick={() => {
              setFiltroDataColeta(''); setFiltroDataEntrega(''); setFiltroCidadeColeta('');
              setFiltroCidadeEntrega(''); setFiltroCliente(''); setFiltroMotorista('');
            }}>
              <RefreshCw size={12} /> Limpar
            </button>
          </div>
        </div>
      )}

      {Object.entries(cargasAgrupadas).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
          <Info size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <p>Nenhuma carga encontrada.</p>
        </div>
      ) : (
        Object.entries(cargasAgrupadas).map(([grupo, cargas]) => (
          <div key={grupo} style={{ marginBottom: '32px' }}>
            <div style={styles.groupHeader}>
              <MapPin size={16} color="#AAA" />
              <h3 style={styles.groupTitle}>{grupo}</h3>
              <span style={{...styles.badge, marginLeft: 'auto', backgroundColor: '#1A1A1A' }}>{cargas.length} veículos</span>
            </div>

            {cargas.map((carga) => {
              const podeFinalizar = podeFinalizarViagem(carga);
              const statusAtual = getStatusFormatado(carga);
              const viagemEmAndamento = !podeFinalizar && carga.status !== 'finalizada' && carga.status !== 'cancelada';
              const localizacao = localizacoesMotoristas.get(carga.motoristaId || '');
              const checkin = checkinsMotoristas.get(carga.motoristaId || '');
              const fotoCheckin = fotosCheckinMotoristas.get(carga.motoristaId || '');
              const canhotos = canhotosMotoristas.get(carga.id || '') || [];
              const isLoadingCanhotos = loadingCanhotos.get(carga.id || '');
              
              return (
                <div key={carga.id} style={styles.itemCard(carga.status)}>
                  <div style={styles.itemHeader}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', padding: '10px', borderRadius: '14px' }}>
                        <Truck size={20} color="#000" />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#FFF' }}>{carga.motorista}</h3>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11px', color: '#888', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CreditCard size={12} /> {carga.cpf}
                          </span>
                          <span style={{ fontSize: '11px', color: '#888', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={12} /> DT: {carga.dt}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={styles.statusBadge(statusAtual.label, statusAtual.color)}>
                      <span>{statusAtual.icon}</span>
                      {statusAtual.label}
                    </div>
                  </div>

                  {carga.motoristaId && carga.status !== 'finalizada' && carga.status !== 'cancelada' && (
                    <div style={styles.motoristaInfoCard}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <Activity size={14} color="#FFD700" />
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFD700', letterSpacing: '0.5px' }}>MONITORAMENTO</span>
                      </div>
                      
                      <div style={styles.infoRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Navigation size={12} color="#3B82F6" />
                          <span style={styles.infoLabel}>📍 LOCALIZAÇÃO:</span>
                        </div>
                        <span style={styles.infoValue}>{localizacao?.cidadeNome || "Carregando..."}</span>
                      </div>

                      <div style={styles.infoRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Camera size={12} color="#10B981" />
                          <span style={styles.infoLabel}>📋 CHECK-IN:</span>
                        </div>
                        <span style={{...styles.infoValue, color: checkin?.tipo === 'Nenhum check-in' ? '#EF4444' : '#10B981'}}>
                          {checkin?.tipo === 'chegada_coleta' ? '✅ Chegada na Coleta' : 
                           checkin?.tipo === 'saida_coleta' ? '🚚 Saída da Coleta' :
                           checkin?.tipo === 'chegada_entrega' ? '🏭 Chegada na Entrega' :
                           checkin?.tipo === 'saida_entrega' ? '✅ Saída da Entrega' :
                           checkin?.tipo === 'inicio_viagem' ? '🚛 Início da Viagem' :
                           checkin?.tipo || 'Aguardando'}
                        </span>
                      </div>

                      <div style={styles.buttonGroup}>
                        {fotoCheckin && (
                          <button style={styles.photoBtn} onClick={() => { setSelectedPhoto(fotoCheckin); setSelectedCheckinData(checkin || null); setShowPhotoModal(true); }}>
                            <Camera size={12} /> Ver Foto
                          </button>
                        )}
                        {canhotos.length === 1 && (
                          <button style={styles.canhotoBtn} onClick={() => abrirModalImagem([canhotos[0].url], 0, carga.motorista, carga.id || '')}>
                            <Camera size={12} /> Ver Canhoto
                          </button>
                        )}
                        {canhotos.length > 1 && (
                          <button style={styles.galeriaBtn} onClick={() => abrirModalGaleria(carga, canhotos)}>
                            <Images size={12} /> Ver {canhotos.length} Canhotos
                          </button>
                        )}
                        {isLoadingCanhotos && <span style={{ fontSize: '11px', color: '#AAA' }}><RefreshCw size={12} className="spin" /></span>}
                      </div>
                    </div>
                  )}

                  <div style={styles.logisticsGrid}>
                    <div style={styles.locationBox('#22C55E')}>
                      <div style={styles.dot('#22C55E')} />
                      <p style={styles.locationTitle('#22C55E')}>COLETA</p>
                      <h4 style={styles.cityName}>{carga.coletaCidade}</h4>
                      <p style={styles.localName}>{carga.coletaLocal}</p>
                      <p style={{ fontSize: '11px', color: '#666', marginTop: '6px', fontWeight: 600 }}>{carga.coletaData}</p>
                      {carga.coletaLink && <a href={carga.coletaLink} target="_blank" rel="noreferrer" style={styles.mapLink('#22C55E')}><MapPin size={12} /> Mapa</a>}
                    </div>

                    <div style={styles.locationBox('#FFD700')}>
                      <div style={styles.dot('#FFD700')} />
                      <p style={styles.locationTitle('#FFD700')}>ENTREGA</p>
                      <h4 style={styles.cityName}>{carga.entregaCidade}</h4>
                      <p style={styles.localName}>{carga.entregaLocal}</p>
                      <p style={{ fontSize: '11px', color: '#666', marginTop: '6px', fontWeight: 600 }}>{carga.entregaData}</p>
                      {carga.entregaLink && <a href={carga.entregaLink} target="_blank" rel="noreferrer" style={styles.mapLink('#FFD700')}><MapPin size={12} /> Mapa</a>}
                    </div>

                    <div style={styles.vehicleDetails}>
                      <div style={styles.detailRow}><span style={{ color: '#888' }}>Placa/Carreta:</span><span style={{ color: '#FFF', fontWeight: 700 }}>{carga.placa} / {carga.carreta}</span></div>
                      <div style={styles.detailRow}><span style={{ color: '#888' }}>Peso:</span><span style={{ color: '#FFD700', fontWeight: 700 }}>{carga.peso}</span></div>
                      {carga.pvs && carga.pvs.length > 0 && (
                        <div style={{...styles.detailRow, flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                          <span style={{ color: '#888' }}>PVs:</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {carga.pvs.map((pv, idx) => <span key={idx} style={{ backgroundColor: '#1A1A1A', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', border: '1px solid #333', color: '#AAA' }}>{pv}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {carga.obs && (
                    <div style={{ backgroundColor: '#FFD70020', padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', borderLeft: '3px solid #FFD700' }}>
                      <p style={{ margin: 0, fontSize: '11px', color: '#FFD700', fontWeight: 500 }}><strong>OBS:</strong> {carga.obs}</p>
                    </div>
                  )}

                  <div style={styles.footer}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button style={styles.actionBtn('#1A1A1A', '#AAA')} onClick={() => { setEditandoCarga(carga); setShowEditModal(true); }}>
                        <Edit3 size={12} /> Editar
                      </button>
                      <button style={styles.actionBtn('#EF444420', '#EF4444')} onClick={async () => {
                        if (window.confirm('Excluir esta carga?')) {
                          try { await deleteDoc(doc(db, "motoristas", carga.motoristaId!, "cargas", carga.id!)); } 
                          catch (err) { alert("Erro ao excluir."); }
                        }
                      }}>
                        <Trash2 size={12} /> Excluir
                      </button>
                      {carga.status !== 'finalizada' && carga.status !== 'cancelada' && (
                        <button style={styles.actionBtn('#8B5CF620', '#8B5CF6')} onClick={() => { setSelectedCargaForStatus(carga); setNewStatus(carga.ultimoStatus || 'programada'); setShowStatusModal(true); }}>
                          <RotateCcw size={12} /> Alterar Status
                        </button>
                      )}
                    </div>
                    
                    {carga.status !== 'finalizada' && carga.status !== 'cancelada' && (
                      viagemEmAndamento ? (
                        <div style={styles.btnFinalizarDisabled}><Flag size={12} /> Em Andamento</div>
                      ) : (
                        <button style={styles.btnFinalizar} onClick={() => finalizarViagem(carga)} disabled={loading}><Flag size={12} /> Finalizar</button>
                      )
                    )}
                    
                    {carga.status === 'finalizada' && <div style={styles.statusBadge('FINALIZADA', '#22C55E')}><CheckCircle2 size={12} /> FINALIZADA</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}

      {/* MODAL DE STATUS */}
      {showStatusModal && selectedCargaForStatus && (
        <div style={styles.modalOverlay} onClick={() => setShowStatusModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#FFF' }}>Alterar Status</h2>
              <button style={styles.btnClose} onClick={() => setShowStatusModal(false)}><X size={18} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Motorista: {selectedCargaForStatus.motorista}</label>
                <label style={styles.formLabel}>Novo Status</label>
                <select style={styles.formInput} value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  <option value="programada">📋 Programada</option>
                  <option value="inicio_viagem">🚛 Início da Viagem</option>
                  <option value="chegada_coleta">📍 Chegada na Coleta</option>
                  <option value="saida_coleta">🚚 Saída da Coleta</option>
                  <option value="chegada_entrega">🏭 Chegada na Entrega</option>
                  <option value="saida_entrega">✅ Saída da Entrega</option>
                  <option value="em_andamento">⚡ Em Andamento</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button style={styles.btnSecondary} onClick={() => setShowStatusModal(false)}>Cancelar</button>
                <button style={styles.btnPrimary} onClick={editarStatusMotorista} disabled={loading}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO */}
      {showEditModal && editandoCarga && (
        <div style={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div style={{...styles.modalContent, maxWidth: '700px'}} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#FFF' }}>Editar Carga</h2>
              <button style={styles.btnClose} onClick={() => setShowEditModal(false)}><X size={18} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formSectionTitle}>Informações Básicas</div>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}><label style={styles.formLabel}>Motorista</label><input style={styles.formInput} value={editandoCarga.motorista} onChange={e => setEditandoCarga({...editandoCarga, motorista: e.target.value})} /></div>
                <div style={styles.formGroup}><label style={styles.formLabel}>CPF</label><input style={styles.formInput} value={editandoCarga.cpf} onChange={e => setEditandoCarga({...editandoCarga, cpf: e.target.value})} /></div>
                <div style={styles.formGroup}><label style={styles.formLabel}>Placa</label><input style={styles.formInput} value={editandoCarga.placa} onChange={e => setEditandoCarga({...editandoCarga, placa: e.target.value})} /></div>
                <div style={styles.formGroup}><label style={styles.formLabel}>Carreta</label><input style={styles.formInput} value={editandoCarga.carreta} onChange={e => setEditandoCarga({...editandoCarga, carreta: e.target.value})} /></div>
              </div>
              <div style={styles.formSectionTitle}>Coleta</div>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}><label style={styles.formLabel}>Data</label><input style={styles.formInput} value={editandoCarga.coletaData} onChange={e => setEditandoCarga({...editandoCarga, coletaData: e.target.value})} /></div>
                <div style={styles.formGroup}><label style={styles.formLabel}>Cidade</label><input style={styles.formInput} value={editandoCarga.coletaCidade} onChange={e => setEditandoCarga({...editandoCarga, coletaCidade: e.target.value})} /></div>
                <div style={styles.formGroup}><label style={styles.formLabel}>Local</label><input style={styles.formInput} value={editandoCarga.coletaLocal} onChange={e => setEditandoCarga({...editandoCarga, coletaLocal: e.target.value})} /></div>
              </div>
              <div style={styles.formSectionTitle}>Entrega</div>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}><label style={styles.formLabel}>Data</label><input style={styles.formInput} value={editandoCarga.entregaData} onChange={e => setEditandoCarga({...editandoCarga, entregaData: e.target.value})} /></div>
                <div style={styles.formGroup}><label style={styles.formLabel}>Cidade</label><input style={styles.formInput} value={editandoCarga.entregaCidade} onChange={e => setEditandoCarga({...editandoCarga, entregaCidade: e.target.value})} /></div>
                <div style={styles.formGroup}><label style={styles.formLabel}>Local</label><input style={styles.formInput} value={editandoCarga.entregaLocal} onChange={e => setEditandoCarga({...editandoCarga, entregaLocal: e.target.value})} /></div>
              </div>
              <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button style={styles.btnSecondary} onClick={() => setShowEditModal(false)}>Cancelar</button>
                <button style={styles.btnPrimary} onClick={handleSalvarEdicao} disabled={loading}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE FOTO */}
      {showPhotoModal && selectedPhoto && (
        <div style={styles.modalOverlay} onClick={() => setShowPhotoModal(false)}>
          <div style={{...styles.modalContent, maxWidth: '500px'}} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#FFF' }}>Foto do Check-in</h2>
              <button style={styles.btnClose} onClick={() => setShowPhotoModal(false)}><X size={18} /></button>
            </div>
            <div style={{...styles.modalBody, textAlign: 'center'}}>
              <img src={selectedPhoto} alt="Check-in" style={{ maxWidth: '100%', maxHeight: '50vh', borderRadius: '12px' }} />
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GALERIA */}
      {showGaleriaModal && galeriaData && (
        <div style={styles.modalOverlay} onClick={() => setShowGaleriaModal(false)}>
          <div style={{...styles.modalContent, maxWidth: '700px'}} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#FFF' }}>Canhotos - {galeriaData.cargaNome}</h2>
              <button style={styles.btnClose} onClick={() => setShowGaleriaModal(false)}><X size={18} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.galeriaGrid}>
                {galeriaData.canhotos.map((canhoto, idx) => (
                  <div key={idx}>
                    <img src={canhoto.url} alt={`Canhoto ${idx + 1}`} style={styles.thumbnail} className="thumbnail-hover" onClick={() => { setShowGaleriaModal(false); abrirModalImagem(galeriaData.urlsCanhotos, idx, galeriaData.cargaNome, galeriaData.cargaId); }} />
                    <span style={styles.thumbnailLabel}>Canhoto {idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE IMAGEM AMPLIADA */}
      {showImagemModal && imagemModalData && (
        <div style={styles.modalOverlay} onClick={() => setShowImagemModal(false)}>
          <div style={styles.modalImagemContainer} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalImagemHeader}>
              <h3 style={{ margin: 0, color: '#FFD700', fontSize: '14px' }}>Canhoto - {imagemModalData.cargaNome}</h3>
              <button onClick={() => setShowImagemModal(false)} style={styles.btnClose}><X size={18} /></button>
            </div>
            <div style={styles.modalImagemContent}>
              {imagemModalData.urls.length > 1 && (
                <div style={styles.navegacaoFotos}>
                  <button onClick={imagemAnterior} style={styles.btnNavegacao}><ChevronLeft size={18} /></button>
                  <span style={styles.contadorFotos}>{imagemModalData.currentIndex + 1} / {imagemModalData.urls.length}</span>
                  <button onClick={proximaImagem} style={styles.btnNavegacao}><ChevronRight size={18} /></button>
                </div>
              )}
              <img src={imagemModalData.urls[imagemModalData.currentIndex]} alt="Canhoto" style={styles.imagemCanhoto} />
            </div>
            <div style={styles.modalImagemFooter}>
              <a href={imagemModalData.urls[imagemModalData.currentIndex]} target="_blank" rel="noopener noreferrer" style={styles.btnDownload}><Download size={14} /> BAIXAR</a>
              <button onClick={() => setShowImagemModal(false)} style={styles.btnFecharImagem}>FECHAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualizarProgramacoes;