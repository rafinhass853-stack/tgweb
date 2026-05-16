import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

let whatsappClient = null;
let isWhatsAppReady = false;
let currentQRCode = null;

// Função para inicializar o WhatsApp
async function initializeWhatsApp() {
  console.log('🔄 Inicializando WhatsApp...');
  
  whatsappClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
  });

  whatsappClient.on('qr', (qr) => {
    console.log('📱 QR Code recebido! Escaneie com seu WhatsApp:');
    qrcode.generate(qr, { small: true });
    currentQRCode = qr;
    io.emit('whatsapp_qr', qr);
  });

  whatsappClient.on('ready', () => {
    console.log('✅ WhatsApp conectado com sucesso!');
    isWhatsAppReady = true;
    currentQRCode = null;
    io.emit('whatsapp_ready', { ready: true });
  });

  whatsappClient.on('authenticated', () => {
    console.log('🔐 WhatsApp autenticado!');
  });

  whatsappClient.on('auth_failure', (msg) => {
    console.error('❌ Falha na autenticação:', msg);
    isWhatsAppReady = false;
    io.emit('whatsapp_auth_failure', { error: msg });
  });

  whatsappClient.on('disconnected', (reason) => {
    console.log('⚠️ WhatsApp desconectado:', reason);
    isWhatsAppReady = false;
    io.emit('whatsapp_disconnected', { reason });
    
    setTimeout(() => {
      console.log('🔄 Tentando reconectar WhatsApp...');
      initializeWhatsApp();
    }, 5000);
  });

  whatsappClient.on('message', async (message) => {
    try {
      if (message.isStatus || message.from.includes('g.us')) {
        return;
      }

      const from = message.from.replace('@c.us', '');
      const body = message.body;
      const timestamp = new Date();

      console.log(`📨 Mensagem recebida de ${from}: ${body.substring(0, 50)}`);

      io.emit('whatsapp_message_received', {
        from: from,
        body: body,
        timestamp: timestamp,
        messageId: message.id.id
      });
      
    } catch (error) {
      console.error('Erro ao processar mensagem recebida:', error);
    }
  });

  await whatsappClient.initialize();
}

// Rotas
app.get('/whatsapp/status', (req, res) => {
  res.json({
    ready: isWhatsAppReady,
    qrCode: currentQRCode,
    clientExists: !!whatsappClient
  });
});

app.post('/whatsapp/send', async (req, res) => {
  const { telefone, mensagem } = req.body;

  if (!telefone || !mensagem) {
    return res.status(400).json({ 
      success: false, 
      error: 'Telefone e mensagem são obrigatórios' 
    });
  }

  if (!isWhatsAppReady) {
    return res.status(503).json({ 
      success: false, 
      error: 'WhatsApp não está conectado. Escaneie o QR Code primeiro.' 
    });
  }

  try {
    let numeroFormatado = telefone.toString().replace(/\D/g, '');
    
    if (!numeroFormatado.startsWith('55')) {
      numeroFormatado = '55' + numeroFormatado;
    }

    const chatId = `${numeroFormatado}@c.us`;
    const result = await whatsappClient.sendMessage(chatId, mensagem);
    
    console.log(`✅ Mensagem enviada para ${telefone}`);
    
    res.json({
      success: true,
      messageId: result.id.id,
      to: telefone
    });
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao enviar mensagem'
    });
  }
});

app.post('/whatsapp/send-template', async (req, res) => {
  const { telefone, tipo, dados } = req.body;

  if (!telefone || !tipo || !dados) {
    return res.status(400).json({
      success: false,
      error: 'Telefone, tipo de template e dados são obrigatórios'
    });
  }

  if (!isWhatsAppReady) {
    return res.status(503).json({
      success: false,
      error: 'WhatsApp não está conectado'
    });
  }

  const templates = {
    novaCarga: (d) => `🚛 *NOVA CARGA PROGRAMADA* 🚛\n\n` +
      `Olá ${d.nomeMotorista},\n\n` +
      `Você foi programado para uma nova carga:\n\n` +
      `📋 *DT:* ${d.dt}\n` +
      `📍 *Coleta:* ${d.coletaLocal} - ${d.coletaCidade}\n` +
      `📅 *Data Coleta:* ${d.coletaData}\n` +
      `🏭 *Entrega:* ${d.entregaLocal} - ${d.entregaCidade}\n` +
      `📅 *Data Entrega:* ${d.entregaData}\n` +
      `🚛 *Placa:* ${d.placa}\n\n` +
      `⚠️ *Favor confirmar recebimento da programação*`,

    lembreteColeta: (d) => `⏰ *LEMBRETE DE COLETA* ⏰\n\n` +
      `Olá ${d.nomeMotorista},\n\n` +
      `Sua coleta está agendada para:\n` +
      `📅 *Data:* ${d.coletaData}\n` +
      `📍 *Local:* ${d.coletaLocal} - ${d.coletaCidade}\n\n` +
      `Por favor, esteja no local no horário combinado.`,

    atualizacaoStatus: (d) => `📢 *ATUALIZAÇÃO DE STATUS* 📢\n\n` +
      `Olá ${d.nomeMotorista},\n\n` +
      `O status da sua carga ${d.dt} foi atualizado para:\n` +
      `*${d.novoStatus}*\n\n` +
      `Acesse o sistema para mais detalhes.`,

    alertaAtraso: (d) => `⚠️ *ALERTA DE ATRASO* ⚠️\n\n` +
      `Olá ${d.nomeMotorista},\n\n` +
      `Identificamos que você está com atraso na:\n` +
      `*${d.tipoEvento}*\n\n` +
      `Por favor, entre em contato com a central para justificar.`,

    confirmacaoCheckin: (d) => `✅ *CHECK-IN REGISTRADO* ✅\n\n` +
      `Olá ${d.nomeMotorista},\n\n` +
      `Seu check-in foi registrado com sucesso!\n` +
      `📍 *Local:* ${d.local}\n` +
      `⏰ *Horário:* ${d.horario}\n` +
      `📊 *Pontualidade:* ${d.pontualidade}`
  };

  const templateFn = templates[tipo];
  if (!templateFn) {
    return res.status(400).json({
      success: false,
      error: `Template '${tipo}' não encontrado`
    });
  }

  try {
    const mensagem = templateFn(dados);
    
    let numeroFormatado = telefone.toString().replace(/\D/g, '');
    if (!numeroFormatado.startsWith('55')) {
      numeroFormatado = '55' + numeroFormatado;
    }

    const chatId = `${numeroFormatado}@c.us`;
    const result = await whatsappClient.sendMessage(chatId, mensagem);

    res.json({
      success: true,
      messageId: result.id.id,
      to: telefone,
      template: tipo
    });
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/whatsapp/qrcode', (req, res) => {
  if (currentQRCode) {
    res.json({ qrCode: currentQRCode });
  } else if (isWhatsAppReady) {
    res.json({ ready: true, message: 'WhatsApp já está conectado' });
  } else {
    res.json({ qrCode: null, message: 'Aguardando QR Code...' });
  }
});

app.post('/whatsapp/reconnect', async (req, res) => {
  try {
    if (whatsappClient) {
      await whatsappClient.destroy();
    }
    isWhatsAppReady = false;
    currentQRCode = null;
    
    setTimeout(() => {
      initializeWhatsApp();
    }, 1000);
    
    res.json({ success: true, message: 'Reconexão iniciada' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);

  socket.emit('whatsapp_status', {
    ready: isWhatsAppReady,
    qrCode: currentQRCode
  });

  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 Frontend deve estar em: http://localhost:5173`);
  
  initializeWhatsApp();
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Promise rejeitada não tratada:', error);
});