import React, { useState } from 'react';
import { db } from './firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

const CadastroVeiculo = () => {
  const [form, setForm] = useState({
    placa: '',
    tipo: 'toco',
    capacidade: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [success, setSuccess] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const validateForm = async () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!form.placa) {
      newErrors.placa = 'Placa é obrigatória';
    } else if (form.placa.length < 8) {
      newErrors.placa = 'Placa inválida';
    } else if (!validatePlacaFormat(form.placa)) {
      newErrors.placa = 'Formato de placa inválido (ABC-1234 ou ABC1D23)';
    }
    
    if (form.tipo === 'truck' && !form.capacidade) {
      newErrors.capacidade = 'Capacidade de paletes é obrigatória para Truck';
    } else if (form.tipo === 'truck' && (parseInt(form.capacidade) <= 0 || parseInt(form.capacidade) > 100)) {
      newErrors.capacidade = 'Capacidade deve ser entre 1 e 100 paletes';
    }
    
    // Verificar duplicidade de placa
    if (form.placa && !newErrors.placa) {
      const q = query(collection(db, 'veiculos'), where('placa', '==', form.placa));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        newErrors.placa = 'Esta placa já está cadastrada';
      }
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
    
    const isValid = await validateForm();
    if (!isValid) {
      showNotification('Por favor, corrija os erros no formulário', 'error');
      return;
    }

    setLoading(true);
    try {
      const dadosVeiculo: any = {
        placa: form.placa,
        tipo: form.tipo,
        createdAt: new Date().toISOString(),
        status: 'disponivel'
      };

      if (form.tipo === 'truck') {
        dadosVeiculo.capacidade = parseInt(form.capacidade);
      }

      await addDoc(collection(db, 'veiculos'), dadosVeiculo);

      setSuccess(true);
      showNotification('✅ Veículo cadastrado com sucesso!', 'success');
      
      setForm({ placa: '', tipo: 'toco', capacidade: '' });
      setErrors({});
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error(error);
      showNotification('❌ Erro ao cadastrar veículo. Tente novamente.', 'error');
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
      case 'toco': return '🚚';
      case 'trucado': return '🚛';
      case 'truck': return '🚛⚡';
      default: return '🚗';
    }
  };

  const getTipoDescricao = () => {
    switch(form.tipo) {
      case 'toco': return '2 eixos';
      case 'trucado': return '3 eixos';
      case 'truck': return 'Cavalo + Carreta';
      default: return '';
    }
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>🚛 Cadastro de Veículo</h1>
        <p style={subtitleStyle}>Gerencie os veículos da sua frota</p>
      </div>

      {success && (
        <div style={successToastStyle}>
          ✅ Veículo cadastrado com sucesso!
        </div>
      )}

      <form onSubmit={handleSubmit} style={formCardStyle}>
        <div style={formGridStyle}>
          <div style={inputGroupFullStyle}>
            <label style={labelStyle}>
              Placa do Veículo <span style={requiredStar}>*</span>
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

          <div style={inputGroupFullStyle}>
            <label style={labelStyle}>
              Tipo de Veículo <span style={requiredStar}>*</span>
            </label>
            <div style={selectWrapperStyle}>
              <span style={selectIconStyle}>{getTipoIcon()}</span>
              <select 
                value={form.tipo} 
                onChange={(e) => {
                  setForm({ ...form, tipo: e.target.value, capacidade: '' });
                  if (errors.capacidade) setErrors({ ...errors, capacidade: '' });
                }} 
                style={selectStyle}
              >
                <option value="toco">🚚 Toco - {getTipoDescricao()}</option>
                <option value="trucado">🚛 Trucado - {getTipoDescricao()}</option>
                <option value="truck">🚛⚡ Truck - {getTipoDescricao()}</option>
              </select>
            </div>
            <p style={helperTextStyle}>
              {form.tipo === 'toco' && 'Veículo com 2 eixos, ideal para cargas menores'}
              {form.tipo === 'trucado' && 'Veículo com 3 eixos, maior capacidade de carga'}
              {form.tipo === 'truck' && 'Cavalo mecânico para tracionar carretas'}
            </p>
          </div>

          {form.tipo === 'truck' && (
            <div style={inputGroupFullStyle}>
              <label style={labelStyle}>
                Capacidade de Paletes <span style={requiredStar}>*</span>
              </label>
              <div style={inputWrapperStyle}>
                <input
                  type="number"
                  value={form.capacidade}
                  onChange={(e) => {
                    setForm({ ...form, capacidade: e.target.value });
                    if (errors.capacidade) setErrors({ ...errors, capacidade: '' });
                  }}
                  onFocus={() => setFocusedField('capacidade')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Ex: 28"
                  min="1"
                  max="100"
                  style={{
                    ...inputStyle,
                    borderColor: errors.capacidade ? '#ef4444' : (focusedField === 'capacidade' ? '#3b82f6' : '#e2e8f0'),
                    boxShadow: focusedField === 'capacidade' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                  }}
                  required={form.tipo === 'truck'}
                />
                <span style={inputUnitStyle}>paletes</span>
              </div>
              {errors.capacidade && <span style={errorTextStyle}>{errors.capacidade}</span>}
              <p style={helperTextStyle}>Capacidade máxima de 100 paletes</p>
            </div>
          )}
        </div>

        <div style={infoCardStyle}>
          <span style={infoIconStyle}>ℹ️</span>
          <div>
            <strong>Informações importantes:</strong>
            <p style={infoTextStyle}>
              Certifique-se de que todos os dados estão corretos antes de salvar. 
              A placa deve seguir o formato padrão brasileiro (antigo ou Mercosul).
            </p>
          </div>
        </div>

        <button type="submit" disabled={loading} style={loading ? buttonDisabledStyle : buttonStyle}>
          {loading ? (
            <>
              <span style={spinnerStyle}></span>
              Cadastrando Veículo...
            </>
          ) : (
            <>
              {getTipoIcon()} Cadastrar Veículo
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
  maxWidth: '600px',
  transition: 'transform 0.3s ease'
};

const formGridStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
  marginBottom: '24px'
};

const inputGroupFullStyle: React.CSSProperties = {
  width: '100%'
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

const inputUnitStyle: React.CSSProperties = {
  position: 'absolute',
  right: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: '12px',
  fontWeight: '600',
  color: '#64748b'
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

export default CadastroVeiculo;