import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';

const CadastroMotorista = () => {
  const [form, setForm] = useState({
    nome: '',
    cpf: '',
    whatsapp: '',
    cidade: '',
    cnhCategoria: '',
    temMopp: 'Não'
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .slice(0, 14);
  };

  const formatWhatsApp = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.cpf) {
      alert("Nome e CPF são obrigatórios!");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'motoristas'), {
        nome: form.nome,
        cpf: form.cpf,
        whatsapp: form.whatsapp,
        cidade: form.cidade,
        cnhCategoria: form.cnhCategoria,
        temMopp: form.temMopp,
        createdAt: new Date().toISOString()
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);

      // Limpar formulário
      setForm({
        nome: '', cpf: '', whatsapp: '', cidade: '',
        cnhCategoria: '', temMopp: 'Não'
      });
    } catch (error) {
      console.error(error);
      alert("Erro ao cadastrar motorista. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>🚛 Cadastro de Motorista</h1>
        <p style={subtitleStyle}>Adicione um novo motorista à sua frota</p>
      </div>

      {success && (
        <div style={successToastStyle}>
          ✅ Motorista cadastrado com sucesso!
        </div>
      )}

      <div style={formCardStyle}>
        <form onSubmit={handleSubmit}>
          <div style={twoColumnGrid}>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Nome Completo <span style={required}>*</span></label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                style={inputStyle}
                placeholder="Ex: João Silva Santos"
                required
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>CPF <span style={required}>*</span></label>
              <input
                type="text"
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: formatCPF(e.target.value) })}
                placeholder="000.000.000-00"
                style={inputStyle}
                required
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>WhatsApp</label>
              <input
                type="text"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: formatWhatsApp(e.target.value) })}
                placeholder="(11) 98765-4321"
                style={inputStyle}
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Cidade</label>
              <input
                type="text"
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                placeholder="Ex: Araraquara - SP"
                style={inputStyle}
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Categoria CNH</label>
              <input
                type="text"
                value={form.cnhCategoria}
                onChange={(e) => setForm({ ...form, cnhCategoria: e.target.value.toUpperCase() })}
                placeholder="A, B, C, D ou E"
                style={inputStyle}
                maxLength={2}
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Possui MOPP?</label>
              <select 
                value={form.temMopp} 
                onChange={(e) => setForm({ ...form, temMopp: e.target.value })} 
                style={selectStyle}
              >
                <option value="Não">❌ Não possui</option>
                <option value="Sim">✅ Possui MOPP</option>
              </select>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            style={loading ? disabledButton : submitButton}
          >
            {loading ? 'Cadastrando Motorista...' : 'Cadastrar Motorista'}
          </button>
        </form>
      </div>
    </div>
  );
};

/* ==================== ESTILOS ==================== */
const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  padding: '40px 20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center'
};

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '40px'
};

const titleStyle: React.CSSProperties = {
  fontSize: '34px',
  fontWeight: '700',
  color: '#1e2937',
  marginBottom: '8px'
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '17px',
  color: '#64748b'
};

const formCardStyle: React.CSSProperties = {
  background: 'white',
  padding: '50px 45px',
  borderRadius: '24px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
  maxWidth: '820px',
  width: '100%'
};

const twoColumnGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '26px',
  marginBottom: '20px'
};

const inputGroupStyle: React.CSSProperties = { marginBottom: '26px' };

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  fontWeight: '600',
  color: '#374151',
  fontSize: '15px'
};

const required: React.CSSProperties = { color: '#ef4444' };

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 18px',
  border: '2px solid #e2e8f0',
  borderRadius: '12px',
  fontSize: '16px',
  transition: 'all 0.3s'
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer', backgroundColor: 'white' };

const submitButton: React.CSSProperties = {
  width: '100%',
  padding: '16px',
  background: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '14px',
  fontSize: '17px',
  fontWeight: '600',
  cursor: 'pointer',
  marginTop: '20px',
  transition: 'all 0.3s ease'
};

const disabledButton: React.CSSProperties = {
  ...submitButton,
  background: '#9ca3af',
  cursor: 'not-allowed'
};

const successToastStyle: React.CSSProperties = {
  position: 'fixed',
  top: '30px',
  right: '30px',
  background: '#10b981',
  color: 'white',
  padding: '16px 28px',
  borderRadius: '14px',
  fontWeight: '600',
  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  zIndex: 2000
};

// Animações globais
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    input:focus, select:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
    }
    button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 12px 25px rgba(59, 130, 246, 0.35);
    }
  `;
  document.head.appendChild(style);
}

export default CadastroMotorista;