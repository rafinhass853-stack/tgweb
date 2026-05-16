import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client, LocalAuth } = pkg;

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

let client = null;
let isReady = false;
let qrCode = null;
let chatsCarregados = false;

// Buscar todas as conversas do WhatsApp
async function buscarTodasConversas() {
  if (!client || !isReady) {
    console.log('⚠️ Cliente não está pronto para buscar conversas');
    return [];
  }
  
  try {
    console.log('📚 Buscando todas as conversas do WhatsApp...');
    
    // Obter todos os chats
    const chats = await client.getChats();
    console.log(`📊 Encontrados ${chats.length} chats no total`);
    
    const conversas = [];
    
    for (const chat of chats) {
      // Filtrar apenas chats de usuários (não grupos, não status)
      if (chat.isGroup || chat.id.user === 'status') continue;
      
      try {
        // Buscar mensagens do chat (limite de 100 por conversa)
        const messages = await chat.fetchMessages({ limit: 100 });
        
        // Buscar informações de contato
        let contactName = chat.name;
        let contactNumber = chat.id.user;
        
        try {
          const contact = await chat.getContact();
          contactName = contact.pushname || contact.name || chat.name;
          contactNumber = contact.number || chat.id.user;
        } catch (err) {
          console.log(`Não foi possível obter contato para ${chat.id.user}`);
        }
        
        const mensagensFormatadas = messages.map(msg => ({
          id: msg.id.id,
          texto: msg.body,
          tipo: msg.type,
          enviado: msg.fromMe,
          timestamp: msg.timestamp * 1000,
          dataHora: new Date(msg.timestamp * 1000).toISOString()
        }));
        
        // Ordenar por timestamp
        mensagensFormatadas.sort((a, b) => a.timestamp - b.timestamp);
        
        conversas.push({
          numero: contactNumber,
          nome: contactName,
          ultimaMensagem: mensagensFormatadas[mensagensFormatadas.length - 1]?.texto || '',
          ultimoHorario: mensagensFormatadas[mensagensFormatadas.length - 1]?.timestamp || null,
          totalMensagens: mensagensFormatadas.length,
          mensagens: mensagensFormatadas
        });
        
        console.log(`   ✅ ${contactName}: ${mensagensFormatadas.length} mensagens`);
        
      } catch (error) {
        console.error(`   ❌ Erro ao processar chat ${chat.id.user}:`, error.message);
      }
    }
    
    console.log(`✅ Total de ${conversas.length} conversas carregadas!`);
    return conversas;
    
  } catch (error) {
    console.error('❌ Erro ao buscar conversas:', error);
    return [];
  }
}

// Buscar histórico específico de um número
async function buscarHistoricoNumero(telefone) {
  if (!client || !isReady) {
    throw new Error('WhatsApp não está conectado');
  }
  
  try {
    let numero = telefone.replace(/\D/g, '');
    if (numero.length === 10 || numero.length === 11) {
      if (!numero.startsWith('55')) {
        numero = '55' + numero;
      }
    }
    
    console.log(`🔍 Buscando histórico para o número: ${numero}`);
    
    // Formatar ID do chat
    const chatId = `${numero}@c.us`;
    
    // Obter o chat
    const chat = await client.getChatById(chatId);
    
    if (!chat) {
      console.log(`⚠️ Nenhum chat encontrado para ${numero}`);
      return { success: true, mensagens: [], total: 0 };
    }
    
    // Buscar mensagens (limite de 500 para histórico completo)
    const messages = await chat.fetchMessages({ limit: 500 });
    
    console.log(`📨 Encontradas ${messages.length} mensagens no histórico`);
    
    // Formatar mensagens
    const mensagensFormatadas = messages.map(msg => ({
      id: msg.id.id,
      texto: msg.body,
      tipo: msg.type,
      enviado: msg.fromMe,
      timestamp: msg.timestamp * 1000,
      dataHora: new Date(msg.timestamp * 1000).toLocaleString('pt-BR'),
      fromMe: msg.fromMe
    }));
    
    // Ordenar por timestamp (mais antigo primeiro)
    mensagensFormatadas.sort((a, b) => a.timestamp - b.timestamp);
    
    // Obter informações do contato
    let contactName = chat.name;
    try {
      const contact = await chat.getContact();
      contactName = contact.pushname || contact.name || chat.name;
    } catch (err) {
      console.log('Erro ao obter nome do contato');
    }
    
    return {
      success: true,
      nome: contactName,
      numero: numero,
      total: mensagensFormatadas.length,
      mensagens: mensagensFormatadas
    };
    
  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    return { success: false, error: error.message, mensagens: [], total: 0 };
  }
}

function initializeClient() {
  console.log('🔄 Inicializando cliente WhatsApp...');
  
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '.wwebjs_auth'),
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  client.on('qr', (qr) => {
    console.log('📱 QR Code recebido - Escaneie com seu WhatsApp');
    qrcode.generate(qr, { small: true });
    qrCode = qr;
    isReady = false;
    chatsCarregados = false;
    io.emit('whatsapp_qr', qr);
  });

  client.on('ready', async () => {
    console.log('✅ WhatsApp conectado com sucesso!');
    isReady = true;
    qrCode = null;
    
    // Carregar todas as conversas automaticamente
    const conversas = await buscarTodasConversas();
    chatsCarregados = true;
    
    io.emit('whatsapp_ready');
    io.emit('whatsapp_conversas_carregadas', conversas);
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Falha na autenticação:', msg);
    isReady = false;
    io.emit('whatsapp_auth_failure', msg);
  });

  client.on('disconnected', (reason) => {
    console.log(`⚠️ WhatsApp desconectado: ${reason}`);
    isReady = false;
    chatsCarregados = false;
    io.emit('whatsapp_disconnected', { reason });
  });

  // Capturar mensagens recebidas em tempo real
  client.on('message', async (message) => {
    if (message.from === 'status@broadcast') return;
    if (message.fromMe) return;
    
    try {
      const contact = await message.getContact();
      const nome = contact.pushname || contact.name || 'Desconhecido';
      const numero = message.from.replace('@c.us', '');
      
      const mensagemRecebida = {
        id: message.id.id,
        from: nome,
        fromNumber: numero,
        body: message.body,
        timestamp: message.timestamp * 1000,
        type: message.type,
        enviado: false
      };
      
      console.log(`\n📨 MENSAGEM RECEBIDA de ${nome}: ${message.body}`);
      
      // Emitir para os clientes
      io.emit('whatsapp_message_received', mensagemRecebida);
      
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
    }
  });

  client.initialize().catch(err => {
    console.error('Erro ao inicializar cliente:', err);
  });
}

// ============= ENDPOINTS DA API =============

// Status
app.get('/whatsapp/status', (req, res) => {
  res.json({
    ready: isReady,
    qrCode: qrCode,
    status: isReady ? 'connected' : (qrCode ? 'awaiting_qr' : 'disconnected'),
    chatsCarregados: chatsCarregados
  });
});

// Buscar TODAS as conversas (histórico completo)
app.get('/whatsapp/todas-conversas', async (req, res) => {
  if (!isReady || !client) {
    return res.status(400).json({ 
      success: false, 
      error: 'WhatsApp não está conectado' 
    });
  }
  
  const conversas = await buscarTodasConversas();
  res.json({ success: true, conversas: conversas });
});

// Buscar histórico de um número específico
app.get('/whatsapp/historico/:telefone', async (req, res) => {
  const { telefone } = req.params;
  
  if (!isReady || !client) {
    return res.status(400).json({ 
      success: false, 
      error: 'WhatsApp não está conectado' 
    });
  }
  
  const historico = await buscarHistoricoNumero(telefone);
  res.json(historico);
});

// Enviar mensagem
app.post('/whatsapp/send', async (req, res) => {
  const { telefone, mensagem } = req.body;
  
  if (!telefone || !mensagem) {
    return res.status(400).json({ 
      success: false, 
      error: 'Telefone e mensagem são obrigatórios' 
    });
  }
  
  if (!isReady || !client) {
    return res.status(400).json({ 
      success: false, 
      error: 'WhatsApp não está conectado' 
    });
  }
  
  try {
    let numero = telefone.replace(/\D/g, '');
    
    if (numero.length === 10 || numero.length === 11) {
      if (!numero.startsWith('55')) {
        numero = '55' + numero;
      }
    }
    
    const numeroCompleto = `${numero}@c.us`;
    
    console.log(`📤 Enviando para: ${numeroCompleto}`);
    console.log(`📝 Mensagem: ${mensagem}`);
    
    const sentMessage = await client.sendMessage(numeroCompleto, mensagem);
    
    console.log('✅ Mensagem enviada!');
    res.json({ 
      success: true, 
      messageId: sentMessage.id.id 
    });
  } catch (error) {
    console.error('❌ Erro:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Reconectar
app.post('/whatsapp/reconnect', (req, res) => {
  if (client) {
    client.destroy();
  }
  setTimeout(() => {
    initializeClient();
  }, 1000);
  res.json({ success: true, message: 'Reconexão iniciada' });
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado ao socket');
  
  socket.emit('whatsapp_status', {
    ready: isReady,
    qrCode: qrCode,
    chatsCarregados: chatsCarregados
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado');
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log('📱 WhatsApp Backend ativo');
  initializeClient();
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando servidor...');
  if (client) {
    await client.destroy();
  }
  process.exit(0);
});