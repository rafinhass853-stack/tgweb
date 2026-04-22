import React, { useState } from 'react';
import { db } from './firebase';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import {
  Truck,
  ClipboardList,
  PlusCircle,
  RefreshCw,
  CheckCircle2,
  User,
  CreditCard,
  Hash,
  Layers,
  MapPin
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

const InserirProgramacao: React.FC = () => {
  const [textoColado, setTextoColado] = useState('');
  const [cargaDetectada, setCargaDetectada] = useState<CargaData | null>(null);
  const [loading, setLoading] = useState(false);

  const parsearCarga = (texto: string) => {
    if (!texto.trim()) { setCargaDetectada(null); return; }
    try {
      const linhas = texto.split('\n').map(l => l.trim()).filter(l => l);
      const novaCarga: CargaData = {
        veiculo: 'FROTA', dt: '', peso: '', motorista: '', cpf: '', placa: '', carreta: '',
        coletaData: '', coletaLocal: '', coletaCidade: '', coletaLink: '',
        entregaData: '', entregaLocal: '', entregaCidade: '', entregaLink: '',
        obs: '', pvs: [], tipo: 'normal', status: 'programada'
      };
      let blocoAtual: 'COLETA' | 'ENTREGA' | 'TROCA' | null = null;
      linhas.forEach((linha) => {
        if (linha.includes('DT:')) novaCarga.dt = linha.split('DT:')[1]?.trim();
        if (linha.includes('Peso:')) novaCarga.peso = linha.split('Peso:')[1]?.trim();
        if (linha.includes('Nome:')) novaCarga.motorista = linha.split('Nome:')[1]?.trim();
        if (linha.includes('CPF:')) novaCarga.cpf = linha.split('CPF:')[1]?.trim();
        if (linha.includes('Placa/Carreta')) {
          const conteudo = linha.replace('Placa/Carreta', '').trim();
          if (conteudo.includes('/')) {
            const partes = conteudo.split('/');
            novaCarga.placa = partes[0].trim();
            novaCarga.carreta = partes[1].trim();
          } else {
            novaCarga.placa = conteudo;
          }
        }
        if (linha.toUpperCase().startsWith('COLETA')) { novaCarga.coletaData = linha.replace(/COLETA/i, '').trim(); blocoAtual = 'COLETA'; }
        if (linha.toUpperCase().startsWith('ENTREGA')) { novaCarga.entregaData = linha.replace(/ENTREGA/i, '').trim(); blocoAtual = 'ENTREGA'; }
        if (linha.toUpperCase().includes('TROCA')) {
          blocoAtual = 'TROCA'; novaCarga.tipo = 'com_troca';
          if (!novaCarga.troca) novaCarga.troca = { cliente: '', cidade: '', link: '' };
        }
        const valor = linha.split(':')[1]?.trim();
        if (linha.includes('Local:')) {
          if (blocoAtual === 'COLETA') novaCarga.coletaLocal = valor;
          else if (blocoAtual === 'ENTREGA') novaCarga.entregaLocal = valor;
        }
        if (linha.includes('Cidade:') || linha.includes('CIDADE:')) {
          if (blocoAtual === 'COLETA') novaCarga.coletaCidade = valor;
          else if (blocoAtual === 'ENTREGA') novaCarga.entregaCidade = valor;
          else if (blocoAtual === 'TROCA') novaCarga.troca!.cidade = valor;
        }
        if (linha.includes('Link:')) {
          const url = linha.split('Link:')[1]?.trim();
          if (blocoAtual === 'COLETA') novaCarga.coletaLink = url;
          else if (blocoAtual === 'ENTREGA') novaCarga.entregaLink = url;
          else if (blocoAtual === 'TROCA') novaCarga.troca!.link = url;
        }
        if (blocoAtual === 'TROCA' && linha.includes('CLIENTE:')) novaCarga.troca!.cliente = valor;
        if (linha.includes('PV:')) {
          if (!linha.includes('CPF') && !linha.includes('DT') && !linha.includes('Peso')) novaCarga.pvs.push(linha.trim());
        }
      });
      setCargaDetectada(novaCarga);
    } catch (err) { console.error("Erro no Parse:", err); }
  };

  const obterOuCriarMotorista = async (dados: CargaData): Promise<string | null> => {
    if (!dados.cpf) return null;
    const qMot = query(collection(db, "motoristas"), where("cpf", "==", dados.cpf));
    const snapMot = await getDocs(qMot);

    if (!snapMot.empty) {
      return snapMot.docs[0].id;
    } else {
      const docRef = await addDoc(collection(db, "motoristas"), {
        nome: dados.motorista, cpf: dados.cpf, createdAt: serverTimestamp(),
        temMopp: "Não", whatsapp: "", cidade: dados.coletaCidade || ""
      });
      return docRef.id;
    }
  };

  const realizarAutoCadastros = async (dados: CargaData) => {
    if (dados.placa) {
      const qVei = query(collection(db, "veiculos"), where("placa", "==", dados.placa));
      const snapVei = await getDocs(qVei);
      if (snapVei.empty) await addDoc(collection(db, "veiculos"), { placa: dados.placa, dataCadastro: serverTimestamp() });
    }
  };

  const finalizarCargasAntigas = async (motoristaId: string) => {
    if (!motoristaId) return;
    const q = query(collection(db, "motoristas", motoristaId, "cargas"), where("status", "==", "programada"));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.forEach((docSnap) => batch.update(docSnap.ref, { status: 'finalizada' }));
      await batch.commit();
    }
  };

  const salvarTudo = async () => {
    if (!cargaDetectada) return;
    setLoading(true);
    try {
      const motoristaId = await obterOuCriarMotorista(cargaDetectada);
      if (!motoristaId) {
        alert("❌ CPF do motorista é obrigatório.");
        return;
      }

      await finalizarCargasAntigas(motoristaId);

      await addDoc(collection(db, "motoristas", motoristaId, "cargas"), {
        ...cargaDetectada,
        criadoEm: serverTimestamp(),
        statusViagem: 'pendente'
      });

      await realizarAutoCadastros(cargaDetectada);
      setTextoColado(''); setCargaDetectada(null);
      alert("✅ Carga salva com sucesso!");
    } catch (err) { console.error(err); alert("❌ Erro ao salvar carga."); } finally { setLoading(false); }
  };

  const styles = {
    container: { padding: '40px 20px', backgroundColor: '#000', minHeight: '100vh', fontFamily: 'Inter, sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap' as const, gap: '16px' },
    title: { fontSize: '32px', fontWeight: 900, color: '#FFF', margin: 0, display: 'flex', alignItems: 'center', gap: '16px' },
    card: { backgroundColor: '#0A0A0A', borderRadius: '24px', padding: '32px', boxShadow: '0 10px 25px -5px rgba(0,0,0.3)', marginBottom: '32px', border: '1px solid #1A1A1A' },
    textarea: { width: '100%', height: '120px', padding: '20px', borderRadius: '16px', border: '2px solid #333', fontSize: '15px', marginBottom: '20px', outline: 'none', transition: 'all 0.2s', resize: 'none' as const, backgroundColor: '#111', color: '#FFF' },
    previewBox: { backgroundColor: '#111', borderRadius: '20px', padding: '24px', border: '1px solid #333' },
    grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' },
    infoItem: { display: 'flex', alignItems: 'center', gap: '12px' },
    iconBox: { padding: '10px', borderRadius: '12px', backgroundColor: '#1A1A1A', border: '1px solid #333' },
    label: { fontSize: '11px', color: '#666', fontWeight: 700, textTransform: 'uppercase' as const, margin: '0 0 4px 0', letterSpacing: '0.5px' },
    value: { fontSize: '15px', color: '#FFF', fontWeight: 700, margin: 0 },
    btnPrimary: { backgroundColor: '#FFD700', color: '#000', padding: '14px 28px', borderRadius: '14px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s', width: '100%', justifyContent: 'center' },
    badge: { backgroundColor: '#1A1A1A', color: '#FFD700', padding: '8px 16px', borderRadius: '30px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', border: '1px solid #333' },
  };

  return (
    <div style={styles.container}>
      <style>{`
        * { box-sizing: border-box; }
        textarea:focus { border-color: #FFD700!important; box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1)!important; outline: none; }
        button:hover { transform: translateY(-1px); filter: brightness(0.98); }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>
              <div style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', padding: '10px', borderRadius: '16px' }}>
                <Truck size={32} color="#000" />
              </div> Inserir Programação
            </h1>
            <p style={{ margin: '8px 0 0', color: '#666', fontSize: '14px' }}>Cadastro de novas cargas no sistema</p>
          </div>
        </header>

        {/* SEÇÃO DE LANÇAR CARGA */}
        <section style={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', padding: '8px', borderRadius: '14px' }}><PlusCircle size={20} color="#000" /></div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#FFF' }}>Lançar Nova Carga</h2>
          </div>
          <textarea
            style={styles.textarea}
            placeholder="Cole aqui o texto da carga..."
            value={textoColado}
            onChange={(e) => { setTextoColado(e.target.value); parsearCarga(e.target.value); }}
          />

          {cargaDetectada && (
            <div style={styles.previewBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#FFD700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ClipboardList size={18} /> Pré-visualização dos Dados
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{...styles.badge, backgroundColor: '#1A1A1A', border: '1px solid #333' }}>{cargaDetectada.dt}</span>
                  <span style={{...styles.badge, backgroundColor: '#1A1A1A', border: '1px solid #333' }}>{cargaDetectada.peso}</span>
                </div>
              </div>

              <div style={styles.grid4}>
                <div style={styles.infoItem}>
                  <div style={styles.iconBox}><User size={18} color="#FFD700" /></div>
                  <div><p style={styles.label}>Motorista</p><p style={styles.value}>{cargaDetectada.motorista}</p></div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.iconBox}><CreditCard size={18} color="#FFD700" /></div>
                  <div><p style={styles.label}>CPF</p><p style={styles.value}>{cargaDetectada.cpf}</p></div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.iconBox}><Hash size={18} color="#FFD700" /></div>
                  <div><p style={styles.label}>Placa</p><p style={styles.value}>{cargaDetectada.placa}</p></div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.iconBox}><Layers size={18} color="#FFD700" /></div>
                  <div><p style={styles.label}>Carreta</p><p style={styles.value}>{cargaDetectada.carreta}</p></div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#22C55E20', border: '1px solid #22C55E' }}>
                  <p style={{...styles.label, color: '#22C55E' }}>Origem</p>
                  <p style={styles.value}>{cargaDetectada.coletaCidade}</p>
                  <p style={{...styles.value, fontSize: '13px', fontWeight: 500, color: '#888' }}>{cargaDetectada.coletaLocal}</p>
                </div>
                <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#FFD70020', border: '1px solid #FFD700' }}>
                  <p style={{...styles.label, color: '#FFD700' }}>Destino</p>
                  <p style={styles.value}>{cargaDetectada.entregaCidade}</p>
                  <p style={{...styles.value, fontSize: '13px', fontWeight: 500, color: '#888' }}>{cargaDetectada.entregaLocal}</p>
                </div>
              </div>

              <button style={styles.btnPrimary} onClick={salvarTudo} disabled={loading}>
                {loading ? <RefreshCw size={20} className="spin" /> : <><CheckCircle2 size={20} /> Confirmar e Salvar Carga</>}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default InserirProgramacao;