import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updatePassword,
  sendPasswordResetEmail
} from 'firebase/auth';

import { db, storage } from './firebase';
import EscalaFolga from './EscalaFolga';
import HistoricoViagens from './HistoricoViagens';

interface Motorista {
  id: string;
  nome: string;
  cpf: string;
  whatsapp?: string;
  cidade?: string;
  cnhCategoria?: string;
  temMopp?: string;
  email?: string;
  senha?: string;
  fotoPerfilUrl?: string;
  uid?: string;
  createdAt?: string;
}

interface MenuMotoristaProps {
  motoristaId: string;
  onVoltar: () => void;
}

const MenuMotorista: React.FC<MenuMotoristaProps> = ({ motoristaId, onVoltar }) => {
  const [motorista, setMotorista] = useState<Motorista | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<Motorista | null>(null);
  const [novaFoto, setNovaFoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const auth = getAuth();

  useEffect(() => {
    const fetchMotorista = async () => {
      try {
        const docRef = doc(db, 'motoristas', motoristaId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Motorista;
          setMotorista(data);
          setEditForm(data);
        }
      } catch (error) {
        console.error('Erro ao carregar motorista:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMotorista();
  }, [motoristaId]);

  useEffect(() => {
    if (novaFoto) {
      const objectUrl = URL.createObjectURL(novaFoto);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [novaFoto]);

  const handleSaveEdit = async () => {
    if (!editForm || !motorista) return;
    setUploading(true);

    try {
      let fotoUrlFinal = editForm.fotoPerfilUrl;

      // Upload da foto se houver nova
      if (novaFoto) {
        const storageRef = ref(storage, `fotos-motoristas/${motorista.id}-${Date.now()}`);
        await uploadBytes(storageRef, novaFoto);
        fotoUrlFinal = await getDownloadURL(storageRef);
      }

      const motoristaRef = doc(db, 'motoristas', motorista.id);
      
      // Dados base para atualização (sempre atualiza esses campos)
      const baseUpdatedData: any = {
        nome: editForm.nome,
        cpf: editForm.cpf,
        whatsapp: editForm.whatsapp || '',
        cidade: editForm.cidade || '',
        cnhCategoria: editForm.cnhCategoria || '',
        temMopp: editForm.temMopp || 'Não',
        fotoPerfilUrl: fotoUrlFinal
      };

      // VERIFICAR SE TEM EMAIL E SENHA PARA CRIAR/ATUALIZAR LOGIN
      const emailInformado = editForm.email && editForm.email.trim() !== '';
      const senhaInformada = editForm.senha && editForm.senha.trim() !== '';

      if (emailInformado && senhaInformada && editForm.senha!.length >= 6) {
        // CASO 1: Tem email e senha válidos - tentar criar/atualizar usuário no Auth
        try {
          let uidExistente = motorista.uid;
          
          // Se não tem uid, tenta criar novo usuário
          if (!uidExistente) {
            const userCredential = await createUserWithEmailAndPassword(
              auth,
              editForm.email!.trim(),
              editForm.senha!.trim()
            );
            uidExistente = userCredential.user.uid;
            baseUpdatedData.uid = uidExistente;
            baseUpdatedData.email = editForm.email!.trim();
            
            alert('✅ Usuário criado no Authentication com sucesso!');
          } else {
            // Usuário já existe, tenta atualizar a senha se necessário
            try {
              // Faz login para verificar se a senha mudou
              if (motorista.email !== editForm.email) {
                // Email mudou - melhor criar novo ou avisar
                alert('⚠️ Para alterar o email, entre em contato com o administrador.');
                baseUpdatedData.email = motorista.email; // Mantém email antigo
              } else if (editForm.senha !== motorista.senha) {
                // Senha mudou - tenta atualizar
                try {
                  // Precisa estar logado para mudar senha
                  const userCred = await signInWithEmailAndPassword(auth, editForm.email!.trim(), editForm.senha!.trim());
                  await updatePassword(userCred.user, editForm.senha!.trim());
                  alert('✅ Senha atualizada com sucesso!');
                } catch (loginError) {
                  console.error('Erro ao autenticar para mudar senha:', loginError);
                  // Se não conseguir logar, envia email de reset
                  await sendPasswordResetEmail(auth, editForm.email!.trim());
                  alert('⚠️ Enviamos um email para redefinir a senha. Por favor, verifique sua caixa de entrada.');
                }
              }
              baseUpdatedData.email = editForm.email!.trim();
            } catch (error) {
              console.error('Erro ao atualizar usuário existente:', error);
            }
          }
          
          // Atualiza Firestore com todos os dados
          await updateDoc(motoristaRef, baseUpdatedData);
          
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            alert('⚠️ Este email já está em uso. Os dados foram atualizados no sistema.');
            baseUpdatedData.email = editForm.email!.trim();
            await updateDoc(motoristaRef, baseUpdatedData);
          } else {
            console.error('Erro no Auth:', authError);
            alert(`❌ Erro ao configurar login: ${authError.message}\n\nOs dados pessoais foram salvos.`);
            await updateDoc(motoristaRef, baseUpdatedData);
          }
        }
      } else {
        // CASO 2: Sem email ou senha - apenas atualiza dados pessoais
        if (!emailInformado) {
          delete baseUpdatedData.email; // Remove email se não informado
        }
        await updateDoc(motoristaRef, baseUpdatedData);
        
        if (!emailInformado) {
          alert('✅ Dados pessoais atualizados com sucesso! (Login não configurado)');
        } else if (!senhaInformada) {
          alert('✅ Dados pessoais atualizados! ⚠️ Para criar login, informe uma senha com 6+ caracteres.');
        } else if (editForm.senha!.length < 6) {
          alert('✅ Dados pessoais atualizados! ⚠️ A senha deve ter pelo menos 6 caracteres para criar o login.');
        } else {
          alert('✅ Dados pessoais atualizados com sucesso!');
        }
      }

      // Atualiza estado local
      setMotorista({ ...motorista, ...baseUpdatedData, id: motorista.id });
      setShowEditModal(false);
      setNovaFoto(null);
      setPreviewUrl(null);

    } catch (error) {
      console.error('Erro geral ao salvar:', error);
      alert('❌ Erro ao salvar alterações');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div style={loadingStyle}>Carregando informações do motorista...</div>;
  if (!motorista) return <div style={errorStyle}>Motorista não encontrado</div>;

  if (activeSubTab === 'escala') return <EscalaFolga motoristaId={motoristaId} onVoltar={() => setActiveSubTab(null)} />;
  if (activeSubTab === 'historico') return <HistoricoViagens motoristaCpf={motorista.cpf} onVoltar={() => setActiveSubTab(null)} />;

  return (
    <div style={containerStyle}>
      <button onClick={onVoltar} style={voltarBtn}>← Voltar para lista</button>

      <div style={headerStyle}>
        <div style={fotoWrapper}>
          {motorista.fotoPerfilUrl ? (
            <img src={motorista.fotoPerfilUrl} alt={motorista.nome} style={fotoStyle} />
          ) : (
            <div style={initialsStyle}>{motorista.nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div>
          )}
          <div style={moppBadge}>{motorista.temMopp === 'Sim' ? '✅ MOPP' : '❌ Sem MOPP'}</div>
        </div>

        <div style={infoSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h1 style={nomeTitle}>{motorista.nome}</h1>
            <button onClick={() => setShowEditModal(true)} style={editMainButton}>✏️ Editar Motorista</button>
          </div>
          <p style={cpfText}>CPF: <strong>{motorista.cpf}</strong></p>
          <div style={detailsGrid}>
            <div>📱 WhatsApp: <strong>{motorista.whatsapp || 'Não informado'}</strong></div>
            <div>📍 Cidade: <strong>{motorista.cidade || 'Não informada'}</strong></div>
            <div>🪪 CNH: <strong>{motorista.cnhCategoria || '—'}</strong></div>
            <div>📧 Login App: <strong>{motorista.email || 'Não configurado'}</strong></div>
          </div>
        </div>
      </div>

      <h2 style={menuTitle}>Menu do Motorista</h2>

      <div style={cardsGrid}>
        {menuItems.map(item => (
          <div
            key={item.id}
            style={{
              ...menuCardStyle,
              transform: hoveredCard === item.id ? 'translateY(-6px)' : 'none',
              boxShadow: hoveredCard === item.id ? '0 20px 40px rgba(255,215,0,0.2)' : '0 10px 30px rgba(0,0,0,0.3)'
            }}
            onMouseEnter={() => setHoveredCard(item.id)}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => setActiveSubTab(item.id)}
          >
            <div style={{ ...iconCircle, backgroundColor: '#1A1A' }}>
              <span style={{ color: '#FFD700', fontSize: '42px' }}>{item.icon}</span>
            </div>
            <h3 style={cardTitle}>{item.title}</h3>
            <p style={cardDesc}>{item.desc}</p>
          </div>
        ))}
      </div>

      {/* MODAL DE EDIÇÃO */}
      {showEditModal && editForm && (
        <div style={modalOverlay} onClick={() => setShowEditModal(false)}>
          <div style={modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#FFF' }}>Editar Motorista</h2>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#888' }}>×</button>
            </div>

            <div style={formSectionTitle}>📋 Dados Pessoais (sempre disponíveis para edição)</div>
            <div style={formGrid}>
              <div>
                <label style={labelStyle}>Nome Completo *</label>
                <input 
                  type="text" 
                  value={editForm.nome} 
                  onChange={e => setEditForm({ ...editForm, nome: e.target.value })} 
                  style={inputField} 
                />
              </div>
              <div>
                <label style={labelStyle}>CPF *</label>
                <input 
                  type="text" 
                  value={editForm.cpf} 
                  onChange={e => setEditForm({ ...editForm, cpf: e.target.value })} 
                  style={inputField} 
                />
              </div>
              <div>
                <label style={labelStyle}>WhatsApp</label>
                <input 
                  type="text" 
                  value={editForm.whatsapp || ''} 
                  onChange={e => setEditForm({ ...editForm, whatsapp: e.target.value })} 
                  style={inputField} 
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label style={labelStyle}>Cidade</label>
                <input 
                  type="text" 
                  value={editForm.cidade || ''} 
                  onChange={e => setEditForm({ ...editForm, cidade: e.target.value })} 
                  style={inputField} 
                  placeholder="São Paulo - SP"
                />
              </div>
              <div>
                <label style={labelStyle}>CNH Categoria</label>
                <input 
                  type="text" 
                  value={editForm.cnhCategoria || ''} 
                  onChange={e => setEditForm({ ...editForm, cnhCategoria: e.target.value.toUpperCase() })} 
                  style={inputField} 
                  maxLength={2} 
                  placeholder="E"
                />
              </div>
              <div>
                <label style={labelStyle}>Possui MOPP?</label>
                <select 
                  value={editForm.temMopp || 'Não'} 
                  onChange={e => setEditForm({ ...editForm, temMopp: e.target.value })} 
                  style={inputField}
                >
                  <option value="Não">Não</option>
                  <option value="Sim">Sim</option>
                </select>
              </div>
            </div>

            <div style={formSectionTitle}>🔐 Acesso ao Aplicativo (opcional - deixe vazio para não criar login)</div>
            <div style={{ ...formGrid, marginBottom: '15px' }}>
              <div>
                <label style={labelStyle}>E-mail de Login</label>
                <input
                  type="email"
                  placeholder="exemplo@email.com"
                  value={editForm.email || ''}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  style={inputField}
                />
                <small style={{ color: '#666', fontSize: '11px', marginTop: '5px', display: 'block' }}>
                  {motorista.email ? 'Deixe em branco para manter o email atual' : 'Preencha para criar acesso'}
                </small>
              </div>
              <div>
                <label style={labelStyle}>Senha de Acesso</label>
                <input
                  type="text"
                  placeholder="Mínimo 6 caracteres"
                  value={editForm.senha || ''}
                  onChange={e => setEditForm({ ...editForm, senha: e.target.value })}
                  style={inputField}
                />
                <small style={{ color: '#666', fontSize: '11px', marginTop: '5px', display: 'block' }}>
                  {motorista.email ? 'Preencha apenas se quiser alterar a senha' : 'Necessário para criar o login'}
                </small>
              </div>
            </div>

            <div style={{ marginTop: '30px' }}>
              <label style={labelStyle}>🖼️ Foto de Perfil</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={e => e.target.files && setNovaFoto(e.target.files[0])} 
                style={{ marginTop: '10px', display: 'block', color: '#AAA' }} 
              />
              {(previewUrl || editForm.fotoPerfilUrl) && (
                <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <img 
                    src={previewUrl || editForm.fotoPerfilUrl} 
                    alt="Preview" 
                    style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #FFD700' }} 
                  />
                  <span style={{ color: '#888', fontSize: '12px' }}>
                    {previewUrl ? 'Nova foto selecionada' : 'Foto atual'}
                  </span>
                </div>
              )}
            </div>

            <div style={modalActions}>
              <button onClick={() => setShowEditModal(false)} style={cancelBtn}>Cancelar</button>
              <button onClick={handleSaveEdit} style={saveBtn} disabled={uploading}>
                {uploading ? 'Salvando...' : '💾 Salvar Alterações'}
              </button>
            </div>
            
            <div style={{ marginTop: '20px', padding: '12px', background: '#1A1A1A', borderRadius: '12px', fontSize: '12px', color: '#888', textAlign: 'center' }}>
              💡 <strong>Dica:</strong> Você pode editar qualquer campo a qualquer momento. 
              O login será criado/atualizado automaticamente quando email e senha forem fornecidos.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Menu Items - APENAS Histórico e Escala/Folga ativos
const menuItems = [
  { id: 'historico', title: "Histórico de Viagens", icon: "🛣️", desc: "Todas as viagens realizadas", color: "#FFD700", bgColor: "#1A1A1A" },
  { id: 'escala', title: "Escala / Folga", icon: "🗓️", desc: "Gerenciar dias de descanso", color: "#FFD700", bgColor: "#1A1A1A" },
];

// ==================== ESTILOS TEMA PRETO/DOURADO ====================
const containerStyle: React.CSSProperties = { minHeight: '100vh', background: '#000', padding: '30px 20px' };
const voltarBtn: React.CSSProperties = { padding: '10px 20px', background: '#1A1A1A', border: '1px solid #333', borderRadius: '12px', cursor: 'pointer', marginBottom: '20px', fontWeight: 600, color: '#FFD700' };
const headerStyle: React.CSSProperties = { display: 'flex', gap: '40px', background: '#0A0A0A', padding: '40px', borderRadius: '24px', boxShadow: '0 15px 40px rgba(0,0,0.5)', maxWidth: '1200px', margin: '0 auto 40px', border: '1px solid #1A1A1A' };
const fotoWrapper: React.CSSProperties = { position: 'relative', width: '160px', height: '160px' };
const fotoStyle: React.CSSProperties = { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '5px solid #FFD700' };
const initialsStyle: React.CSSProperties = { ...fotoStyle, background: '#FFD700', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', color: '#000', fontWeight: 'bold' };
const moppBadge: React.CSSProperties = { position: 'absolute', bottom: '0', right: '0', background: '#FFD700', color: '#000', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700 };
const infoSection: React.CSSProperties = { flex: 1 };
const nomeTitle: React.CSSProperties = { fontSize: '34px', fontWeight: '700', margin: '0 0 8px 0', color: '#FFF' };
const cpfText: React.CSSProperties = { fontSize: '16px', color: '#888', margin: '0 0 20px 0' };
const detailsGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', fontSize: '15px', color: '#AAA' };
const editMainButton: React.CSSProperties = { padding: '10px 20px', background: '#FFD700', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: 700, color: '#000', transition: 'all 0.2s' };
const menuTitle: React.CSSProperties = { textAlign: 'center', fontSize: '28px', fontWeight: 800, color: '#FFF', marginBottom: '30px' };
const cardsGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px', maxWidth: '1200px', margin: '0 auto' };
const menuCardStyle: React.CSSProperties = { background: '#0A0A0A', padding: '30px', borderRadius: '24px', cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid #1A1A1A' };
const iconCircle: React.CSSProperties = { width: '90px', height: '90px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', backgroundColor: '#1A1A1A' };
const cardTitle: React.CSSProperties = { fontSize: '20px', fontWeight: 700, margin: '0 0 10px 0', color: '#FFF' };
const cardDesc: React.CSSProperties = { fontSize: '14px', color: '#666', margin: 0, lineHeight: '1.5' };
const loadingStyle: React.CSSProperties = { textAlign: 'center', padding: '100px', fontSize: '18px', color: '#888' };
const errorStyle: React.CSSProperties = { textAlign: 'center', padding: '100px', fontSize: '18px', color: '#EF4444' };
const modalOverlay: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContent: React.CSSProperties = { background: '#0A0A0A', padding: '40px', borderRadius: '28px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #FFD700' };
const labelStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: '#AAA', marginBottom: '5px', display: 'block' };
const inputField: React.CSSProperties = { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #333', marginTop: '5px', fontSize: '15px', outline: 'none', backgroundColor: '#1A1A1A', color: '#FFF' };
const formSectionTitle: React.CSSProperties = { fontSize: '16px', fontWeight: 800, color: '#FFF', margin: '25px 0 15px 0', paddingBottom: '8px', borderBottom: '2px solid #FFD700' };
const formGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
const modalActions: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '40px' };
const cancelBtn: React.CSSProperties = { padding: '12px 24px', borderRadius: '12px', border: '1px solid #333', background: '#1A1A1A', cursor: 'pointer', fontWeight: 600, color: '#888' };
const saveBtn: React.CSSProperties = { padding: '12px 32px', borderRadius: '12px', border: 'none', background: '#FFD700', color: '#000', cursor: 'pointer', fontWeight: 700 };

export default MenuMotorista;