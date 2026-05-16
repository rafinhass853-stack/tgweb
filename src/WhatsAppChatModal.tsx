import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

interface Mensagem {
  id: string;
  texto: string;
  enviado: boolean;
  timestamp: number;
  dataHora?: string;
  fromMe?: boolean;
}

interface WhatsAppChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  telefone: string;
  nome: string;
  sendMessage: (telefone: string, mensagem: string) => Promise<boolean>;
  sending: boolean;
}

const WhatsAppChatModal: React.FC<WhatsAppChatModalProps> = ({ 
  isOpen, 
  onClose, 
  telefone, 
  nome, 
  sendMessage, 
  sending 
}) => {
  const [mensagem, setMensagem] = useState('');
  const [historico, setHistorico] = useState<Mensagem[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [carregandoCompleto, setCarregandoCompleto] = useState(false);
  const [modoExibicao, setModoExibicao] = useState<'local' | 'completo'>('local');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const socketRef = useRef<any>(null);
  const numeroLimpo = telefone.replace(/\D/g, '');
  const numeroComparacao = numeroLimpo.length === 11 ? numeroLimpo : `55${numeroLimpo}`;

  // Carregar histórico COMPLETO do backend
  const carregarHistoricoCompleto = async () => {
    setCarregandoCompleto(true);
    setModoExibicao('completo');
    
    try {
      const response = await fetch(`http://localhost:3001/whatsapp/historico/${telefone}`);
      const data = await response.json();
      
      if (data.success && data.mensagens && data.mensagens.length > 0) {
        console.log(`📚 Carregadas ${data.mensagens.length} mensagens do histórico completo`);
        
        const mensagensFormatadas: Mensagem[] = data.mensagens.map((msg: any) => ({
          id: msg.id,
          texto: msg.texto,
          enviado: msg.enviado || msg.fromMe === true,
          timestamp: msg.timestamp,
          dataHora: msg.dataHora
        }));
        
        setHistorico(mensagensFormatadas);
        
        // Salvar também no localStorage como backup
        const key = `whatsapp_historico_completo_${numeroLimpo}`;
        localStorage.setItem(key, JSON.stringify(mensagensFormatadas));
        
      } else if (data.mensagens && data.mensagens.length === 0) {
        console.log('📭 Nenhum histórico encontrado para este número');
        // Tentar carregar do localStorage
        carregarHistoricoLocal();
      } else {
        console.error('Erro ao carregar histórico:', data.error);
        carregarHistoricoLocal();
      }
    } catch (error) {
      console.error('Erro ao buscar histórico completo:', error);
      carregarHistoricoLocal();
    } finally {
      setCarregandoCompleto(false);
    }
  };

  // Carregar histórico local (backup)
  const carregarHistoricoLocal = () => {
    try {
      const key = `whatsapp_historico_${numeroLimpo}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        const mensagensComData = parsed.map((msg: any) => ({
          ...msg,
          timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : new Date(msg.timestamp).getTime()
        }));
        setHistorico(mensagensComData);
        console.log(`📦 Carregadas ${mensagensComData.length} mensagens do localStorage`);
      } else {
        setHistorico([]);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico local:', error);
      setHistorico([]);
    }
  };

  // Carregar histórico normal (local)
  const carregarHistoricoNormal = () => {
    setModoExibicao('local');
    carregarHistoricoLocal();
  };

  // Salvar mensagem enviada
  const salvarMensagemEnviada = (texto: string) => {
    const novaMensagem: Mensagem = {
      id: Date.now().toString(),
      texto,
      enviado: true,
      timestamp: Date.now()
    };

    const novoHistorico = [...historico, novaMensagem];
    setHistorico(novoHistorico);

    const key = `whatsapp_historico_${numeroLimpo}`;
    localStorage.setItem(key, JSON.stringify(novoHistorico));
  };

  // Enviar mensagem
  const handleEnviarMensagem = async () => {
    if (!mensagem.trim() || sending) return;

    const success = await sendMessage(telefone, mensagem.trim());
    if (success) {
      salvarMensagemEnviada(mensagem.trim());
      setMensagem('');
      textareaRef.current?.focus();
    }
  };

  // Conectar ao socket para mensagens em tempo real
  useEffect(() => {
    if (!isOpen) return;

    socketRef.current = io('http://localhost:3001');

    socketRef.current.on('whatsapp_message_received', (msg: any) => {
      const msgNumeroLimpo = msg.fromNumber?.replace(/\D/g, '') || '';
      
      if (msgNumeroLimpo === numeroComparacao || msgNumeroLimpo === numeroLimpo) {
        console.log('📨 Nova mensagem recebida:', msg);
        
        const novaMensagem: Mensagem = {
          id: msg.id || Date.now().toString(),
          texto: msg.body,
          enviado: false,
          timestamp: msg.timestamp || Date.now()
        };
        
        setHistorico(prev => {
          // Evitar duplicatas
          const existe = prev.some(m => m.id === novaMensagem.id);
          if (existe) return prev;
          return [...prev, novaMensagem];
        });
        
        // Salvar no localStorage
        const key = `whatsapp_historico_${numeroLimpo}`;
        const saved = localStorage.getItem(key);
        const historicoAtual = saved ? JSON.parse(saved) : [];
        historicoAtual.push({
          id: novaMensagem.id,
          texto: novaMensagem.texto,
          enviado: false,
          timestamp: novaMensagem.timestamp
        });
        localStorage.setItem(key, JSON.stringify(historicoAtual));
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [isOpen, numeroLimpo, numeroComparacao]);

  useEffect(() => {
    if (isOpen) {
      carregarHistoricoNormal();
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
    }
  }, [isOpen, telefone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [historico]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviarMensagem();
    }
  };

  const formatarHora = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatarData = (timestamp: number) => {
    const date = new Date(timestamp);
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    
    if (date.toDateString() === hoje.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === ontem.toDateString()) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR');
    }
  };

  const mensagensAgrupadas = () => {
    const grupos: { data: string; mensagens: Mensagem[] }[] = [];
    
    historico.forEach(msg => {
      const dataStr = new Date(msg.timestamp).toDateString();
      const existingGroup = grupos.find(g => g.data === dataStr);
      
      if (existingGroup) {
        existingGroup.mensagens.push(msg);
      } else {
        grupos.push({
          data: dataStr,
          mensagens: [msg]
        });
      }
    });
    
    return grupos;
  };

  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        
        <div style={modalHeaderStyle}>
          <div>
            <h2 style={{ margin: 0, color: '#FFF', fontSize: '18px' }}>
              💬 Conversando com {nome}
            </h2>
            <p style={{ margin: '4px 0 0 0', color: '#22C55E', fontSize: '13px' }}>
              📱 {telefone}
            </p>
          </div>
          <button style={btnCloseStyle} onClick={onClose}>✕</button>
        </div>

        <div style={modalBodyStyle}>
          <div style={infoBoxStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>📜 {historico.length} mensagens</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {modoExibicao === 'local' ? (
                  <button 
                    onClick={carregarHistoricoCompleto}
                    disabled={carregandoCompleto}
                    style={botaoHistoricoStyle}
                  >
                    {carregandoCompleto ? '⏳ Carregando...' : '📚 Carregar Histórico Completo'}
                  </button>
                ) : (
                  <button 
                    onClick={carregarHistoricoNormal}
                    style={botaoHistoricoStyle}
                  >
                    📋 Ver apenas mensagens locais
                  </button>
                )}
              </div>
            </div>
            {modoExibicao === 'completo' && (
              <div style={modoInfoStyle}>
                ✅ Exibindo histórico completo do WhatsApp
              </div>
            )}
          </div>

          <div style={historicoContainerStyle}>
            {carregandoCompleto ? (
              <div style={loadingStyle}>
                <div style={spinnerStyle} />
                <p>Carregando histórico completo do WhatsApp...</p>
                <p style={{ fontSize: '11px', color: '#888' }}>
                  Isso pode levar alguns segundos
                </p>
              </div>
            ) : historico.length === 0 ? (
              <div style={emptyHistoricoStyle}>
                <span style={{ fontSize: '48px' }}>💬</span>
                <p>Nenhuma mensagem encontrada</p>
                <p style={{ fontSize: '12px', color: '#666' }}>
                  Envie uma mensagem para começar a conversa
                </p>
                <button 
                  onClick={carregarHistoricoCompleto}
                  style={botaoCarregarStyle}
                >
                  📚 Tentar carregar histórico do WhatsApp
                </button>
              </div>
            ) : (
              <div style={messagesListStyle}>
                {mensagensAgrupadas().map((grupo, idx) => (
                  <div key={idx}>
                    <div style={dateDividerStyle}>
                      <span>{formatarData(grupo.mensagens[0].timestamp)}</span>
                    </div>
                    {grupo.mensagens.map((msg) => (
                      <div
                        key={msg.id}
                        style={{
                          ...messageBubbleStyle,
                          ...(msg.enviado ? messageSentStyle : messageReceivedStyle)
                        }}
                      >
                        <div style={messageTextStyle}>{msg.texto || '(mensagem sem texto)'}</div>
                        <div style={messageTimeStyle}>
                          {formatarHora(msg.timestamp)}
                          {msg.enviado && <span style={{ marginLeft: '4px' }}>✓</span>}
                          {!msg.enviado && <span style={{ marginLeft: '4px' }}>📨</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div style={inputAreaStyle}>
            <textarea
              ref={textareaRef}
              style={textAreaStyle}
              rows={3}
              placeholder={`Digite sua mensagem para ${nome.split(' ')[0]}...`}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
            />
            <div style={buttonGroupStyle}>
              <button style={cancelButtonStyle} onClick={onClose} disabled={sending}>
                Cancelar
              </button>
              <button 
                style={{ ...sendButtonStyle, opacity: (!mensagem.trim() || sending) ? 0.5 : 1 }}
                onClick={handleEnviarMensagem}
                disabled={sending || !mensagem.trim()}
              >
                {sending ? '📤 Enviando...' : '📤 Enviar Mensagem'}
              </button>
            </div>
            <div style={hintStyle}>
              💡 Dica: Clique em "Carregar Histórico Completo" para ver todas as mensagens antigas
            </div>
          </div>
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
  zIndex: 10000,
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#0A0A0A',
  borderRadius: '24px',
  width: '90%',
  maxWidth: '600px',
  height: '80vh',
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid #FFD700',
  overflow: 'hidden',
};

const modalHeaderStyle: React.CSSProperties = {
  padding: '20px 24px',
  borderBottom: '1px solid #1A1A1A',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexShrink: 0,
};

const modalBodyStyle: React.CSSProperties = {
  padding: '20px 24px',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const infoBoxStyle: React.CSSProperties = {
  backgroundColor: '#1A1A1A',
  padding: '10px 12px',
  borderRadius: '12px',
  marginBottom: '16px',
  color: '#AAA',
  fontSize: '12px',
  flexShrink: 0,
};

const modoInfoStyle: React.CSSProperties = {
  marginTop: '8px',
  padding: '6px',
  backgroundColor: 'rgba(34,197,94,0.1)',
  borderRadius: '6px',
  color: '#22C55E',
  fontSize: '11px',
  textAlign: 'center',
};

const historicoContainerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  marginBottom: '16px',
  backgroundColor: '#0F0F0F',
  borderRadius: '16px',
  padding: '16px',
};

const messagesListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const dateDividerStyle: React.CSSProperties = {
  textAlign: 'center',
  margin: '16px 0 12px 0',
  fontSize: '11px',
  color: '#666',
};

const messageBubbleStyle: React.CSSProperties = {
  maxWidth: '75%',
  padding: '10px 14px',
  borderRadius: '18px',
  fontSize: '13px',
  wordBreak: 'break-word',
};

const messageSentStyle: React.CSSProperties = {
  alignSelf: 'flex-end',
  backgroundColor: '#075E54',
  color: '#FFF',
  borderBottomRightRadius: '4px',
};

const messageReceivedStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  backgroundColor: '#1F1F1F',
  color: '#FFF',
  borderBottomLeftRadius: '4px',
};

const messageTextStyle: React.CSSProperties = {
  margin: 0,
  lineHeight: 1.4,
};

const messageTimeStyle: React.CSSProperties = {
  fontSize: '9px',
  opacity: 0.7,
  marginTop: '4px',
  textAlign: 'right',
};

const inputAreaStyle: React.CSSProperties = {
  flexShrink: 0,
  marginTop: 'auto',
};

const textAreaStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid #333',
  backgroundColor: '#111',
  color: '#FFF',
  fontSize: '14px',
  resize: 'none',
  fontFamily: 'inherit',
};

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginTop: '12px',
};

const btnCloseStyle: React.CSSProperties = {
  background: 'rgba(239,68,68,0.2)',
  color: '#EF4444',
  border: 'none',
  borderRadius: '50%',
  width: '36px',
  height: '36px',
  cursor: 'pointer',
  fontSize: '18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const cancelButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px',
  borderRadius: '12px',
  backgroundColor: '#1A1A1A',
  color: '#AAA',
  border: '1px solid #333',
  fontWeight: 600,
  cursor: 'pointer',
};

const sendButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px',
  borderRadius: '12px',
  backgroundColor: '#25D366',
  color: '#FFF',
  border: 'none',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: '15px',
};

const hintStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#666',
  textAlign: 'center',
  marginTop: '8px',
};

const loadingStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '200px',
  gap: '12px',
  color: '#666',
};

const spinnerStyle: React.CSSProperties = {
  width: '30px',
  height: '30px',
  border: '3px solid #1A1A1A',
  borderTop: '3px solid #FFD700',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const emptyHistoricoStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '200px',
  gap: '12px',
  color: '#666',
  textAlign: 'center',
};

const botaoHistoricoStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: '8px',
  backgroundColor: '#3B82F6',
  color: '#FFF',
  border: 'none',
  fontSize: '11px',
  cursor: 'pointer',
  fontWeight: 600,
};

const botaoCarregarStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '10px',
  backgroundColor: '#3B82F6',
  color: '#FFF',
  border: 'none',
  fontSize: '12px',
  cursor: 'pointer',
  fontWeight: 600,
  marginTop: '12px',
};

// Keyframes
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

export default WhatsAppChatModal;