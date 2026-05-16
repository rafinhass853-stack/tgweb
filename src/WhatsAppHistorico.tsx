import React, { useState, useEffect } from 'react';

interface WhatsAppHistoricoProps {
  isOpen: boolean;
  onClose: () => void;
  telefone: string;
  nome: string;
  sendMessage?: (telefone: string, mensagem: string) => Promise<boolean>;
}

const WhatsAppHistorico: React.FC<WhatsAppHistoricoProps> = ({ 
  isOpen, 
  onClose, 
  telefone, 
  nome,
  sendMessage 
}) => {
  const [mensagem, setMensagem] = useState('');
  const [sending, setSending] = useState(false);
  const [whatsappReady, setWhatsappReady] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('http://localhost:3001/whatsapp/status');
        const data = await response.json();
        setWhatsappReady(data.ready);
      } catch (error) {
        console.error('Erro ao verificar status:', error);
        setWhatsappReady(false);
      }
    };
    
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!mensagem.trim()) {
      alert('Digite uma mensagem antes de enviar');
      return;
    }

    if (!whatsappReady) {
      alert('⚠️ WhatsApp não está conectado!\n\nPara conectar, verifique se o servidor backend está rodando e escaneie o QR Code.');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('http://localhost:3001/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone, mensagem: mensagem.trim() })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('✅ Mensagem enviada com sucesso!');
        setMensagem('');
        onClose();
      } else {
        alert('❌ Erro ao enviar mensagem: ' + (data.error || 'Tente novamente'));
      }
    } catch (error) {
      console.error('Erro ao enviar:', error);
      alert('❌ Erro ao enviar mensagem. Verifique se o servidor está rodando.');
    } finally {
      setSending(false);
    }
  };

  const handleOpenWhatsAppWeb = () => {
    // Formatar número para WhatsApp Web
    let numeroFormatado = telefone.replace(/\D/g, '');
    if (numeroFormatado.length === 11 && !numeroFormatado.startsWith('55')) {
      numeroFormatado = `55${numeroFormatado}`;
    }
    const url = `https://wa.me/${numeroFormatado}`;
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#FFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageCircle size={20} color="#25D366" />
            WhatsApp - {nome}
          </h2>
          <button style={closeButtonStyle} onClick={onClose}>✕</button>
        </div>
        
        <div style={modalBodyStyle}>
          <div style={infoBoxStyle}>
            📱 Número: {telefone}
            <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
              {whatsappReady ? '🟢 WhatsApp Conectado' : '🔴 WhatsApp Desconectado'}
            </div>
          </div>
          
          <div style={buttonGroupHorizontalStyle}>
            <button 
              style={{ ...actionButtonStyle, backgroundColor: '#25D366', color: '#FFF' }}
              onClick={handleOpenWhatsAppWeb}
            >
              <ExternalLink size={14} /> Abrir no WhatsApp Web
            </button>
          </div>
          
          <div style={dividerStyle} />
          
          <label style={formLabelStyle}>Digite sua mensagem:</label>
          <textarea
            style={textAreaStyle}
            rows={5}
            placeholder={`Olá ${nome}, tudo bem?`}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            disabled={sending}
          />
          
          <div style={buttonGroupStyle}>
            <button style={cancelButtonStyle} onClick={onClose} disabled={sending}>
              Cancelar
            </button>
            <button 
              style={{ ...sendButtonStyle, opacity: (!whatsappReady || !mensagem.trim()) ? 0.5 : 1 }}
              onClick={handleSendMessage} 
              disabled={sending || !whatsappReady || !mensagem.trim()}
            >
              {sending ? '📤 Enviando...' : '📤 Enviar Mensagem'}
            </button>
          </div>
          
          {!whatsappReady && (
            <div style={warningBoxStyle}>
              ⚠️ WhatsApp não está conectado. Use o botão "Abrir no WhatsApp Web" para conversar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Estilos
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.95)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#0A0A0A',
  borderRadius: '24px',
  width: '90%',
  maxWidth: '500px',
  border: '1px solid #FFD700',
  maxHeight: '90vh',
  overflowY: 'auto'
};

const modalHeaderStyle: React.CSSProperties = {
  padding: '20px 24px',
  borderBottom: '1px solid #1A1A1A',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  position: 'sticky',
  top: 0,
  backgroundColor: '#0A0A0A',
  zIndex: 1
};

const modalBodyStyle: React.CSSProperties = {
  padding: '24px'
};

const closeButtonStyle: React.CSSProperties = {
  background: 'rgba(239,68,68,0.2)',
  color: '#EF4444',
  border: 'none',
  borderRadius: '50%',
  width: '35px',
  height: '35px',
  cursor: 'pointer',
  fontSize: '18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const infoBoxStyle: React.CSSProperties = {
  backgroundColor: '#1A1A1A',
  padding: '12px',
  borderRadius: '12px',
  marginBottom: '16px',
  color: '#FFD700',
  fontSize: '14px',
  textAlign: 'center'
};

const dividerStyle: React.CSSProperties = {
  height: '1px',
  backgroundColor: '#1A1A1A',
  margin: '16px 0'
};

const buttonGroupHorizontalStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginBottom: '16px'
};

const formLabelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#AAA',
  marginBottom: '8px',
  display: 'block'
};

const textAreaStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid #333',
  backgroundColor: '#111',
  color: '#FFF',
  fontSize: '14px',
  fontFamily: 'inherit',
  resize: 'vertical',
  marginBottom: '16px'
};

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginTop: '8px'
};

const actionButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px',
  borderRadius: '12px',
  border: 'none',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px'
};

const cancelButtonStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: '#1A1A1A',
  color: '#AAA',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid #333',
  fontWeight: 600,
  cursor: 'pointer'
};

const sendButtonStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: '#25D366',
  color: '#FFF',
  padding: '12px',
  borderRadius: '12px',
  border: 'none',
  fontWeight: 700,
  cursor: 'pointer'
};

const warningBoxStyle: React.CSSProperties = {
  marginTop: '16px',
  padding: '12px',
  backgroundColor: 'rgba(255,215,0,0.1)',
  borderRadius: '12px',
  color: '#FFD700',
  fontSize: '12px',
  textAlign: 'center'
};

// Importar ícones
const MessageCircle = ({ size, color }: { size: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const ExternalLink = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export default WhatsAppHistorico;