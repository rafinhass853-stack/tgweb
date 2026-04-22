import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collectionGroup, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Truck, Package, ArrowRightLeft, Search, ChevronRight } from 'lucide-react';

interface CargaData {
  id: string;
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
}

interface HistoricoViagensProps { motoristaCpf: string; onVoltar: () => void; }

const HistoricoViagens: React.FC<HistoricoViagensProps> = ({ motoristaCpf, onVoltar }) => {
  const [viagens, setViagens] = useState<CargaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'programada' | 'finalizada'>('todas');

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
        docs.push({ id: doc.id,...doc.data() } as CargaData);
      });
      setViagens(docs);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar histórico:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [motoristaCpf]);

  const viagensFiltradas = viagens.filter(v => filtroStatus === 'todas'? true : v.status === filtroStatus);

  const styles = {
    container: { padding: '20px', maxWidth: '1000px', margin: '0 auto', backgroundColor: '#000', minHeight: '100vh' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
    title: { fontSize: '24px', fontWeight: 900, color: '#FFF', margin: 0 },
    voltarBtn: { padding: '10px 20px', background: '#1A1A1A', border: '1px solid #333', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, color: '#FFD700' },
    filterBar: { display: 'flex', gap: '10px', marginBottom: '20px' },
    filterBtn: (active: boolean) => ({ padding: '8px 16px', borderRadius: '20px', border: '1px solid #333', backgroundColor: active? '#FFD700' : '#1A1A1A', color: active? '#000' : '#AAA', cursor: 'pointer', fontWeight: 700, fontSize: '13px', transition: 'all 0.2s' }),
    card: { backgroundColor: '#0A0A0A', borderRadius: '20px', padding: '20px', marginBottom: '16px', border: '1px solid #1A1A1A', display: 'flex', flexDirection: 'column' as const, gap: '16px' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    dtBadge: { backgroundColor: '#1A1A1A', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, color: '#AAA', border: '1px solid #333' },
    statusBadge: (status: string) => ({ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, backgroundColor: status === 'finalizada'? '#22C55E20' : '#FFD70020', color: status === 'finalizada'? '#22C55E' : '#FFD700' }),
    routeGrid: { display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '15px' },
    location: { display: 'flex', flexDirection: 'column' as const },
    city: { fontSize: '16px', fontWeight: 800, color: '#FFF' },
    local: { fontSize: '12px', color: '#888' },
    date: { fontSize: '11px', color: '#666', marginTop: '4px' },
    arrow: { color: '#FFD700' },
    detailsRow: { display: 'flex', gap: '20px', flexWrap: 'wrap' as const, paddingTop: '15px', borderTop: '1px solid #1F1F' },
    detailItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#AAA' },
    trocaBadge: { backgroundColor: '#FFD70020', border: '1px solid #FFD700', padding: '8px 12px', borderRadius: '12px', fontSize: '12px', color: '#FFD700', display: 'flex', alignItems: 'center', gap: '6px' }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>Carregando histórico...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}><h2 style={styles.title}>Histórico de Viagens</h2><button onClick={onVoltar} style={styles.voltarBtn}>← Voltar</button></div>
      <div style={styles.filterBar}>
        <button style={styles.filterBtn(filtroStatus === 'todas')} onClick={() => setFiltroStatus('todas')}>Todas</button>
        <button style={styles.filterBtn(filtroStatus === 'programada')} onClick={() => setFiltroStatus('programada')}>Em Aberto</button>
        <button style={styles.filterBtn(filtroStatus === 'finalizada')} onClick={() => setFiltroStatus('finalizada')}>Finalizadas</button>
      </div>
      {viagensFiltradas.length === 0? (
        <div style={{ textAlign: 'center', padding: '60px', backgroundColor: '#0A0A0A', borderRadius: '24px', border: '2px dashed #1A1A1A' }}><Search size={40} color="#333" style={{ marginBottom: '12px' }} /><p style={{ color: '#666', fontWeight: 500 }}>Nenhuma viagem encontrada.</p></div>
      ) : (
        viagensFiltradas.map((v) => (
          <div key={v.id} style={styles.card}>
            <div style={styles.cardHeader}><div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span style={styles.dtBadge}>DT: {v.dt || '---'}</span><span style={styles.statusBadge(v.status)}>{v.status === 'finalizada'? '✓ Finalizada' : '⏳ Programada'}</span></div><span style={{ fontSize: '11px', color: '#666' }}>{v.criadoEm?.toDate? v.criadoEm.toDate().toLocaleDateString('pt-BR') : ''}</span></div>
            <div style={styles.routeGrid}><div style={styles.location}><span style={styles.city}>{v.coletaCidade || '---'}</span><span style={styles.local}>{v.coletaLocal || '---'}</span><span style={styles.date}>📅 {v.coletaData || '---'}</span></div><div style={styles.arrow}><ChevronRight size={20} color="#FFD700" /></div><div style={styles.location}><span style={styles.city}>{v.entregaCidade || '---'}</span><span style={styles.local}>{v.entregaLocal || '---'}</span><span style={styles.date}>📅 {v.entregaData || '---'}</span></div></div>
            {v.tipo === 'com_troca' && v.troca && (<div style={styles.trocaBadge}><ArrowRightLeft size={14} /><span>Troca: <strong>{v.troca.cliente}</strong> ({v.troca.cidade})</span></div>)}
            <div style={styles.detailsRow}><div style={styles.detailItem}><Truck size={14} /> {v.placa} / {v.carreta}</div><div style={styles.detailItem}><Package size={14} /> {v.peso} kg</div></div>
          </div>
        ))
      )}
    </div>
  );
};

export default HistoricoViagens;