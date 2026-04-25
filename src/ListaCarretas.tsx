import React, { useEffect, useState, useMemo } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';

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
  carreta: string;
}

interface Carreta {
  id: string;
  placa: string;
  tipo: string;
  qtdPaletes?: number;
  motoristaId?: string;
  motoristaNome?: string;
  observacao?: string;
}

const ListaCarretas = () => {
  const [carretas, setCarretas] = useState<Carreta[]>([]);
  const [cargasPorCarreta, setCargasPorCarreta] = useState<Record<string, CargaProgramada | null>>({});
  const [loading, setLoading] = useState(true);
  const [loadingCargas, setLoadingCargas] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'comProgramacao' | 'semProgramacao'>('todos');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDesassociarConfirm, setShowDesassociarConfirm] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Buscar carretas
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'carretas'), (snap) => {
      const carretasList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Carreta));
      setCarretas(carretasList);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Função para buscar todas as cargas ativas
  const buscarTodasCargasAtivas = async () => {
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
          if (cargaData.carreta) {
            todasCargas.push({ 
              ...cargaData, 
              id: cargaDoc.id 
            });
          }
        });
      }
      return todasCargas;
    } catch (error) {
      console.error('Erro ao buscar cargas:', error);
      return [];
    }
  };

  // Buscar cargas para cada carreta
  useEffect(() => {
    if (carretas.length === 0) {
      setCargasPorCarreta({});
      setLoadingCargas(false);
      return;
    }

    const carregarCargas = async () => {
      setLoadingCargas(true);
      try {
        const todasCargas = await buscarTodasCargasAtivas();
        const cargasMap: Record<string, CargaProgramada | null> = {};
        
        carretas.forEach(c => { cargasMap[c.id] = null; });
        
        carretas.forEach(carreta => {
          const cargaEncontrada = todasCargas.find(carga => carga.carreta === carreta.placa);
          if (cargaEncontrada) {
            cargasMap[carreta.id] = cargaEncontrada;
          }
        });
        
        setCargasPorCarreta(cargasMap);
      } catch (error) {
        console.error('Erro:', error);
      } finally {
        setLoadingCargas(false);
      }
    };
    
    carregarCargas();
    const interval = setInterval(carregarCargas, 30000);
    return () => clearInterval(interval);
  }, [carretas]);

  const handleDesassociar = async (carretaId: string) => {
    try {
      await updateDoc(doc(db, 'carretas', carretaId), {
        motoristaId: null,
        motoristaNome: null
      });
      setShowDesassociarConfirm(null);
      showNotification('✅ Carreta desassociada com sucesso!', 'success');
    } catch (error) {
      showNotification('❌ Erro ao desassociar carreta', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'carretas', id));
      setShowDeleteConfirm(null);
      showNotification('✅ Carreta excluída com sucesso!', 'success');
    } catch (error) {
      showNotification('❌ Erro ao excluir carreta', 'error');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'programada': return { label: 'PROGRAMADA', color: '#FFD700', icon: '⏳' };
      case 'aguardando_carregamento': return { label: 'AGUARDANDO CARREG', color: '#FF9500', icon: '📦' };
      case 'seguindo_para_entrega': return { label: 'EM ROTA', color: '#22C55E', icon: '🚛' };
      case 'chegou_entrega': return { label: 'CHEGOU ENTREGA', color: '#3B82F6', icon: '📍' };
      default: return { label: status || 'DESCONHECIDO', color: '#666', icon: '❓' };
    }
  };

  // Filtros
  const filteredCarretas = useMemo(() => {
    return carretas.filter(c => {
      const cargaAtiva = cargasPorCarreta[c.id];
      const temProgramacao = cargaAtiva !== null;

      const matchPlaca = c.placa?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTipo = filterTipo === 'todos' || c.tipo === filterTipo;
      
      let matchProgramacao = true;
      if (filterStatus === 'comProgramacao') matchProgramacao = temProgramacao;
      if (filterStatus === 'semProgramacao') matchProgramacao = !temProgramacao;

      return matchPlaca && matchTipo && matchProgramacao;
    });
  }, [carretas, cargasPorCarreta, searchTerm, filterTipo, filterStatus]);

  // Estatísticas
  const stats = {
    total: carretas.length,
    comProgramacao: carretas.filter(c => cargasPorCarreta[c.id] !== null).length,
    semProgramacao: carretas.filter(c => cargasPorCarreta[c.id] === null).length,
    sider: carretas.filter(c => c.tipo === 'Sider').length,
    bau: carretas.filter(c => c.tipo === 'Baú').length,
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Carregando carretas...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        button:hover { transform: translateY(-2px); }
        button:active { transform: translateY(0); }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '10px' }}>🚛 Carretas Cadastradas</h1>
        <p style={{ color: '#666' }}>Gerencie todas as carretas da sua frota</p>
      </div>

      {/* Estatísticas */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '10px', flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.total}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Total</div>
        </div>
        <div style={{ background: '#e8f5e9', padding: '15px', borderRadius: '10px', flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22C55E' }}>{stats.comProgramacao}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Programadas</div>
        </div>
        <div style={{ background: '#ffebee', padding: '15px', borderRadius: '10px', flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#EF4444' }}>{stats.semProgramacao}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Disponíveis</div>
        </div>
        <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '10px', flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.sider}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Sider</div>
        </div>
        <div style={{ background: '#fff3e0', padding: '15px', borderRadius: '10px', flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.bau}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Baú</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por placa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
        />
        <select 
          value={filterTipo} 
          onChange={(e) => setFilterTipo(e.target.value)}
          style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
        >
          <option value="todos">Todos os tipos</option>
          <option value="Sider">Sider</option>
          <option value="Baú">Baú</option>
        </select>
        <select 
          value={filterStatus} 
          onChange={(e) => setFilterStatus(e.target.value as any)}
          style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
        >
          <option value="todos">Todos</option>
          <option value="comProgramacao">✅ Com Programação</option>
          <option value="semProgramacao">⭕ Sem Programação</option>
        </select>
      </div>

      {/* Notificação */}
      {successMessage && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px',
          background: '#10b981', color: 'white', padding: '10px 20px',
          borderRadius: '5px', zIndex: 1000
        }}>
          {successMessage}
        </div>
      )}

      {/* Loading */}
      {loadingCargas && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
          <p style={{ marginTop: '16px', color: '#666' }}>Carregando programações...</p>
        </div>
      )}

      {/* Grid */}
      {!loadingCargas && filteredCarretas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚛</div>
          <h3>Nenhuma carreta encontrada</h3>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
          {filteredCarretas.map(c => {
            const carga = cargasPorCarreta[c.id];
            const temProgramacao = carga !== null;
            const statusInfo = carga ? getStatusInfo(carga.status) : null;

            return (
              <div key={c.id} style={{
                background: 'white',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                border: temProgramacao ? '2px solid #22C55E' : '1px solid #ddd'
              }}>
                {/* Header */}
                <div style={{
                  background: temProgramacao ? '#22C55E' : '#667eea',
                  padding: '20px',
                  color: 'white',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  position: 'relative'
                }}>
                  <div>
                    <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{c.placa}</div>
                    <div style={{ fontSize: '14px', marginTop: '5px' }}>{c.tipo}</div>
                  </div>
                  <div style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px'
                  }}>
                    {c.tipo === 'Sider' ? '🚛' : '📦'} {c.tipo}
                  </div>
                  {temProgramacao && statusInfo && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-12px',
                      right: '20px',
                      background: statusInfo.color,
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: 'white'
                    }}>
                      {statusInfo.icon} {statusInfo.label}
                    </div>
                  )}
                </div>

                {/* Conteúdo */}
                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ color: '#666' }}>📦 Paletes:</span>
                    <strong>{c.qtdPaletes || 'N/A'}</strong>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ color: '#666' }}>📌 Status:</span>
                    <span style={{ color: temProgramacao ? '#22C55E' : '#94a3b8', fontWeight: 'bold' }}>
                      {temProgramacao ? '🚛 EM VIAGEM' : '⭕ DISPONÍVEL'}
                    </span>
                  </div>

                  {c.motoristaNome && !temProgramacao && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ color: '#666' }}>👤 Motorista:</span>
                      <span style={{ color: '#3b82f6' }}>{c.motoristaNome}</span>
                    </div>
                  )}

                  {/* Detalhes da Carga */}
                  {temProgramacao && carga && (
                    <div style={{
                      marginTop: '15px',
                      padding: '12px',
                      background: '#f9f9f9',
                      borderRadius: '8px',
                      borderLeft: `4px solid ${statusInfo?.color}`
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#3b82f6' }}>📋 CARGA ATUAL</div>
                      <div style={{ fontSize: '13px', marginBottom: '5px' }}><strong>DT:</strong> {carga.dt || '—'}</div>
                      <div style={{ fontSize: '13px', marginBottom: '5px' }}><strong>📍 Coleta:</strong> {carga.coletaCidade}</div>
                      <div style={{ fontSize: '13px', marginBottom: '5px' }}><strong>🎯 Entrega:</strong> {carga.entregaCidade}</div>
                      <div style={{ fontSize: '13px', marginBottom: '5px' }}><strong>👨‍✈️ Motorista:</strong> {carga.motorista}</div>
                      <div style={{ fontSize: '13px' }}><strong>🚛 Veículo:</strong> {carga.placa}</div>
                    </div>
                  )}

                  {c.observacao && (
                    <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                      <span style={{ color: '#666', fontSize: '12px' }}>📝 {c.observacao}</span>
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: '10px', padding: '15px', background: '#f8f9fa', borderTop: '1px solid #eee' }}>
                  {!temProgramacao && c.motoristaId && (
                    <button
                      onClick={() => setShowDesassociarConfirm(c.id)}
                      style={{ flex: 1, padding: '8px', background: '#eab308', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                    >
                      🔓 Desassociar
                    </button>
                  )}
                  <button
                    onClick={() => setShowDeleteConfirm(c.id)}
                    style={{ flex: 1, padding: '8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                  >
                    🗑️ Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Desassociar */}
      {showDesassociarConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowDesassociarConfirm(null)}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '10px', maxWidth: '400px', width: '90%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '48px' }}>🔓</div>
            <h3>Desassociar Carreta</h3>
            <p>Deseja desassociar esta carreta do motorista?</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setShowDesassociarConfirm(null)} style={{ flex: 1, padding: '10px', background: '#ccc', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => handleDesassociar(showDesassociarConfirm)} style={{ flex: 1, padding: '10px', background: '#eab308', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Desassociar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Excluir */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowDeleteConfirm(null)}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '10px', maxWidth: '400px', width: '90%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '48px' }}>⚠️</div>
            <h3>Confirmar exclusão</h3>
            <p>Tem certeza que deseja excluir esta carreta?</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setShowDeleteConfirm(null)} style={{ flex: 1, padding: '10px', background: '#ccc', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} style={{ flex: 1, padding: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListaCarretas;