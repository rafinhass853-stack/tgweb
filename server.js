const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173", // Seu frontend React
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

let client;
let qrCodeData = null;
let isReady = false;

// Inicializar cliente WhatsApp
function initializeWhatsApp() {
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', (qr) => {
    qrCodeData = qr;
    qrcode.generate(qr, { small: true });
    console.log('📱 Escaneie o QR Code acima para conectar');
    io.emit('qr_code', qr);
  });

  client.on('ready', () => {
    isReady = true;
    console.log('✅ WhatsApp conectado com sucesso!');
    io.emit('whatsapp_ready', true);
  });

  client.on('message', async (message) => {
    try {
      const contact = await message.getContact();
      const chat = await message.getChat();
      
      const messageData = {
        id: message.id.id,
        from: contact.pushname || contact.name || message.from,
        from_number: message.from,
        body: message.body,
        timestamp: message.timestamp,
        isGroup: chat.isGroup
      };
      
      // Emitir para todos os clientes conectados
      io.emit('whatsapp_message_received', messageData);
      
      // Salvar no banco de dados (opcional)
      // await saveMessageToDatabase(messageData);
      
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
    }
  });

  client.on('disconnected', () => {
    isReady = false;
    console.log('❌ WhatsApp desconectado');
    io.emit('whatsapp_ready', false);
    // Reconectar após 5 segundos
    setTimeout(() => {
      initializeWhatsApp();
    }, 5000);
  });

  client.initialize();
}

// Rota para verificar status
app.get('/whatsapp/status', (req, res) => {
  res.json({ 
    ready: isReady,
    qrCode: qrCodeData,
    timestamp: new Date().toISOString()
  });
});

// Rota para enviar mensagem
app.post('/whatsapp/send', async (req, res) => {
  const { telefone, mensagem } = req.body;
  
  if (!isReady) {
    return res.status(400).json({ 
      success: false, 
      error: 'WhatsApp não está conectado' 
    });
  }
  
  try {
    // Formatar número (remover caracteres não numéricos)
    let numeroFormatado = telefone.replace(/\D/g, '');
    
    // Adicionar código do país se não tiver
    if (numeroFormatado.length === 11) {
      numeroFormatado = `55${numeroFormatado}`; // Brasil
    }
    
    // Adicionar @c.us para o WhatsApp
    const chatId = `${numeroFormatado}@c.us`;
    
    await client.sendMessage(chatId, mensagem);
    
    res.json({ 
      success: true, 
      message: 'Mensagem enviada com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Rota para obter histórico de mensagens
app.get('/whatsapp/history/:telefone', async (req, res) => {
  const { telefone } = req.params;
  
  if (!isReady) {
    return res.status(400).json({ 
      success: false, 
      error: 'WhatsApp não está conectado' 
    });
  }
  
  try {
    let numeroFormatado = telefone.replace(/\D/g, '');
    if (numeroFormatado.length === 11) {
      numeroFormatado = `55${numeroFormatado}`;
    }
    
    const chatId = `${numeroFormatado}@c.us`;
    const chat = await client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: 50 });
    
    const formattedMessages = messages.map(msg => ({
      id: msg.id.id,
      from: msg.from,
      body: msg.body,
      timestamp: msg.timestamp,
      type: msg.type
    }));
    
    res.json({ 
      success: true, 
      messages: formattedMessages 
    });
  } catch (error) {
    res.json({ 
      success: false, 
      messages: [] 
    });
  }
});

// Inicializar servidor
const PORT = 3001;
initializeWhatsApp();

server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 Backend WhatsApp ativo`);
});