import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
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

  const handleSaveEdit = async () => {
    if (!editForm || !motorista) return;

    try {
      const motoristaRef = doc(db, 'motoristas', motorista.id);
      
      const updatedData = {
        nome: editForm.nome,
        cpf: editForm.cpf,
        whatsapp: editForm.whatsapp || '',
        cidade: editForm.cidade || '',
        cnhCategoria: editForm.cnhCategoria || '',
        temMopp: editForm.temMopp || 'Não',
      };

      await updateDoc(motoristaRef, updatedData);
      
      setMotorista({ ...motorista, ...updatedData, id: motorista.id });
      setShowEditModal(false);
      alert('✅ Dados atualizados com sucesso!');

    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('❌ Erro ao salvar alterações');
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
          <div style={initialsStyle}>{motorista.nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div>
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

      {/* MODAL DE EDIÇÃO - SEM EMAIL, SENHA E FOTOS */}
      {showEditModal && editForm && (
        <div style={modalOverlay} onClick={() => setShowEditModal(false)}>
          <div style={modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#FFF' }}>Editar Motorista</h2>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#888' }}>×</button>
            </div>

            <div style={formSectionTitle}>📋 Dados Pessoais</div>
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

            <div style={modalActions}>
              <button onClick={() => setShowEditModal(false)} style={cancelBtn}>Cancelar</button>
              <button onClick={handleSaveEdit} style={saveBtn}>💾 Salvar Alterações</button>
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
const initialsStyle: React.CSSProperties = { width: '100%', height: '100%', borderRadius: '50%', background: '#FFD700', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', color: '#000', fontWeight: 'bold' };
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