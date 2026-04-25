import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email.includes('@') || !email.includes('.')) {
      setError('Por favor, insira um email válido');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const idTokenResult = await user.getIdTokenResult(true);
      const role = idTokenResult.claims.role as string | undefined;

      if (role === 'gestor') {
        if (rememberMe) localStorage.setItem('rememberedEmail', email);
        else localStorage.removeItem('rememberedEmail');

        showNotification('✅ Login realizado com sucesso! Redirecionando...', 'success');
        setTimeout(() => window.location.href = '/dashboard', 1500);
      } else if (role === 'motorista') {
        setError('⚠️ Este é o Painel do Gestor. Use o App Mobile para motoristas.');
        await auth.signOut();
      } else {
        setError('⚠️ Usuário sem permissão definida. Contate o administrador.');
        await auth.signOut();
      }
    } catch (err: any) {
      console.error(err);
      setError('❌ Email ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; padding: 14px 24px;
      background: ${type === 'success' ? '#22C55E' : '#EF4444'}; color: #000;
      border-radius: 12px; font-weight: 700; z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0.3);
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  };

  return (
    <div style={containerStyle}>
      <div style={mainWrapperStyle}>
        {/* Lado Esquerdo - Formulário */}
        <div style={loginSideStyle}>
          <div style={cardStyle}>
            <div style={logoContainerStyle}>
              <img src="/tg-logo.png" alt="TG Logística" style={logoImageStyle} />
              <h1 style={logoTitleStyle}>TG Logística</h1>
              <p style={subtitleStyle}>Painel do Gestor de Frotas</p>
            </div>

            <form onSubmit={handleLogin} style={formStyle}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  placeholder="seuemail@tglogistica.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    ...inputStyle,
                    borderColor: focusedField === 'email' ? '#FFD700' : '#333',
                    boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(255, 215, 0, 0.2)' : 'none'
                  }}
                  required
                />
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Senha</label>
                <div style={inputWrapperStyle}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    style={{
                      ...inputStyle,
                      borderColor: focusedField === 'password' ? '#FFD700' : '#333',
                      boxShadow: focusedField === 'password' ? '0 0 3px rgba(255, 215, 0, 0.2)' : 'none'
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={togglePasswordStyle}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div style={optionsStyle}>
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={checkboxStyle}
                  />
                  Lembrar-me
                </label>
                <a href="#" style={forgotPasswordStyle}>Esqueceu a senha?</a>
              </div>

              {error && <div style={errorContainerStyle}>{error}</div>}

              <button
                type="submit"
                style={loading ? buttonDisabledStyle : buttonStyle}
                disabled={loading}
              >
                {loading ? 'Entrando...' : 'ENTRAR NO PAINEL'}
              </button>

              <div style={footerStyle}>
                Sistema seguro • Acesso restrito à gestão
              </div>
            </form>
          </div>
        </div>

        {/* Lado Direito - Imagem */}
        <div style={imageSideStyle}>
          <img
            src="/tg-estrada.png"
            alt="Frota TG Logística"
            style={heroImageStyle}
          />
          <div style={imageOverlayStyle}>
            <h2 style={imageTitleStyle}>SUA CARGA EM BOAS MÃOS!</h2>
            <p style={imageSubtitleStyle}>
              Transporte com confiança e eficiência<br />
              Soluções logísticas inteligentes para sua empresa
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ====================== ESTILOS ATUALIZADOS - TEMA PRETO/DOURADO ======================
const containerStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  fontFamily: "'Segoe UI', 'Inter', system-ui, sans-serif",
  margin: 0,
  padding: 0,
  boxSizing: 'border-box',
  background: '#000'
};

const mainWrapperStyle: React.CSSProperties = {
  display: 'flex',
  width: '100%',
  height: '100%',
  margin: 0,
  padding: 0
};

const loginSideStyle: React.CSSProperties = {
  flex: '1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 30px',
  background: '#000',
  overflow: 'hidden',
  height: '100%'
};

const imageSideStyle: React.CSSProperties = {
  flex: '1.35',
  position: 'relative',
  overflow: 'hidden',
  background: '#000',
  height: '100%'
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '420px',
  background: '#0A0A0A',
  padding: '48px 40px',
  borderRadius: '20px',
  boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
  border: '1px solid #1A1A',
  boxSizing: 'border-box'
};

const logoContainerStyle: React.CSSProperties = { marginBottom: '36px', textAlign: 'center' };
const logoImageStyle: React.CSSProperties = { width: '170px', height: 'auto', marginBottom: '16px' };

const logoTitleStyle: React.CSSProperties = {
  fontSize: '31px',
  fontWeight: '900',
  color: '#FFD700',
  marginBottom: '6px',
  letterSpacing: '-1px'
};

const subtitleStyle: React.CSSProperties = { fontSize: '15px', color: '#666' };

const formStyle: React.CSSProperties = { width: '100%' };
const inputGroupStyle: React.CSSProperties = { marginBottom: '22px' };

const labelStyle: React.CSSProperties = {
  fontSize: '14.5px',
  fontWeight: '600',
  color: '#AAA',
  marginBottom: '8px',
  display: 'block'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  fontSize: '16px',
  border: '2px solid #333',
  borderRadius: '10px',
  outline: 'none',
  transition: 'all 0.3s ease',
  boxSizing: 'border-box',
  background: '#1A1A1A',
  color: '#FFF'
};

const inputWrapperStyle: React.CSSProperties = { position: 'relative' };

const togglePasswordStyle: React.CSSProperties = {
  position: 'absolute',
  right: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  fontSize: '20px',
  cursor: 'pointer',
  color: '#888'
};

const optionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '28px',
  fontSize: '14px'
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  cursor: 'pointer',
  color: '#AAA'
};

const checkboxStyle: React.CSSProperties = {
  width: '18px',
  height: '18px',
  accentColor: '#FFD700'
};

const forgotPasswordStyle: React.CSSProperties = {
  color: '#FFD700',
  textDecoration: 'none',
  fontWeight: '600'
};

const errorContainerStyle: React.CSSProperties = {
  background: '#3F1D1D',
  color: '#EF4444',
  padding: '12px 16px',
  borderRadius: '8px',
  marginBottom: '20px',
  fontSize: '14px',
  border: '1px solid #7F1D1D'
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '15px',
  fontSize: '16px',
  fontWeight: '700',
  background: '#FFD700',
  color: '#000',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  marginTop: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  transition: 'all 0.2s ease'
};

const buttonDisabledStyle: React.CSSProperties = { ...buttonStyle, opacity: 0.5, cursor: 'not-allowed' };

const footerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginTop: '24px',
  color: '#555',
  fontSize: '13px'
};

const heroImageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center',
  display: 'block',
  filter: 'brightness(0.6)'
};

const imageOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.95))',
  padding: '90px 50px 60px',
  color: 'white'
};

const imageTitleStyle: React.CSSProperties = {
  fontSize: '36px',
  fontWeight: '900',
  lineHeight: '1.1',
  marginBottom: '12px',
  color: '#FFD700'
};

const imageSubtitleStyle: React.CSSProperties = {
  fontSize: '17px',
  opacity: 0.9,
  color: '#CCC'
};

export default Login;