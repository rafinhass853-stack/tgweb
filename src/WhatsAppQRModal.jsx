import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';
import io from 'socket.io-client';

const WhatsAppQRModal = ({ isOpen, onClose, onConnected }) => {
  const [qrCode, setQrCode] = useState(null);
  const [status, setStatus] = useState('Conectando ao servidor...');
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    // Conectar ao Socket.IO do backend
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket', 'polling']
    });

    setSocket(newSocket);

    // Verificar status atual ao conectar
    const checkStatus = async () => {
      try {
        const response = await fetch('http://localhost:3001/whatsapp/status');
        const data = await response.json();
        
        if (data.ready) {
          setStatus('WhatsApp já está conectado!');
          setIsConnected(true);
          setTimeout(() => {
            onClose();
            if (onConnected) onConnected();
          }, 1500);
        } else if (data.qrCode) {
          setQrCode(data.qrCode);
          setStatus('Escaneie o QR Code com seu WhatsApp');
        } else {
          setStatus('Aguardando QR Code...');
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
        setStatus('Erro ao conectar ao servidor. Certifique-se que o backend está rodando.');
      }
    };

    checkStatus();

    // Socket events
    newSocket.on('whatsapp_qr', (qr) => {
      console.log('QR Code recebido via socket');
      setQrCode(qr);
      setStatus('Escaneie o QR Code com seu WhatsApp');
      setIsConnected(false);
    });

    newSocket.on('whatsapp_ready', () => {
      console.log('WhatsApp pronto via socket');
      setStatus('Conectado com sucesso!');
      setIsConnected(true);
      setTimeout(() => {
        onClose();
        if (onConnected) onConnected();
      }, 1500);
    });

    newSocket.on('whatsapp_disconnected', (data) => {
      console.log('WhatsApp desconectado:', data);
      setStatus('WhatsApp desconectado. Aguardando reconexão...');
      setQrCode(null);
      setIsConnected(false);
    });

    newSocket.on('whatsapp_auth_failure', (data) => {
      console.error('Falha na autenticação:', data);
      setStatus('Falha na autenticação. Tente novamente.');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Erro de conexão com socket:', error);
      setStatus('Erro de conexão com o servidor. Verifique se o backend está rodando.');
    });

    // Interval para verificar status periodicamente
    const statusInterval = setInterval(checkStatus, 5000);

    return () => {
      clearInterval(statusInterval);
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [isOpen, onClose, onConnected]);

  const handleReconnect = async () => {
    setStatus('Tentando reconectar...');
    setQrCode(null);
    
    try {
      const response = await fetch('http://localhost:3001/whatsapp/reconnect', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        setStatus('Reconexão iniciada. Aguarde o QR Code...');
      } else {
        setStatus('Erro ao reconectar. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao reconectar:', error);
      setStatus('Erro ao reconectar. Verifique o servidor.');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#FFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📱</span> Conectar WhatsApp
          </h2>
          <button style={closeButtonStyle} onClick={onClose}>✕</button>
        </div>
        
        <div style={modalBodyStyle}>
          {/* Status */}
          <div style={{
            backgroundColor: isConnected ? 'rgba(34,197,94,0.1)' : 'rgba(255,215,0,0.1)',
            border: `1px solid ${isConnected ? '#22C55E' : '#FFD700'}`,
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <p style={{ 
              color: isConnected ? '#22C55E' : '#FFD700', 
              margin: 0,
              fontSize: '14px',
              fontWeight: 600
            }}>
              {isConnected ? '✅ ' : '🔄 '}{status}
            </p>
          </div>

          {/* QR Code */}
          {qrCode && !isConnected && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                backgroundColor: '#FFF',
                padding: '20px',
                borderRadius: '16px',
                display: 'inline-block'
              }}>
                <QRCode value={qrCode} size={250} />
              </div>
              
              <div style={{
                marginTop: '24px',
                padding: '16px',
                backgroundColor: '#1A1A1A',
                borderRadius: '12px',
                textAlign: 'left'
              }}>
                <p style={{ color: '#FFD700', margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>
                  📌 Como conectar:
                </p>
                <ol style={{ color: '#AAA', fontSize: '13px', margin: 0, paddingLeft: '20px' }}>
                  <li>Abra o WhatsApp no seu celular</li>
                  <li>Toque nos três pontos ⋮ (Android) ou Configurações (iPhone)</li>
                  <li>Selecione "WhatsApp Web/Desktop"</li>
                  <li>Aponte a câmera para o QR Code acima</li>
                </ol>
              </div>
            </div>
          )}

          {/* Loading */}
          {!qrCode && !isConnected && status !== 'WhatsApp já está conectado!' && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid #1A1A1A',
                borderTop: '3px solid #FFD700',
                borderRadius: '50%',
                margin: '0 auto 16px auto',
                animation: 'spin 1s linear infinite'
              }} />
              <p style={{ color: '#666', margin: 0 }}>
                {status}
              </p>
            </div>
          )}

          {/* Já conectado */}
          {isConnected && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '16px'
              }}>
                ✅
              </div>
              <p style={{ color: '#22C55E', margin: 0 }}>
                WhatsApp conectado com sucesso!
              </p>
              <p style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
                O modal será fechado automaticamente...
              </p>
            </div>
          )}

          {/* Botão de reconexão */}
          {!isConnected && !qrCode && status !== 'WhatsApp já está conectado!' && (
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <button
                onClick={handleReconnect}
                style={{
                  backgroundColor: '#3B82F6',
                  color: '#FFF',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px'
                }}
              >
                🔄 Tentar Reconectar
              </button>
            </div>
          )}

          {/* Aviso de servidor offline */}
          {status.includes('Erro') && status.includes('servidor') && (
            <div style={{
              marginTop: '20px',
              padding: '12px',
              backgroundColor: 'rgba(239,68,68,0.1)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#EF4444', fontSize: '12px', margin: 0 }}>
                ⚠️ Certifique-se que o servidor backend está rodando em http://localhost:3001
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.95)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999
};

const modalContentStyle = {
  backgroundColor: '#0A0A0A',
  borderRadius: '24px',
  padding: '0',
  maxWidth: '500px',
  width: '90%',
  border: '1px solid #FFD700',
  maxHeight: '90vh',
  overflowY: 'auto'
};

const modalHeaderStyle = {
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

const modalBodyStyle = {
  padding: '30px'
};

const closeButtonStyle = {
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

export default WhatsAppQRModal;