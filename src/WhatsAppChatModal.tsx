import React, { useState } from 'react';

interface WhatsAppChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  telefone: string;
  nome: string;
  sendMessage: (telefone: string, mensagem: string) => Promise<boolean>;
  sending: boolean;
}

const WhatsAppChatModal: React.FC<WhatsAppChatModalProps> = ({ 
  isOpen, onClose, telefone, nome, sendMessage, sending 
}) => {
  const [mensagem, setMensagem] = useState('');

  const handleEnviarMensagem = async () => {
    if (!mensagem.trim()) return;
    const success = await sendMessage(telefone, mensagem);
    if (success) {
      setMensagem('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#FFF' }}>💬 WhatsApp - {nome}</h2>
          <button style={closeButtonStyle} onClick={onClose}>✕</button>
        </div>
        <div style={modalBodyStyle}>
          <div style={infoBoxStyle}>📱 Número: {telefone}</div>
          <textarea
            style={textAreaStyle}
            rows={6}
            placeholder="Digite sua mensagem aqui..."
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
          />
          <div style={buttonGroupStyle}>
            <button style={sendButtonStyle} onClick={handleEnviarMensagem} disabled={sending || !mensagem.trim()}>
              {sending ? 'Enviando...' : '📤 Enviar Mensagem'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  zIndex: 1000
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#0A0A0A',
  borderRadius: '24px',
  width: '90%',
  maxWidth: '500px',
  border: '1px solid #FFD700'
};

const modalHeaderStyle: React.CSSProperties = {
  padding: '20px 24px',
  borderBottom: '1px solid #1A1A1A',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
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
  fontSize: '18px'
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

const textAreaStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid #333',
  backgroundColor: '#111',
  color: '#FFF',
  fontSize: '14px',
  fontFamily: 'inherit',
  resize: 'vertical'
};

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginTop: '20px'
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

export default WhatsAppChatModal;