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
  MapPin,
  Image as ImageIcon,
  Upload,
  FileText,
  X
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
  const [abaAtiva, setAbaAtiva] = useState<'texto' | 'imagem'>('texto');
  const [textoColado, setTextoColado] = useState('');
  const [imagensSelecionadas, setImagensSelecionadas] = useState<File[]>([]);
  const [previewImagens, setPreviewImagens] = useState<string[]>([]);
  const [cargaDetectada, setCargaDetectada] = useState<CargaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOcr, setLoadingOcr] = useState(false);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

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
        if (linha.includes('Nome:')) novaCarga.motorista = Math.random() > 0.5 ? linha.split('Nome:')[1]?.trim() : linha.split('Nome:')[1]?.trim();
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

  // Nova função para manipular seleção e colagem de imagens
  const handleAlteracaoImagem = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const arquivos = Array.from(e.target.files);
      adicionarArquivosProcessamento(arquivos);
    }
  };

  const adicionarArquivosProcessamento = (arquivos: File[]) => {
    // Filtrar apenas imagens
    const imagens = arquivos.filter(arq => arq.type.startsWith('image/'));
    if (imagens.length === 0) return;

    setImagensSelecionadas(prev => [...prev, ...imagens]);
    
    const novosPreviews = imagens.map(img => URL.createObjectURL(img));
    setPreviewImagens(prev => [...prev, ...novosPreviews]);
    setMensagemErro(null);
  };

  const removerImagem = (index: number) => {
    setImagensSelecionadas(prev => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(previewImagens[index]);
    setPreviewImagens(prev => prev.filter((_, i) => i !== index));
    if (imagensSelecionadas.length <= 1) {
      setCargaDetectada(null);
    }
  };

  // Envia as imagens selecionadas para seu back-end/IA processar o OCR inteligente
  const processarImagensOcr = async () => {
    if (imagensSelecionadas.length === 0) return;
    
    setLoadingOcr(true);
    setMensagemErro(null);
    setCargaDetectada(null);

    try {
      const formData = new FormData();
      imagensSelecionadas.forEach((imagem) => {
        formData.append('images', imagem);
      });

      // --- EXEMPLO DE INTEGRAÇÃO COM SEU BACKEND/CLOUD FUNCTION ---
      // const resposta = await fetch('SUA_API_URL_DE_PROCESSAMENTO_DE_ORDENS', {
      //   method: 'POST',
      //   body: formData
      // });
      // const dadosEstruturados = await resposta.json();
      
      // Simulação do retorno baseado nas imagens que você enviou (Com Troca de Nota / Normal)
      // Substitua essa simulação pelo retorno real da sua API de extração de visão computacional.
      await new Promise(resolve => setTimeout(resolve, 2500)); 
      
      let mockDadosExtraidos: CargaData;

      if (imagensSelecionadas.length >= 2) {
        // Mock se enviar 2 ordens (Caso Unilever com troca)
        mockDadosExtraidos = {
          veiculo: 'FROTA',
          dt: '98311637 / 98311636',
          peso: '22.680',
          motorista: 'RODRIGO APARECIDO BARSANELE',
          cpf: '313.653.208-20',
          placa: 'FHJ-4994',
          carreta: 'DGY-6J83',
          coletaData: '28/05/2026 23:00',
          coletaLocal: 'UNILEVER BRASIL INDUSTRIAL LTDA',
          coletaCidade: 'INDAIATUBA',
          coletaLink: 'https://maps.app.goo.gl/B63QPbrSAGKwriLN9',
          entregaData: '02/06/2026 07:00',
          entregaLocal: 'DEYCON COM E DISTRIB LTDA',
          entregaCidade: 'SAO JOSE DOS PINHAIS',
          entregaLink: 'verificar na nota fiscal',
          obs: 'TNF / TNF 1637',
          pvs: ['41912', '15272'],
          tipo: 'com_troca',
          status: 'programada',
          troca: {
            cliente: 'UNILEVER BRASIL LTDA',
            cidade: 'POUSO ALEGRE',
            link: 'https://maps.app.goo.gl/qkq9HkWbziPrXygG9'
          }
        };
      } else {
        // Mock se enviar 1 ordem (Caso Dexco Direta)
        mockDadosExtraidos = {
          veiculo: 'FROTA',
          dt: '6100728759',
          peso: '6.007',
          motorista: 'MARCIO APARECIDO MARTINS',
          cpf: '158.367.858-13',
          placa: 'EJW-7360',
          carreta: '3 eixos',
          coletaData: '30/05/2026 18:45',
          coletaLocal: 'DEXCO S.A',
          coletaCidade: 'CAJAMAR',
          coletaLink: 'Verificar com a programação',
          entregaData: '01/06/2026 07:00',
          entregaLocal: 'TG LOGISTICA E TRANSPORTES LTDA',
          entregaCidade: 'GUARULHOS',
          entregaLink: 'https://maps.app.goo.gl/m3WsAkx5qvZW3TpUA',
          obs: '6100728759',
          pvs: ['41945'],
          tipo: 'normal',
          status: 'programada'
        };
      }

      setCargaDetectada(mockDadosExtraidos);
    } catch (err) {
      console.error(err);
      setMensagemErro("❌ Falha ao extrair dados das imagens. Certifique-se que o documento está legível.");
    } finally {
      setLoadingOcr(false);
    }
  };

  const verificarViagemAtiva = async (motoristaId: string): Promise<boolean> => {
    const q = query(
      collection(db, "motoristas", motoristaId, "cargas"),
      where("statusViagem", "==", "em_andamento")
    );
    const snap = await getDocs(q);
    return !snap.empty;
  };

  const verificarDTDuplicada = async (dt: string): Promise<boolean> => {
    const motoristasSnapshot = await getDocs(collection(db, "motoristas"));
    for (const motoristaDoc of motoristasSnapshot.docs) {
      const q = query(
        collection(db, "motoristas", motoristaDoc.id, "cargas"),
        where("dt", "==", dt)
      );
      const snap = await getDocs(q);
      if (!snap.empty) return true;
    }
    return false;
  };

  const verificarDataPassada = (dataStr: string): boolean => {
    if (!dataStr) return false;
    const partes = dataStr.split(' ')[0].split('/');
    if (partes.length !== 3) return false;
    const data = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return data < hoje;
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
    setMensagemErro(null);
    setLoading(true);
    
    try {
      if (cargaDetectada.dt && verificarDataPassada(cargaDetectada.dt)) {
        setMensagemErro(`❌ Não é permitido inserir viagem com data passada. Data informada: ${cargaDetectada.dt}`);
        setLoading(false);
        return;
      }

      if (cargaDetectada.dt && await verificarDTDuplicada(cargaDetectada.dt)) {
        setMensagemErro(`❌ Já existe uma carga cadastrada com o número de DT: ${cargaDetectada.dt}.`);
        setLoading(false);
        return;
      }

      const motoristaId = await obterOuCriarMotorista(cargaDetectada);
      if (!motoristaId) {
        setMensagemErro("❌ CPF do motorista é obrigatório. Por favor, preencha o CPF corretamente.");
        setLoading(false);
        return;
      }

      const temViagemAtiva = await verificarViagemAtiva(motoristaId);
      if (temViagemAtiva) {
        setMensagemErro(`❌ Motorista ${cargaDetectada.motorista} possui uma viagem em andamento.`);
        setLoading(false);
        return;
      }

      await finalizarCargasAntigas(motoristaId);

      await addDoc(collection(db, "motoristas", motoristaId, "cargas"), {
        ...cargaDetectada,
        criadoEm: serverTimestamp(),
        statusViagem: 'pendente'
      });

      await realizarAutoCadastros(cargaDetectada);
      setTextoColado(''); 
      setImagensSelecionadas([]);
      setPreviewImagens([]);
      setCargaDetectada(null);
      alert("✅ Carga salva com sucesso!");
    } catch (err) { 
      console.error(err); 
      setMensagemErro("❌ Erro ao salvar carga. Verifique sua conexão e tente novamente.");
    } finally { 
      setLoading(false); 
    }
  };

  const styles = {
    container: { padding: '40px 20px', backgroundColor: '#000', minHeight: '100vh', fontFamily: 'Inter, sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap' as const, gap: '16px' },
    title: { fontSize: '32px', fontWeight: 900, color: '#FFF', margin: 0, display: 'flex', alignItems: 'center', gap: '16px' },
    card: { backgroundColor: '#0A0A0A', borderRadius: '24px', padding: '32px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', marginBottom: '32px', border: '1px solid #1A1A1A' },
    tabsContainer: { display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid #1A1A1A', paddingBottom: '16px' },
    tabButton: (active: boolean) => ({
      backgroundColor: active ? '#FFD700' : '#111',
      color: active ? '#000' : '#888',
      padding: '12px 24px',
      borderRadius: '12px',
      border: active ? 'none' : '1px solid #333',
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'all 0.2s'
    }),
    textarea: { width: '100%', height: '140px', padding: '20px', borderRadius: '16px', border: '2px solid #333', fontSize: '15px', outline: 'none', transition: 'all 0.2s', resize: 'none' as const, backgroundColor: '#111', color: '#FFF' },
    uploadZone: { border: '2px dashed #333', borderRadius: '16px', padding: '40px 20px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: '#111', transition: 'all 0.2s' },
    previewBox: { backgroundColor: '#111', borderRadius: '20px', padding: '24px', border: '1px solid #333', marginTop: '24px' },
    grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' },
    infoItem: { display: 'flex', alignItems: 'center', gap: '12px' },
    iconBox: { padding: '10px', borderRadius: '12px', backgroundColor: '#1A1A1A', border: '1px solid #333' },
    label: { fontSize: '11px', color: '#666', fontWeight: 700, textTransform: 'uppercase' as const, margin: '0 0 4px 0', letterSpacing: '0.5px' },
    value: { fontSize: '15px', color: '#FFF', fontWeight: 700, margin: 0 },
    btnPrimary: { backgroundColor: '#FFD700', color: '#000', padding: '14px 28px', borderRadius: '14px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s', width: '100%', justifyContent: 'center' },
    btnPrimaryDisabled: { backgroundColor: '#665500', color: '#333', padding: '14px 28px', borderRadius: '14px', border: 'none', fontWeight: 700, cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'center' },
    btnOcr: { backgroundColor: '#1E3A8A', color: '#FFF', padding: '14px 28px', borderRadius: '14px', border: '1px solid #3B82F6', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s', width: '100%', justifyContent: 'center', marginTop: '16px' },
    badge: { backgroundColor: '#1A1A1A', color: '#FFD700', padding: '8px 16px', borderRadius: '30px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', border: '1px solid #333' },
    errorMessage: { backgroundColor: '#DC262620', border: '2px solid #DC2626', borderRadius: '16px', padding: '16px', marginBottom: '20px', color: '#FCA5A5', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '12px' },
    gridImagens: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '16px', marginTop: '20px', width: '100%' },
    wrapperImagem: { position: 'relative' as const, height: '140px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }
  };

  return (
    <div style={styles.container}>
      <style>{`
        * { box-sizing: border-box; }
        textarea:focus { border-color: #FFD700!important; box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1)!important; outline: none; }
        .upload-zone:hover { border-color: #FFD700!important; background-color: #151515!important; }
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
            <p style={{ margin: '8px 0 0', color: '#666', fontSize: '14px' }}>Cadastro de novas cargas no sistema por texto ou imagem de Ordem de Carregamento</p>
          </div>
        </header>

        <section style={styles.card}>
          <div style={styles.tabsContainer}>
            <button 
              style={styles.tabButton(abaAtiva === 'texto')} 
              onClick={() => { setAbaAtiva('texto'); setCargaDetectada(null); }}
            >
              <FileText size={18} /> Copiar e Colar Texto
            </button>
            <button 
              style={styles.tabButton(abaAtiva === 'imagem')} 
              onClick={() => { setAbaAtiva('imagem'); setCargaDetectada(null); }}
            >
              <ImageIcon size={18} /> Inserir por Imagem da Ordem
            </button>
          </div>
          
          {mensagemErro && (
            <div style={styles.errorMessage}>
              <div style={{ fontSize: '24px' }}>⚠️</div>
              <div style={{ flex: 1 }}>{mensagemErro}</div>
              <button 
                onClick={() => setMensagemErro(null)} 
                style={{ background: 'transparent', border: 'none', color: '#FCA5A5', cursor: 'pointer', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* ABA TEXTO */}
          {abaAtiva === 'texto' && (
            <textarea
              style={styles.textarea}
              placeholder="Cole aqui o texto estruturado da carga..."
              value={textoColado}
              onChange={(e) => { setTextoColado(e.target.value); parsearCarga(e.target.value); setMensagemErro(null); }}
            />
          )}

          {/* ABA IMAGEM */}
          {abaAtiva === 'imagem' && (
            <div>
              <label className="upload-zone" style={styles.uploadZone}>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={handleAlteracaoImagem}
                />
                <Upload size={40} color="#FFD700" style={{ marginBottom: '12px' }} />
                <p style={{ color: '#FFF', fontWeight: 700, margin: '0 0 4px 0', fontSize: '16px' }}>
                  Clique ou arraste as imagens das ordens aqui
                </p>
                <p style={{ color: '#555', margin: 0, fontSize: '13px' }}>
                  (Para cargas com troca de nota, selecione as duas ordens juntas)
                </p>
              </label>

              {previewImagens.length > 0 && (
                <div>
                  <div style={styles.gridImagens}>
                    {previewImagens.map((url, index) => (
                      <div key={index} style={styles.wrapperImagem}>
                        <img src={url} alt="Ordem" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          onClick={() => removerImagem(index)}
                          style={{ position: 'absolute', top: '6px', right: '6px', backgroundColor: '#DC2626', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#FFF' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  {!cargaDetectada && (
                    <button 
                      style={styles.btnOcr} 
                      onClick={processarImagensOcr}
                      disabled={loadingOcr}
                    >
                      {loadingOcr ? <RefreshCw size={20} className="spin" /> : <><PlusCircle size={20} /> Extrair Dados das Ordens</>}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PRÉ-VISUALIZAÇÃO COMPARTILHADA */}
          {cargaDetectada && (
            <div style={styles.previewBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#FFD700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ClipboardList size={18} /> Dados Extraídos do Documento
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={styles.badge}>DT: {cargaDetectada.dt}</span>
                  <span style={styles.badge}>KG: {cargaDetectada.peso}</span>
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
                  <div><p style={styles.label}>Placa / Carreta</p><p style={styles.value}>{cargaDetectada.placa} / {cargaDetectada.carreta}</p></div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.iconBox}><Layers size={18} color="#FFD700" /></div>
                  <div><p style={styles.label}>PVs / Tipo</p><p style={styles.value}>{cargaDetectada.pvs.join(', ') || 'Nenhum'} ({cargaDetectada.tipo})</p></div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: cargaDetectada.tipo === 'com_troca' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#22C55E15', border: '1px solid #22C55E' }}>
                  <p style={{...styles.label, color: '#22C55E' }}>1. Coleta ({cargaDetectada.coletaData})</p>
                  <p style={styles.value}>{cargaDetectada.coletaCidade}</p>
                  <p style={{...styles.value, fontSize: '13px', fontWeight: 500, color: '#888' }}>{cargaDetectada.coletaLocal}</p>
                </div>
                
                {cargaDetectada.tipo === 'com_troca' && cargaDetectada.troca && (
                  <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#3B82F615', border: '1px solid #3B82F6' }}>
                    <p style={{...styles.label, color: '#3B82F6' }}>2. Troca de Nota</p>
                    <p style={styles.value}>{cargaDetectada.troca.cidade}</p>
                    <p style={{...styles.value, fontSize: '13px', fontWeight: 500, color: '#888' }}>{cargaDetectada.troca.cliente}</p>
                  </div>
                )}

                <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#FFD70015', border: '1px solid #FFD700' }}>
                  <p style={{...styles.label, color: '#FFD700' }}>{cargaDetectada.tipo === 'com_troca' ? '3. Entrega' : '2. Entrega'} ({cargaDetectada.entregaData})</p>
                  <p style={styles.value}>{cargaDetectada.entregaCidade}</p>
                  <p style={{...styles.value, fontSize: '13px', fontWeight: 500, color: '#888' }}>{cargaDetectada.entregaLocal}</p>
                </div>
              </div>

              {cargaDetectada.obs && (
                <div style={{ marginBottom: '20px', padding: '12px 16px', backgroundColor: '#1A1A1A', borderRadius: '12px', border: '1px solid #333' }}>
                  <p style={styles.label}>Observações / Senha</p>
                  <p style={{...styles.value, fontSize: '14px', color: '#AAA' }}>{cargaDetectada.obs}</p>
                </div>
              )}

              <button 
                style={loading ? styles.btnPrimaryDisabled : styles.btnPrimary} 
                onClick={salvarTudo} 
                disabled={loading}
              >
                {loading ? <RefreshCw size={20} className="spin" /> : <><CheckCircle2 size={20} /> Confirmar e Registrar no Firebase</>}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default InserirProgramacao;