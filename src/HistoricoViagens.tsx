import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collectionGroup, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Truck, Package, ArrowRightLeft, Search, ChevronRight, Edit2, Trash2, X, Save } from 'lucide-react';

interface CargaData {
  id: string;
  docId?: string;
  docPath?: string;
  dt: string;
  peso: string;
  placa: string;
  carreta: string;
  coletaData: string;
  coletaCidade: string;
  coletaLocal: string;
  entregaData: string;
  entregaCidade: string;
  entregaLocal: string;
  status: 'programada' | 'finalizada';
  tipo: 'normal' | 'com_troca';
  troca?: { cliente: string; cidade: string; };
  criadoEm?: any;
  cpf?: string;
}

interface HistoricoViagensProps { motoristaCpf: string; onVoltar: () => void; }

const HistoricoViagens: React.FC<HistoricoViagensProps> = ({ motoristaCpf, onVoltar }) => {
  const [viagens, setViagens] = useState<CargaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'programada' | 'finalizada'>('todas');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<CargaData>>({});

  useEffect(() => {
    if (!motoristaCpf) return;

    const q = query(
      collectionGroup(db, "cargas"),
      where("cpf", "==", motoristaCpf),
      orderBy("criadoEm", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const docs: CargaData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        docs.push({ 
          id: doc.id,
          docId: doc.id,
          docPath: doc.ref.path,
          ...data 
        } as CargaData);
      });
      setViagens(docs);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar histórico:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [motoristaCpf]);

  const handleEdit = (viagem: CargaData) => {
    setEditandoId(viagem.id);
    setEditData({
      dt: viagem.dt,
      peso: viagem.peso,
      placa: viagem.placa,
      carreta: viagem.carreta,
      coletaData: viagem.coletaData,
      coletaCidade: viagem.coletaCidade,
      coletaLocal: viagem.coletaLocal,
      entregaData: viagem.entregaData,
      entregaCidade: viagem.entregaCidade,
      entregaLocal: viagem.entregaLocal,
      status: viagem.status,
      tipo: viagem.tipo,
      troca: viagem.troca
    });
  };

  const handleSaveEdit = async (viagem: CargaData) => {
    try {
      if (!viagem.docPath) {
        console.error("Caminho do documento não encontrado");
        return;
      }
      
      const docRef = doc(db, viagem.docPath);
      await updateDoc(docRef, editData);
      setEditandoId(null);
      setEditData({});
    } catch (error) {
      console.error("Erro ao salvar edição:", error);
      alert("Erro ao salvar as alterações. Tente novamente.");
    }
  };

  const handleDelete = async (viagem: CargaData) => {
    if (window.confirm(`Tem certeza que deseja excluir a viagem de ${viagem.coletaCidade} para ${viagem.entregaCidade}?`)) {
      try {
        if (!viagem.docPath) {
          console.error("Caminho do documento não encontrado");
          return;
        }
        
        const docRef = doc(db, viagem.docPath);
        await deleteDoc(docRef);
        alert("Viagem excluída com sucesso!");
      } catch (error) {
        console.error("Erro ao excluir viagem:", error);
        alert("Erro ao excluir a viagem. Tente novamente.");
      }
    }
  };

  const handleCancelEdit = () => {
    setEditandoId(null);
    setEditData({});
  };

  const viagensFiltradas = viagens.filter(v => filtroStatus === 'todas' ? true : v.status === filtroStatus);

  const styles = {
    container: { padding: '20px', maxWidth: '1000px', margin: '0 auto', backgroundColor: '#000', minHeight: '100vh' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
    title: { fontSize: '24px', fontWeight: 900, color: '#FFF', margin: 0 },
    voltarBtn: { padding: '10px 20px', background: '#1A1A1A', border: '1px solid #333', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, color: '#FFD700' },
    filterBar: { display: 'flex', gap: '10px', marginBottom: '20px' },
    filterBtn: (active: boolean) => ({ padding: '8px 16px', borderRadius: '20px', border: '1px solid #333', backgroundColor: active ? '#FFD700' : '#1A1A1A', color: active ? '#000' : '#AAA', cursor: 'pointer', fontWeight: 700, fontSize: '13px', transition: 'all 0.2s' }),
    card: { backgroundColor: '#0A0A0A', borderRadius: '20px', padding: '20px', marginBottom: '16px', border: '1px solid #1A1A1A', display: 'flex', flexDirection: 'column' as const, gap: '16px' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    dtBadge: { backgroundColor: '#1A1A1A', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, color: '#AAA', border: '1px solid #333' },
    statusBadge: (status: string) => ({ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, backgroundColor: status === 'finalizada' ? '#22C55E20' : '#FFD70020', color: status === 'finalizada' ? '#22C55E' : '#FFD700' }),
    routeGrid: { display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '15px' },
    location: { display: 'flex', flexDirection: 'column' as const },
    city: { fontSize: '16px', fontWeight: 800, color: '#FFF' },
    local: { fontSize: '12px', color: '#888' },
    date: { fontSize: '11px', color: '#666', marginTop: '4px' },
    arrow: { color: '#FFD700' },
    detailsRow: { display: 'flex', gap: '20px', flexWrap: 'wrap' as const, paddingTop: '15px', borderTop: '1px solid #1F1F' },
    detailItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#AAA' },
    trocaBadge: { backgroundColor: '#FFD70020', border: '1px solid #FFD700', padding: '8px 12px', borderRadius: '12px', fontSize: '12px', color: '#FFD700', display: 'flex', alignItems: 'center', gap: '6px' },
    actionButtons: { display: 'flex', gap: '8px' },
    editBtn: { padding: '6px', backgroundColor: '#3B82F620', border: '1px solid #3B82F6', borderRadius: '8px', cursor: 'pointer', color: '#3B82F6', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' },
    deleteBtn: { padding: '6px', backgroundColor: '#EF444420', border: '1px solid #EF4444', borderRadius: '8px', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' },
    saveBtn: { padding: '6px 12px', backgroundColor: '#22C55E', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#FFF', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 },
    cancelBtn: { padding: '6px 12px', backgroundColor: '#6B7280', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#FFF', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 },
    editForm: { display: 'flex', flexDirection: 'column' as const, gap: '12px', marginTop: '12px', padding: '16px', backgroundColor: '#1A1A1A', borderRadius: '12px' },
    formRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' },
    formField: { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
    label: { fontSize: '12px', color: '#AAA', fontWeight: 600 },
    input: { padding: '8px 12px', backgroundColor: '#0A0A0A', border: '1px solid #333', borderRadius: '8px', color: '#FFF', fontSize: '14px' },
    select: { padding: '8px 12px', backgroundColor: '#0A0A0A', border: '1px solid #333', borderRadius: '8px', color: '#FFF', fontSize: '14px' }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>Carregando histórico...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Histórico de Viagens</h2>
        <button onClick={onVoltar} style={styles.voltarBtn}>← Voltar</button>
      </div>
      
      <div style={styles.filterBar}>
        <button style={styles.filterBtn(filtroStatus === 'todas')} onClick={() => setFiltroStatus('todas')}>Todas</button>
        <button style={styles.filterBtn(filtroStatus === 'programada')} onClick={() => setFiltroStatus('programada')}>Em Aberto</button>
        <button style={styles.filterBtn(filtroStatus === 'finalizada')} onClick={() => setFiltroStatus('finalizada')}>Finalizadas</button>
      </div>
      
      {viagensFiltradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', backgroundColor: '#0A0A0A', borderRadius: '24px', border: '2px dashed #1A1A1A' }}>
          <Search size={40} color="#333" style={{ marginBottom: '12px' }} />
          <p style={{ color: '#666', fontWeight: 500 }}>Nenhuma viagem encontrada.</p>
        </div>
      ) : (
        viagensFiltradas.map((v) => (
          <div key={v.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={styles.dtBadge}>DT: {v.dt || '---'}</span>
                <span style={styles.statusBadge(v.status)}>
                  {v.status === 'finalizada' ? '✓ Finalizada' : '⏳ Programada'}
                </span>
              </div>
              <div style={styles.actionButtons}>
                <button onClick={() => handleEdit(v)} style={styles.editBtn} title="Editar">
                  <Edit2 size={16} /> Editar
                </button>
                <button onClick={() => handleDelete(v)} style={styles.deleteBtn} title="Excluir">
                  <Trash2 size={16} /> Excluir
                </button>
              </div>
            </div>

            {editandoId === v.id ? (
              <div style={styles.editForm}>
                <div style={styles.formRow}>
                  <div style={styles.formField}>
                    <label style={styles.label}>Data/Hora</label>
                    <input
                      style={styles.input}
                      value={editData.dt || ''}
                      onChange={(e) => setEditData({ ...editData, dt: e.target.value })}
                      placeholder="Ex: 15/05/2026 08:00"
                    />
                  </div>
                  <div style={styles.formField}>
                    <label style={styles.label}>Peso (kg)</label>
                    <input
                      style={styles.input}
                      value={editData.peso || ''}
                      onChange={(e) => setEditData({ ...editData, peso: e.target.value })}
                      placeholder="Peso em kg"
                    />
                  </div>
                  <div style={styles.formField}>
                    <label style={styles.label}>Status</label>
                    <select
                      style={styles.select}
                      value={editData.status || 'programada'}
                      onChange={(e) => setEditData({ ...editData, status: e.target.value as 'programada' | 'finalizada' })}
                    >
                      <option value="programada">Programada</option>
                      <option value="finalizada">Finalizada</option>
                    </select>
                  </div>
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formField}>
                    <label style={styles.label}>Placa</label>
                    <input
                      style={styles.input}
                      value={editData.placa || ''}
                      onChange={(e) => setEditData({ ...editData, placa: e.target.value })}
                      placeholder="Placa do caminhão"
                    />
                  </div>
                  <div style={styles.formField}>
                    <label style={styles.label}>Carreta</label>
                    <input
                      style={styles.input}
                      value={editData.carreta || ''}
                      onChange={(e) => setEditData({ ...editData, carreta: e.target.value })}
                      placeholder="Carreta"
                    />
                  </div>
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formField}>
                    <label style={styles.label}>Coleta - Cidade</label>
                    <input
                      style={styles.input}
                      value={editData.coletaCidade || ''}
                      onChange={(e) => setEditData({ ...editData, coletaCidade: e.target.value })}
                    />
                  </div>
                  <div style={styles.formField}>
                    <label style={styles.label}>Coleta - Local</label>
                    <input
                      style={styles.input}
                      value={editData.coletaLocal || ''}
                      onChange={(e) => setEditData({ ...editData, coletaLocal: e.target.value })}
                    />
                  </div>
                  <div style={styles.formField}>
                    <label style={styles.label}>Coleta - Data</label>
                    <input
                      style={styles.input}
                      value={editData.coletaData || ''}
                      onChange={(e) => setEditData({ ...editData, coletaData: e.target.value })}
                      placeholder="DD/MM/AAAA"
                    />
                  </div>
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formField}>
                    <label style={styles.label}>Entrega - Cidade</label>
                    <input
                      style={styles.input}
                      value={editData.entregaCidade || ''}
                      onChange={(e) => setEditData({ ...editData, entregaCidade: e.target.value })}
                    />
                  </div>
                  <div style={styles.formField}>
                    <label style={styles.label}>Entrega - Local</label>
                    <input
                      style={styles.input}
                      value={editData.entregaLocal || ''}
                      onChange={(e) => setEditData({ ...editData, entregaLocal: e.target.value })}
                    />
                  </div>
                  <div style={styles.formField}>
                    <label style={styles.label}>Entrega - Data</label>
                    <input
                      style={styles.input}
                      value={editData.entregaData || ''}
                      onChange={(e) => setEditData({ ...editData, entregaData: e.target.value })}
                      placeholder="DD/MM/AAAA"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={handleCancelEdit} style={styles.cancelBtn}>
                    <X size={16} /> Cancelar
                  </button>
                  <button onClick={() => handleSaveEdit(v)} style={styles.saveBtn}>
                    <Save size={16} /> Salvar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={styles.routeGrid}>
                  <div style={styles.location}>
                    <span style={styles.city}>{v.coletaCidade || '---'}</span>
                    <span style={styles.local}>{v.coletaLocal || '---'}</span>
                    <span style={styles.date}>📅 {v.coletaData || '---'}</span>
                  </div>
                  <div style={styles.arrow}>
                    <ChevronRight size={20} color="#FFD700" />
                  </div>
                  <div style={styles.location}>
                    <span style={styles.city}>{v.entregaCidade || '---'}</span>
                    <span style={styles.local}>{v.entregaLocal || '---'}</span>
                    <span style={styles.date}>📅 {v.entregaData || '---'}</span>
                  </div>
                </div>
                
                {v.tipo === 'com_troca' && v.troca && (
                  <div style={styles.trocaBadge}>
                    <ArrowRightLeft size={14} />
                    <span>Troca: <strong>{v.troca.cliente}</strong> ({v.troca.cidade})</span>
                  </div>
                )}
                
                <div style={styles.detailsRow}>
                  <div style={styles.detailItem}>
                    <Truck size={14} /> {v.placa} / {v.carreta}
                  </div>
                  <div style={styles.detailItem}>
                    <Package size={14} /> {v.peso} kg
                  </div>
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default HistoricoViagens;