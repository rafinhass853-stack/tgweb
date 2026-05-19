// ListaVeiculos.tsx (CÓDIGO CORRIGIDO - COM CSS DO LEAFLET)
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, where, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import MapaModal from './ListaVeiculosMapaModal';
import VisaoMapaLV from './VisaoMapaLV';
import { BarChart3, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css'; // ← LINHA CRÍTICA ADICIONADA!

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

interface Veiculo {
  id: string;
  placa: string;
  tipo: string;
  capacidade?: number;
  createdAt?: any;
  ultimaLocalizacao?: string;
  ultimoEndereco?: string;
  velocidade?: number;
  ultimaAtualizacaoRastreador?: Timestamp;
  statusRastreador?: 'online' | 'offline' | 'parado';
  ultimaMacro?: string;
  coordenadas?: {
    lat: number;
    lng: number;
  };
}

interface MotivoIndisponibilidade {
  id?: string;
  veiculoId: string;
  motivo: 'manutencao' | 'folga_motorista' | 'aguardando_programacao';
  descricao?: string;
  dataInicio: string;
  dataFim?: string | null;
  atualizadoEm: any;
}

const ListaVeiculos = () => {
  const navigate = useNavigate();
  
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [cargasPorVeiculo, setCargasPorVeiculo] = useState<Record<string, CargaProgramada | null>>({});
  const [motivosPorVeiculo, setMotivosPorVeiculo] = useState<Record<string, MotivoIndisponibilidade | null>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'comProgramacao' | 'semProgramacao'>('todos');
  const [editando, setEditando] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingCargas, setLoadingCargas] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showMotivoModal, setShowMotivoModal] = useState<Veiculo | null>(null);
  const [mapaModalVeiculo, setMapaModalVeiculo] = useState<Veiculo | null>(null);
  const [motivoSelecionado, setMotivoSelecionado] = useState<'manutencao' | 'folga_motorista' | 'aguardando_programacao'>('manutencao');
  const [descricaoMotivo, setDescricaoMotivo] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showMapView, setShowMapView] = useState(false);

  // Função para normalizar placas (remover espaços, hífens, converter para maiúsculo)
  const normalizarPlaca = (placa: string): string => {
    if (!placa) return '';
    return placa.toUpperCase().replace(/[-\s]/g, '');
  };

  // Buscar veículos
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'veiculos'), (snap) => {
      const veiculosList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Veiculo));
      setVeiculos(veiculosList);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Buscar motivos de indisponibilidade
  useEffect(() => {
    if (veiculos.length === 0) return;

    const unsubscribers: (() => void)[] = [];

    veiculos.forEach((veiculo) => {
      const motivoRef = collection(db, 'veiculos', veiculo.id, 'indisponibilidade');
      const q = query(motivoRef, where('dataFim', '==', null));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
          setMotivosPorVeiculo(prev => ({ ...prev, [veiculo.id]: null }));
        } else {
          const docSnap = snapshot.docs[0];
          const motivoData = docSnap.data();
          const motivo: MotivoIndisponibilidade = {
            id: docSnap.id,
            veiculoId: motivoData.veiculoId,
            motivo: motivoData.motivo,
            descricao: motivoData.descricao,
            dataInicio: motivoData.dataInicio,
            dataFim: motivoData.dataFim,
            atualizadoEm: motivoData.atualizadoEm
          };
          setMotivosPorVeiculo(prev => ({ ...prev, [veiculo.id]: motivo }));
        }
      });

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [veiculos]);

  // Buscar todas as cargas ativas
  const buscarTodasCargasAtivas = useCallback(async () => {
    try {
      const todasCargas: CargaProgramada[] = [];
      
      const motoristasSnapshot = await getDocs(collection(db, 'motoristas'));
      
      for (const motoristaDoc of motoristasSnapshot.docs) {
        const cargasQuery = query(
          collection(db, 'motoristas', motoristaDoc.id, 'cargas'),
          where('status', 'in', ['programada', 'aguardando_carregamento', 'seguindo_para_entrega', 'chegou_entrega'])
        );
        
        const cargasSnapshot = await getDocs(cargasQuery);
        
        cargasSnapshot.forEach(cargaDoc => {
          const cargaData = cargaDoc.data() as CargaProgramada;
          todasCargas.push({ 
            ...cargaData, 
            id: cargaDoc.id 
          });
        });
      }
      
      return todasCargas;
    } catch (error) {
      console.error('Erro ao buscar cargas:', error);
      return [];
    }
  }, []);

  // Buscar cargas ativas e correlacionar com veículos
  useEffect(() => {
    if (veiculos.length === 0) {
      setCargasPorVeiculo({});
      setLoadingCargas(false);
      return;
    }

    let isMounted = true;

    const carregarCargas = async () => {
      if (!isMounted) return;
      
      try {
        setLoadingCargas(true);
        const todasCargas = await buscarTodasCargasAtivas();
        if (!isMounted) return;
        
        const cargasMap: Record<string, CargaProgramada | null> = {};
        
        veiculos.forEach(veiculo => {
          const placaVeiculoNorm = normalizarPlaca(veiculo.placa);
          
          const cargaEncontrada = todasCargas.find(carga => {
            const placaCargaNorm = normalizarPlaca(carga.placa);
            return placaCargaNorm === placaVeiculoNorm;
          });
          
          cargasMap[veiculo.id] = cargaEncontrada || null;
        });
        
        setCargasPorVeiculo(cargasMap);
      } catch (error) {
        console.error('Erro ao processar cargas:', error);
      } finally {
        if (isMounted) setLoadingCargas(false);
      }
    };
    
    carregarCargas();
    
    const interval = setInterval(carregarCargas, 360000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [veiculos, buscarTodasCargasAtivas]);

  const salvarMotivoIndisponibilidade = async () => {
    if (!showMotivoModal) return;

    try {
      const motivoRef = collection(db, 'veiculos', showMotivoModal.id, 'indisponibilidade');
      const novoDocRef = doc(motivoRef);
      await setDoc(novoDocRef, {
        veiculoId: showMotivoModal.id,
        motivo: motivoSelecionado,
        descricao: descricaoMotivo || null,
        dataInicio: new Date().toISOString().split('T')[0],
        dataFim: null,
        atualizadoEm: new Date()
      });

      let mensagem = '';
      switch(motivoSelecionado) {
        case 'manutencao':
          mensagem = '✅ Motivo registrado: Em Manutenção';
          break;
        case 'folga_motorista':
          mensagem = '✅ Motivo registrado: Aguardando Motorista';
          break;
        case 'aguardando_programacao':
          mensagem = '✅ Motivo registrado: Aguardando Programação';
          break;
      }
      showNotification(mensagem, 'success');
      setShowMotivoModal(null);
      setDescricaoMotivo('');
    } catch (error) {
      console.error(error);
      showNotification('❌ Erro ao registrar motivo', 'error');
    }
  };

  const finalizarIndisponibilidade = async (veiculoId: string) => {
    const motivo = motivosPorVeiculo[veiculoId];
    if (!motivo || !motivo.id) return;

    try {
      const motivoDocRef = doc(db, 'veiculos', veiculoId, 'indisponibilidade', motivo.id);
      await updateDoc(motivoDocRef, {
        dataFim: new Date().toISOString().split('T')[0],
        atualizadoEm: new Date()
      });
      showNotification('✅ Veículo marcado como disponível novamente!', 'success');
    } catch (error) {
      console.error(error);
      showNotification('❌ Erro ao finalizar indisponibilidade', 'error');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const veiculoRef = doc(db, 'veiculos', editando.id);
      const updateData: any = {
        placa: editando.placa.toUpperCase(),
        tipo: editando.tipo
      };
      if (editando.tipo === 'truck') {
        updateData.capacidade = parseInt(editando.capacidade);
      } else {
        updateData.capacidade = null;
      }

      await updateDoc(veiculoRef, updateData);
      showNotification('✅ Veículo atualizado com sucesso!', 'success');
      setEditando(null);
    } catch (error) {
      console.error(error);
      showNotification('❌ Erro ao atualizar veículo', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'veiculos', id));
      setShowDeleteConfirm(null);
      showNotification('✅ Veículo excluído com sucesso!', 'success');
    } catch (error) {
      console.error(error);
      showNotification('❌ Erro ao excluir veículo', 'error');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 36000);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'programada':
        return { label: 'PROGRAMADA', color: '#FFD700', bg: '#FFD70020', icon: '⏳' };
      case 'aguardando_carregamento':
        return { label: 'AGUARDANDO CARREGAMENTO', color: '#FF9500', bg: '#FF950020', icon: '📦' };
      case 'seguindo_para_entrega':
        return { label: 'EM ROTA', color: '#22C55E', bg: '#22C55E20', icon: '🚛' };
      case 'chegou_entrega':
        return { label: 'CHEGOU NA ENTREGA', color: '#3B82F6', bg: '#3B82F620', icon: '📍' };
      default:
        return { label: status?.toUpperCase() || 'DESCONHECIDO', color: '#666', bg: '#666620', icon: '❓' };
    }
  };

  const getTipoNome = (tipo: string) => {
    switch(tipo) {
      case 'toco': return 'Toco (2 eixos)';
      case 'trucado': return 'Trucado (3 eixos)';
      case 'truck': return 'Truck (Cavalo)';
      default: return tipo;
    }
  };

  const getMotivoLabel = (motivo: string) => {
    switch(motivo) {
      case 'manutencao': return { label: 'Em Manutenção', icon: '🔧', color: '#FF9500' };
      case 'folga_motorista': return { label: 'Aguardando Motorista', icon: '😴', color: '#8B5CF6' };
      case 'aguardando_programacao': return { label: 'Aguardando Programação', icon: '⏳', color: '#3B82F6' };
      default: return { label: 'Indisponível', icon: '⚠️', color: '#EF4444' };
    }
  };

  const filteredVeiculos = useMemo(() => {
    return veiculos.filter(v => {
      const cargaAtiva = cargasPorVeiculo[v.id];
      const temProgramacao = cargaAtiva !== null && cargaAtiva !== undefined;

      const matchPlaca = v.placa?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTipo = filterTipo === 'todos' || v.tipo === filterTipo;
      
      let matchProgramacao = true;
      if (filterStatus === 'comProgramacao') matchProgramacao = temProgramacao;
      if (filterStatus === 'semProgramacao') matchProgramacao = !temProgramacao;

      return matchPlaca && matchTipo && matchProgramacao;
    });
  }, [veiculos, cargasPorVeiculo, searchTerm, filterTipo, filterStatus]);

  const stats = useMemo(() => {
    const total = veiculos.length;
    const comProgramacao = veiculos.filter(v => cargasPorVeiculo[v.id] !== null && cargasPorVeiculo[v.id] !== undefined).length;
    const semProgramacao = total - comProgramacao;
    const toco = veiculos.filter(v => v.tipo === 'toco').length;
    const trucado = veiculos.filter(v => v.tipo === 'trucado').length;
    const truck = veiculos.filter(v => v.tipo === 'truck').length;
    
    const veiculosSemProgramacao = veiculos.filter(v => !cargasPorVeiculo[v.id]);
    const emManutencao = veiculosSemProgramacao.filter(v => motivosPorVeiculo[v.id]?.motivo === 'manutencao').length;
    const aguardandoMotorista = veiculosSemProgramacao.filter(v => motivosPorVeiculo[v.id]?.motivo === 'folga_motorista').length;
    const aguardandoProgramacao = veiculosSemProgramacao.filter(v => motivosPorVeiculo[v.id]?.motivo === 'aguardando_programacao').length;
    const realmenteDisponiveis = veiculosSemProgramacao.filter(v => !motivosPorVeiculo[v.id]).length;

    return { total, comProgramacao, semProgramacao, toco, trucado, truck, emManutencao, aguardandoMotorista, aguardandoProgramacao, realmenteDisponiveis };
  }, [veiculos, cargasPorVeiculo, motivosPorVeiculo]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#000', color: '#FFF' }}>
        <div>Carregando veículos...</div>
      </div>
    );
  }

  return (
    <>
      {showMapView ? (
        <VisaoMapaLV
          veiculos={veiculos}
          cargasPorVeiculo={cargasPorVeiculo}
          onRefresh={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 500);
          }}
          onBack={() => setShowMapView(false)}
          loading={loadingCargas}
        />
      ) : (
        <div style={{ padding: '40px 20px', backgroundColor: '#000', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
          {/* Header com botões */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#FFF', marginBottom: '10px' }}>🚛 Veículos Cadastrados</h1>
              <p style={{ color: '#666' }}>Gerencie todos os veículos da sua frota</p>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowMapView(true)}
                style={{
                  background: '#1A1A1A',
                  border: '1px solid #3B82F6',
                  borderRadius: '12px',
                  padding: '12px 20px',
                  color: '#3B82F6',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#3B82F620';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1A1A1A';
                }}
              >
                <MapPin size={18} />
                Visão Mapa
              </button>

              <button
                onClick={() => navigate('/relatorio-veiculos')}
                style={{
                  background: '#1A1A1A',
                  border: '1px solid #FFD700',
                  borderRadius: '12px',
                  padding: '12px 20px',
                  color: '#FFD700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#FFD70020';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1A1A1A';
                }}
              >
                <BarChart3 size={18} />
                Relatório da Frota
              </button>
            </div>
          </div>

          {/* Dashboard de Estatísticas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '30px' }}>
            <div style={{ background: '#0A0A0A', padding: '20px', borderRadius: '16px', border: '1px solid #1A1A1A', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#FFD700' }}>{stats.total}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Total de Veículos</div>
            </div>
            
            <div style={{ background: '#0A0A0A', padding: '20px', borderRadius: '16px', border: '1px solid #1A1A1A', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#22C55E' }}>{stats.comProgramacao}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Com Programação</div>
            </div>
            
            <div style={{ background: '#0A0A0A', padding: '20px', borderRadius: '16px', border: '1px solid #1A1A1A', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#EF4444' }}>{stats.semProgramacao}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Sem Programação</div>
            </div>

            <div style={{ background: '#0A0A0A', padding: '20px', borderRadius: '16px', border: '1px solid #1A1A1A', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3B82F6' }}>{stats.truck}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Trucks (Cavalo)</div>
            </div>

            <div style={{ background: '#0A0A0A', padding: '20px', borderRadius: '16px', border: '1px solid #1A1A1A', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10B981' }}>{stats.trucado}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Trucados</div>
            </div>

            <div style={{ background: '#0A0A0A', padding: '20px', borderRadius: '16px', border: '1px solid #1A1A1A', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F59E0B' }}>{stats.toco}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Tocos</div>
            </div>
          </div>

          {/* Dashboard de Indisponibilidade */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '30px' }}>
            <div style={{ background: '#1A1A1A', padding: '16px', borderRadius: '12px', borderLeft: '4px solid #FF9500' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>🔧</span>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF9500' }}>{stats.emManutencao}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>Em Manutenção</div>
                </div>
              </div>
            </div>

            <div style={{ background: '#1A1A1A', padding: '16px', borderRadius: '12px', borderLeft: '4px solid #8B5CF6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>😴</span>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8B5CF6' }}>{stats.aguardandoMotorista}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>Aguardando Motorista</div>
                </div>
              </div>
            </div>

            <div style={{ background: '#1A1A1A', padding: '16px', borderRadius: '12px', borderLeft: '4px solid #3B82F6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>⏳</span>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3B82F6' }}>{stats.aguardandoProgramacao}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>Aguardando Programação</div>
                </div>
              </div>
            </div>

            <div style={{ background: '#1A1A1A', padding: '16px', borderRadius: '12px', borderLeft: '4px solid #22C55E' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>✅</span>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22C55E' }}>{stats.realmenteDisponiveis}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>Realmente Disponíveis</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '30px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Buscar por placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: 1, padding: '12px', backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '10px', color: '#FFF' }}
            />
            <select 
              value={filterTipo} 
              onChange={(e) => setFilterTipo(e.target.value)}
              style={{ padding: '12px', backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '10px', color: '#FFF' }}
            >
              <option value="todos">Todos os tipos</option>
              <option value="toco">Toco</option>
              <option value="trucado">Trucado</option>
              <option value="truck">Truck</option>
            </select>
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value as any)}
              style={{ padding: '12px', backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '10px', color: '#FFF' }}
            >
              <option value="todos">Todos os status</option>
              <option value="comProgramacao">✅ Com Programação</option>
              <option value="semProgramacao">⭕ Sem Programação</option>
            </select>
          </div>

          {/* Notificação */}
          {successMessage && (
            <div style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              background: '#10b981',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '12px',
              zIndex: 1000,
              fontWeight: 'bold'
            }}>
              {successMessage}
            </div>
          )}

          {/* Loading de Cargas */}
          {loadingCargas && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <div>Carregando programações...</div>
            </div>
          )}

          {/* Grid de Veículos */}
          {!loadingCargas && filteredVeiculos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666', backgroundColor: '#0A0A0A', borderRadius: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚛</div>
              <h3 style={{ color: '#FFF' }}>Nenhum veículo encontrado</h3>
              <p>
                {searchTerm || filterTipo !== 'todos' || filterStatus !== 'todos'
                  ? 'Tente usar outros filtros de busca'
                  : 'Comece cadastrando seu primeiro veículo'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '24px' }}>
              {filteredVeiculos.map(v => {
                const carga = cargasPorVeiculo[v.id];
                const temProgramacao = carga !== null && carga !== undefined;
                const motivo = motivosPorVeiculo[v.id];
                const motivoInfo = motivo ? getMotivoLabel(motivo.motivo) : null;
                const statusInfo = carga ? getStatusInfo(carga.status) : null;

                return (
                  <div key={v.id} style={{
                    background: '#0A0A0A',
                    borderRadius: '16px',
                    border: temProgramacao ? '2px solid #22C55E' : (motivo ? `2px solid ${motivoInfo?.color}` : '1px solid #1A1A1A'),
                    overflow: 'hidden'
                  }}>
                    {/* Header do Card */}
                    <div style={{
                      background: temProgramacao ? '#22C55E' : (motivo ? motivoInfo?.color : '#4facfe'),
                      padding: '20px',
                      color: 'white',
                      position: 'relative'
                    }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{v.placa}</div>
                      <div style={{ fontSize: '14px', marginTop: '5px' }}>{getTipoNome(v.tipo)}</div>
                      {temProgramacao && statusInfo && (
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          background: statusInfo.bg,
                          padding: '4px 8px',
                          borderRadius: '5px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          color: statusInfo.color
                        }}>
                          {statusInfo.icon} {statusInfo.label}
                        </div>
                      )}
                      {!temProgramacao && motivo && (
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          background: '#00000060',
                          padding: '4px 8px',
                          borderRadius: '5px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          color: 'white'
                        }}>
                          {motivoInfo?.icon} {motivoInfo?.label}
                        </div>
                      )}
                      {!temProgramacao && !motivo && (
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          background: '#EF444420',
                          padding: '4px 8px',
                          borderRadius: '5px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          color: '#EF4444'
                        }}>
                          ⭕ DISPONÍVEL
                        </div>
                      )}
                    </div>

                    {/* Conteúdo do Card */}
                    <div style={{ padding: '20px' }}>
                      {v.tipo === 'truck' && v.capacidade && (
                        <div style={{ marginBottom: '16px', padding: '10px', background: '#1A1A1A', borderRadius: '10px' }}>
                          <strong style={{ color: '#FFD700' }}>📦 Capacidade:</strong> <span style={{ color: '#FFF' }}>{v.capacidade} paletes</span>
                        </div>
                      )}

                      {/* RASTREAMENTO */}
                      {(v.ultimaLocalizacao || v.ultimaAtualizacaoRastreador) && (
                        <div style={{
                          marginBottom: '16px',
                          padding: '12px',
                          background: '#1A1A1A',
                          borderRadius: '10px',
                          borderLeft: `4px solid ${v.velocidade && v.velocidade > 0 ? '#22C55E' : '#FF9500'}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#4facfe', fontWeight: 'bold' }}>
                              📡 RASTREAMENTO
                            </span>
                            <span style={{
                              fontSize: '10px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: v.statusRastreador === 'online' ? '#22C55E20' : '#EF444420',
                              color: v.statusRastreador === 'online' ? '#22C55E' : '#EF4444'
                            }}>
                              {v.statusRastreador === 'online' ? '● ONLINE' : v.statusRastreador === 'parado' ? '⏹️ PARADO' : '○ OFFLINE'}
                            </span>
                          </div>
                          
                          {v.ultimaMacro && (
                            <div style={{ 
                              fontSize: '12px', 
                              color: '#FFD700', 
                              marginBottom: '8px',
                              padding: '4px 8px',
                              background: '#FFD70020',
                              borderRadius: '6px',
                              display: 'inline-block'
                            }}>
                              🏷️ {v.ultimaMacro}
                            </div>
                          )}
                          
                          <div style={{ fontSize: '13px', color: '#FFF', marginBottom: '6px' }}>
                            <strong>📍 Local:</strong> {v.ultimaLocalizacao || v.ultimoEndereco || '---'}
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888' }}>
                            <div>
                              ⏱️ {v.ultimaAtualizacaoRastreador 
                                ? new Date(v.ultimaAtualizacaoRastreador.seconds * 1000).toLocaleTimeString()
                                : '--:--'}
                            </div>
                            <div style={{ color: v.velocidade && v.velocidade > 0 ? '#22C55E' : '#888' }}>
                              🏎️ {v.velocidade || 0} km/h
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Motivo de Indisponibilidade */}
                      {!temProgramacao && motivo && (
                        <div style={{
                          marginBottom: '16px',
                          padding: '12px',
                          background: `${motivoInfo?.color}20`,
                          borderRadius: '10px',
                          borderLeft: `4px solid ${motivoInfo?.color}`
                        }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: motivoInfo?.color }}>
                            {motivoInfo?.icon} {motivoInfo?.label}
                          </div>
                          {motivo.descricao && (
                            <div style={{ fontSize: '12px', color: '#AAA' }}>
                              📝 {motivo.descricao}
                            </div>
                          )}
                          <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
                            Desde: {motivo.dataInicio}
                          </div>
                          <button
                            onClick={() => finalizarIndisponibilidade(v.id)}
                            style={{
                              marginTop: '12px',
                              padding: '6px 12px',
                              background: '#22C55E',
                              color: '#000',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              cursor: 'pointer'
                            }}
                          >
                            ✅ Finalizar Indisponibilidade
                          </button>
                        </div>
                      )}

                      {/* Programação Atual */}
                      {temProgramacao && carga && (
                        <div style={{
                          marginTop: '16px',
                          padding: '16px',
                          background: '#1A1A1A',
                          borderRadius: '12px',
                          borderLeft: `4px solid ${statusInfo?.color || '#3b82f6'}`
                        }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '12px', color: '#FFD700', fontSize: '14px' }}>
                            📋 CARGA ATUAL
                          </div>
                          
                          <div style={{ fontSize: '13px', marginBottom: '8px', color: '#FFF' }}>
                            <strong>🚛 DT:</strong> {carga.dt || '—'}
                          </div>
                          
                          <div style={{ fontSize: '13px', marginBottom: '8px', color: '#FFF' }}>
                            <strong>📍 Coleta:</strong> {carga.coletaCidade} - {carga.coletaLocal || ''}
                          </div>
                          <div style={{ fontSize: '12px', marginBottom: '8px', color: '#888', marginLeft: '15px' }}>
                            📅 {carga.coletaData || '—'}
                          </div>

                          <div style={{ fontSize: '13px', marginBottom: '8px', marginTop: '10px', color: '#FFF' }}>
                            <strong>🎯 Entrega:</strong> {carga.entregaCidade} - {carga.entregaLocal || ''}
                          </div>
                          <div style={{ fontSize: '12px', marginBottom: '8px', color: '#888', marginLeft: '15px' }}>
                            📅 {carga.entregaData || '—'}
                          </div>

                          <div style={{ fontSize: '13px', marginBottom: '8px', color: '#FFF' }}>
                            <strong>👨‍✈️ Motorista:</strong> {carga.motorista || '—'}
                          </div>
                          
                          <div style={{ fontSize: '13px', marginBottom: '8px', color: '#FFF' }}>
                            <strong>⚖️ Peso:</strong> {carga.peso || '—'} kg
                          </div>

                          {carga.carreta && (
                            <div style={{ fontSize: '13px', marginBottom: '8px', color: '#FFF' }}>
                              <strong>🔗 Carreta:</strong> {carga.carreta}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Botão para adicionar motivo */}
                      {!temProgramacao && !motivo && (
                        <button
                          onClick={() => setShowMotivoModal(v)}
                          style={{
                            width: '100%',
                            marginTop: '16px',
                            padding: '10px',
                            background: '#FF9500',
                            color: '#000',
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          ⚠️ Informar Motivo de Indisponibilidade
                        </button>
                      )}
                    </div>

                    {/* Ações */}
                    <div style={{ display: 'flex', gap: '10px', padding: '16px', background: '#0A0A0A', borderTop: '1px solid #1A1A1A' }}>
                      <button
                        onClick={() => setEditando(v)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          background: '#FFD700',
                          color: '#000',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        ✏️ Editar
                      </button>
                      
                      <button
                        onClick={() => setMapaModalVeiculo(v)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          background: v.coordenadas?.lat && v.coordenadas?.lng ? '#3B82F6' : '#555',
                          color: '#FFF',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: v.coordenadas?.lat && v.coordenadas?.lng ? 'pointer' : 'not-allowed',
                          fontWeight: 'bold',
                          opacity: v.coordenadas?.lat && v.coordenadas?.lng ? 1 : 0.5
                        }}
                        disabled={!v.coordenadas?.lat || !v.coordenadas?.lng}
                        title={!v.coordenadas?.lat || !v.coordenadas?.lng ? 'Coordenadas não disponíveis' : 'Ver no mapa'}
                      >
                        🗺️ Ver Localização
                      </button>
                      
                      <button
                        onClick={() => setShowDeleteConfirm(v.id)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          background: '#EF4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        🗑️ Excluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Modais */}
          {showMotivoModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }} onClick={() => setShowMotivoModal(null)}>
              <div style={{
                background: '#0A0A0A',
                padding: '32px',
                borderRadius: '24px',
                maxWidth: '450px',
                width: '90%',
                border: '1px solid #1A1A1A'
              }} onClick={(e) => e.stopPropagation()}>
                <h2 style={{ color: '#FFD700', marginBottom: '20px' }}>⚠️ Motivo da Indisponibilidade</h2>
                <p style={{ color: '#888', marginBottom: '20px' }}>
                  Veículo: <strong style={{ color: '#FFF' }}>{showMotivoModal.placa}</strong>
                </p>
                
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#AAA' }}>Tipo de Motivo</label>
                <select 
                  value={motivoSelecionado} 
                  onChange={(e) => setMotivoSelecionado(e.target.value as any)}
                  style={{ width: '100%', padding: '12px', marginBottom: '20px', backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '10px', color: '#FFF' }}
                >
                  <option value="manutencao">🔧 Em Manutenção</option>
                  <option value="folga_motorista">😴 Aguardando Motorista (Folga)</option>
                  <option value="aguardando_programacao">⏳ Aguardando Programação</option>
                </select>

                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#AAA' }}>Descrição (opcional)</label>
                <textarea 
                  value={descricaoMotivo} 
                  onChange={(e) => setDescricaoMotivo(e.target.value)}
                  placeholder="Ex: Troca de óleo, pneus, aguardando rota..."
                  style={{ width: '100%', padding: '12px', marginBottom: '20px', backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '10px', color: '#FFF', minHeight: '80px', resize: 'vertical' }}
                />
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setShowMotivoModal(null)} style={{ flex: 1, padding: '12px', background: '#333', color: '#FFF', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={salvarMotivoIndisponibilidade} style={{ flex: 1, padding: '12px', background: '#FFD700', color: '#000', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          )}

          {editando && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }} onClick={() => setEditando(null)}>
              <div style={{
                background: '#0A0A0A',
                padding: '32px',
                borderRadius: '24px',
                maxWidth: '450px',
                width: '90%',
                border: '1px solid #1A1A1A'
              }} onClick={(e) => e.stopPropagation()}>
                <h2 style={{ color: '#FFD700', marginBottom: '20px' }}>✏️ Editar Veículo</h2>
                <form onSubmit={handleUpdate}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#AAA' }}>Placa</label>
                  <input 
                    value={editando.placa} 
                    onChange={e => setEditando({...editando, placa: e.target.value})} 
                    style={{ width: '100%', padding: '12px', marginBottom: '16px', backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '10px', color: '#FFF' }}
                    required
                  />
                  
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#AAA' }}>Tipo de Veículo</label>
                  <select 
                    value={editando.tipo} 
                    onChange={e => setEditando({...editando, tipo: e.target.value, capacidade: e.target.value !== 'truck' ? '' : editando.capacidade})} 
                    style={{ width: '100%', padding: '12px', marginBottom: '16px', backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '10px', color: '#FFF' }}
                  >
                    <option value="toco">Toco (2 eixos)</option>
                    <option value="trucado">Trucado (3 eixos)</option>
                    <option value="truck">Truck (Cavalo)</option>
                  </select>
                  
                  {editando.tipo === 'truck' && (
                    <>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#AAA' }}>Capacidade de Paletes</label>
                      <input 
                        value={editando.capacidade || ''} 
                        onChange={e => setEditando({...editando, capacidade: e.target.value})} 
                        style={{ width: '100%', padding: '12px', marginBottom: '16px', backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '10px', color: '#FFF' }}
                        type="number"
                        required
                      />
                    </>
                  )}
                  
                  <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                    <button type="button" onClick={() => setEditando(null)} style={{ flex: 1, padding: '12px', background: '#333', color: '#FFF', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button type="submit" style={{ flex: 1, padding: '12px', background: '#FFD700', color: '#000', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                      Salvar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showDeleteConfirm && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }} onClick={() => setShowDeleteConfirm(null)}>
              <div style={{
                background: '#0A0A0A',
                padding: '32px',
                borderRadius: '24px',
                maxWidth: '400px',
                width: '90%',
                textAlign: 'center',
                border: '1px solid #1A1A1A'
              }} onClick={(e) => e.stopPropagation()}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>⚠️</div>
                <h3 style={{ color: '#FFF', marginBottom: '12px' }}>Confirmar exclusão</h3>
                <p style={{ color: '#888', marginBottom: '20px' }}>Tem certeza que deseja excluir este veículo? Esta ação não poderá ser desfeita.</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setShowDeleteConfirm(null)} style={{ flex: 1, padding: '12px', background: '#333', color: '#FFF', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={() => handleDelete(showDeleteConfirm)} style={{ flex: 1, padding: '12px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          )}

          {mapaModalVeiculo && (
            <MapaModal
              isOpen={true}
              onClose={() => setMapaModalVeiculo(null)}
              veiculo={mapaModalVeiculo}
            />
          )}
        </div>
      )}
    </>
  );
};

export default ListaVeiculos;