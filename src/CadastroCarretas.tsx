import React, { useState } from 'react';
import { db } from './firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

const CadastroCarretas = () => {
  const [form, setForm] = useState({
    placa: '',
    tipo: 'Sider',
    qtdPaletes: '',
    observacao: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [success, setSuccess] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!form.placa) {
      newErrors.placa = 'Placa é obrigatória';
    } else if (form.placa.length < 7) {
      newErrors.placa = 'Placa inválida';
    }
    
    if (!form.qtdPaletes) {
      newErrors.qtdPaletes = 'Quantidade de paletes é obrigatória';
    } else if (parseInt(form.qtdPaletes) <= 0) {
      newErrors.qtdPaletes = 'Quantidade deve ser maior que zero';
    } else if (parseInt(form.qtdPaletes) > 100) {
      newErrors.qtdPaletes = 'Quantidade máxima é 100 paletes';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatPlaca = (value: string) => {
    let v = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (v.length > 7) v = v.slice(0, 7);
    
    // Formato antigo: ABC-1234
    if (v.length > 3 && v.length <= 7) {
      v = v.slice(0, 3) + '-' + v.slice(3);
    }
    
    // Formato Mercosul: ABC1D23
    if (v.length === 7 && !v.includes('-')) {
      v = v.slice(0, 3) + '-' + v.slice(3);
    }
    
    return v;
  };

  const validatePlacaFormat = (placa: string) => {
    const placaSemTraco = placa.replace('-', '');
    // Formato antigo: ABC1234
    const oldFormat = /^[A-Z]{3}[0-9]{4}$/.test(placaSemTraco);
    // Formato Mercosul: ABC1D23
    const mercosulFormat = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(placaSemTraco);
    
    return oldFormat || mercosulFormat;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showNotification('Por favor, corrija os erros no formulário', 'error');
      return;
    }

    if (!validatePlacaFormat(form.placa)) {
      setErrors({ ...errors, placa: 'Formato de placa inválido (ABC-1234 ou ABC1D23)' });
      showNotification('Formato de placa inválido', 'error');
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, 'carretas'), where('placa', '==', form.placa));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        setErrors({ ...errors, placa: 'Esta placa já está cadastrada' });
        showNotification('Esta placa já está cadastrada no sistema', 'error');
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'carretas'), {
        placa: form.placa,
        tipo: form.tipo,
        qtdPaletes: parseInt(form.qtdPaletes),
        observacao: form.observacao || '',
        motoristaId: null,
        motoristaNome: null,
        createdAt: new Date().toISOString()
      });

      setSuccess(true);
      showNotification('✅ Carreta cadastrada com sucesso!', 'success');
      
      // Limpar formulário
      setForm({ placa: '', tipo: 'Sider', qtdPaletes: '', observacao: '' });
      setErrors({});
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error(error);
      showNotification('Erro ao cadastrar carreta. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 14px 24px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      border-radius: 12px;
      font-weight: 600;
      z-index: 1000;
      animation: slideIn 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  };

  const getTipoIcon = () => {
    switch(form.tipo) {
      case 'Sider': return '🚛';
      case 'Baú': return '📦';
      default: return '🚚';
    }
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>🚛 Cadastro de Carretas</h1>
        <p style={subtitleStyle}>Gerencie as carretas da sua frota</p>
      </div>

      {success && (
        <div style={successToastStyle}>
          ✅ Carreta cadastrada com sucesso!
        </div>
      )}

      <form onSubmit={handleSubmit} style={formCardStyle}>
        <div style={formGridStyle}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>
              Placa da Carreta <span style={requiredStar}>*</span>
            </label>
            <div style={inputWrapperStyle}>
              <input
                type="text"
                value={form.placa}
                onChange={(e) => {
                  setForm({ ...form, placa: formatPlaca(e.target.value) });
                  if (errors.placa) setErrors({ ...errors, placa: '' });
                }}
                onFocus={() => setFocusedField('placa')}
                onBlur={() => setFocusedField(null)}
                placeholder="ABC-1234 ou ABC1D23"
                maxLength={8}
                style={{
                  ...inputStyle,
                  borderColor: errors.placa ? '#ef4444' : (focusedField === 'placa' ? '#3b82f6' : '#e2e8f0'),
                  boxShadow: focusedField === 'placa' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                }}
                required
              />
              {form.placa && !errors.placa && validatePlacaFormat(form.placa) && (
                <span style={inputIconStyle}>✅</span>
              )}
            </div>
            {errors.placa && <span style={errorTextStyle}>{errors.placa}</span>}
            <p style={helperTextStyle}>Formatos aceitos: ABC-1234 (antigo) ou ABC1D23 (Mercosul)</p>
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>
              Tipo de Carreta
            </label>
            <div style={selectWrapperStyle}>
              <span style={selectIconStyle}>{getTipoIcon()}</span>
              <select 
                value={form.tipo} 
                onChange={(e) => setForm({ ...form, tipo: e.target.value })} 
                style={selectStyle}
              >
                <option value="Sider">🚛 Sider</option>
                <option value="Baú">📦 Baú</option>
              </select>
            </div>
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>
              Quantidade de Paletes <span style={requiredStar}>*</span>
            </label>
            <div style={inputWrapperStyle}>
              <input
                type="number"
                value={form.qtdPaletes}
                onChange={(e) => {
                  setForm({ ...form, qtdPaletes: e.target.value });
                  if (errors.qtdPaletes) setErrors({ ...errors, qtdPaletes: '' });
                }}
                onFocus={() => setFocusedField('qtdPaletes')}
                onBlur={() => setFocusedField(null)}
                placeholder="Ex: 28"
                min="1"
                max="100"
                style={{
                  ...inputStyle,
                  borderColor: errors.qtdPaletes ? '#ef4444' : (focusedField === 'qtdPaletes' ? '#3b82f6' : '#e2e8f0'),
                  boxShadow: focusedField === 'qtdPaletes' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                }}
                required
              />
            </div>
            {errors.qtdPaletes && <span style={errorTextStyle}>{errors.qtdPaletes}</span>}
            <p style={helperTextStyle}>Capacidade máxima de 100 paletes</p>
          </div>

          <div style={inputGroupFullStyle}>
            <label style={labelStyle}>
              Observação (opcional)
            </label>
            <textarea
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              placeholder="Observações sobre a carreta (ex: estado de conservação, últimas manutenções, etc.)"
              style={textareaStyle}
              rows={4}
            />
            <p style={helperTextStyle}>
              {form.observacao.length}/500 caracteres
            </p>
          </div>
        </div>

        <div style={infoCardStyle}>
          <span style={infoIconStyle}>ℹ️</span>
          <div>
            <strong>Informações importantes:</strong>
            <p style={infoTextStyle}>
              Após o cadastro, a carreta poderá ser associada a um motorista. 
              Certifique-se de que todos os dados estão corretos antes de salvar.
            </p>
          </div>
        </div>

        <button type="submit" disabled={loading} style={loading ? buttonDisabledStyle : buttonStyle}>
          {loading ? (
            <>
              <span style={spinnerStyle}></span>
              Cadastrando Carreta...
            </>
          ) : (
            <>
              🚛 Cadastrar Carreta
            </>
          )}
        </button>
      </form>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ==================== ESTILOS MODERNOS ====================
const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
  padding: '40px 24px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center'
};

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '30px',
  width: '100%',
  maxWidth: '700px'
};

const titleStyle: React.CSSProperties = {
  fontSize: '32px',
  fontWeight: '700',
  color: '#1e2937',
  marginBottom: '8px'
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '16px',
  color: '#64748b'
};

const successToastStyle: React.CSSProperties = {
  position: 'fixed',
  top: '20px',
  right: '20px',
  backgroundColor: '#10b981',
  color: 'white',
  padding: '12px 24px',
  borderRadius: '12px',
  fontWeight: '600',
  zIndex: 1000,
  animation: 'slideIn 0.3s ease',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
};

const formCardStyle: React.CSSProperties = {
  background: 'white',
  padding: '40px',
  borderRadius: '24px',
  boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
  width: '100%',
  maxWidth: '700px',
  transition: 'transform 0.3s ease'
};

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '20px',
  marginBottom: '20px'
};

const inputGroupStyle: React.CSSProperties = {
  marginBottom: '0'
};

const inputGroupFullStyle: React.CSSProperties = {
  gridColumn: '1 / -1',
  marginBottom: '0'
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  fontWeight: '600',
  color: '#374151',
  fontSize: '14px'
};

const requiredStar: React.CSSProperties = {
  color: '#ef4444'
};

const inputWrapperStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  border: '2px solid #e2e8f0',
  borderRadius: '12px',
  fontSize: '14px',
  transition: 'all 0.3s ease',
  outline: 'none',
  fontFamily: 'inherit'
};

const inputIconStyle: React.CSSProperties = {
  position: 'absolute',
  right: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: '16px'
};

const selectWrapperStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%'
};

const selectIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: '16px',
  zIndex: 1,
  pointerEvents: 'none'
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px 12px 40px',
  border: '2px solid #e2e8f0',
  borderRadius: '12px',
  fontSize: '14px',
  backgroundColor: 'white',
  cursor: 'pointer',
  outline: 'none',
  transition: 'all 0.3s ease',
  fontFamily: 'inherit'
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  border: '2px solid #e2e8f0',
  borderRadius: '12px',
  fontSize: '14px',
  fontFamily: 'inherit',
  resize: 'vertical',
  transition: 'all 0.3s ease',
  outline: 'none'
};

const errorTextStyle: React.CSSProperties = {
  color: '#ef4444',
  fontSize: '12px',
  marginTop: '4px',
  display: 'block'
};

const helperTextStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '11px',
  marginTop: '4px'
};

const infoCardStyle: React.CSSProperties = {
  background: '#f0f9ff',
  borderLeft: '4px solid #3b82f6',
  padding: '16px',
  borderRadius: '12px',
  marginBottom: '24px',
  display: 'flex',
  gap: '12px',
  alignItems: 'flex-start'
};

const infoIconStyle: React.CSSProperties = {
  fontSize: '20px'
};

const infoTextStyle: React.CSSProperties = {
  margin: '4px 0 0 0',
  fontSize: '13px',
  color: '#475569',
  lineHeight: '1.5'
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '12px',
  fontSize: '16px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px'
};

const buttonDisabledStyle: React.CSSProperties = {
  ...buttonStyle,
  opacity: 0.7,
  cursor: 'not-allowed'
};

const spinnerStyle: React.CSSProperties = {
  display: 'inline-block',
  width: '16px',
  height: '16px',
  border: '2px solid white',
  borderTop: '2px solid transparent',
  borderRadius: '50%',
  animation: 'spin 0.6s linear infinite'
};

export default CadastroCarretas;