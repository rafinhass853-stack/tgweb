const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
require('dotenv').config();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Inicializar Firebase
const serviceAccount = require('../robot-tracker/firebasegoogle.json');
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
console.log('✅ Firebase inicializado');

const CONFIG = {
  url: 'http://181.191.209.100:9090/gestor/',
  user: 'operacao',
  password: '2025',
  headless: "new", // Alterado para o novo modo headless
  // Configurações adicionais para melhor performance em background
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1366,768',
    '--disable-software-rasterizer',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-translate',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run'
  ]
};

function converterPlaca(placa) {
  if (!placa) return placa;
  let placaLimpa = placa.replace(/-/g, '');
  if (placaLimpa.length === 7) {
    return `${placaLimpa.substring(0, 3)}-${placaLimpa.substring(3)}`;
  }
  return placa;
}

async function capturarLocalizacoes() {
  const timestamp = new Date().toISOString();
  console.log(`\n🚀 [${timestamp}] INICIANDO CAPTURA SIGHRA (Background mode - New Headless)`);
  
  let browser = null;
  
  try {
    // Lançar navegador em modo headless novo (sem interface gráfica)
    browser = await puppeteer.launch({
      headless: CONFIG.headless, // "new" para o novo modo headless
      args: CONFIG.args,
      ignoreHTTPSErrors: true,
      timeout: 60000
    });
    
    console.log('✅ Navegador iniciado em modo headless (Chrome new headless mode)');
    
    const page = await browser.newPage();
    
    // Reduzir o tamanho da viewport para melhor performance
    await page.setViewport({ width: 1024, height: 768 });
    
    // Configurar timeouts
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    
    // Desabilitar recursos não necessários para melhor performance
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      // Bloquear recursos desnecessários (imagens, fontes, etc)
      const resourceType = request.resourceType();
      if (resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // 1. LOGIN
    console.log('📝 Fazendo login...');
    await page.goto(CONFIG.url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    await delay(2000);
    
    const inputs = await page.$$('input');
    let campoUsuario = null;
    let campoSenha = null;
    
    for (let i = 0; i < inputs.length; i++) {
      const type = await inputs[i].evaluate(el => el.type);
      if (type === 'text' || type === 'email') campoUsuario = inputs[i];
      if (type === 'password') campoSenha = inputs[i];
    }
    
    if (!campoUsuario && inputs.length >= 1) campoUsuario = inputs[0];
    if (!campoSenha && inputs.length >= 2) campoSenha = inputs[1];
    
    if (campoUsuario) {
      await campoUsuario.click({ clickCount: 3 });
      await campoUsuario.type(CONFIG.user);
    }
    
    if (campoSenha) {
      await campoSenha.click({ clickCount: 3 });
      await campoSenha.type(CONFIG.password);
    }
    
    const botoes = await page.$$('button, input[type="submit"]');
    if (botoes.length > 0) {
      await botoes[0].click();
    }
    
    await delay(4000);
    console.log('✅ Login OK');
    
    // 2. CLICAR EM "GERAL"
    console.log('📊 Clicando em "Geral"...');
    
    let clicou = await page.evaluate(() => {
      const geralLink = document.querySelector('a.label-selecao-grupo');
      if (geralLink && geralLink.innerText.trim() === 'Geral') {
        geralLink.click();
        return true;
      }
      return false;
    });
    
    if (!clicou) {
      clicou = await page.evaluate(() => {
        const elementos = Array.from(document.querySelectorAll('a, button'));
        const geral = elementos.find(el => el.innerText?.trim() === 'Geral');
        if (geral) {
          geral.click();
          return true;
        }
        return false;
      });
    }
    
    if (clicou) {
      console.log('✅ Clicou em "Geral"');
      await delay(2000);
    } else {
      console.log('⚠️ Não conseguiu clicar em "Geral"');
    }
    
    // 3. CLICAR EM "RASTREAMENTO"
    console.log('📊 Procurando "Rastreamento"...');
    
    const clicouRast = await page.evaluate(() => {
      const elementos = Array.from(document.querySelectorAll('a, button'));
      const rastreamento = elementos.find(el =>
        el.innerText?.toLowerCase().includes('rastreamento')
      );
      if (rastreamento) {
        rastreamento.click();
        return true;
      }
      return false;
    });
    
    if (clicouRast) {
      console.log('✅ Clicou em "Rastreamento"');
      await delay(4000);
    } else {
      console.log('⚠️ Não conseguiu clicar em "Rastreamento"');
    }
    
    // 4. AGUARDAR TABELA CARREGAR
    console.log('📊 Aguardando tabela carregar...');
    
    try {
      await page.waitForSelector('#mainForm\\:tablePosicoes tbody tr', { timeout: 20000 });
      console.log('✅ Tabela carregou!');
    } catch (error) {
      console.log('⚠️ Timeout aguardando tabela, tentando continuar...');
    }
    
    await delay(2000);
    
    // 5. EXTRAIR DADOS
    console.log('📊 Extraindo dados dos veículos...');
    
    const veiculos = await page.evaluate(() => {
      const resultados = [];
      
      const tabela = document.querySelector('#mainForm\\:tablePosicoes');
      if (!tabela) return resultados;
      
      const tbody = tabela.querySelector('tbody');
      if (!tbody) return resultados;
      
      const rows = tbody.querySelectorAll('tr');
      
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        
        if (cells.length >= 15) {
          const placa = cells[2]?.innerText?.trim() || '';
          
          let motorista = cells[13]?.innerText?.trim() || '';
          
          if (motorista) {
            motorista = motorista.replace(/\s+/g, ' ').trim();
            if (motorista === '' || motorista === '-' || motorista === '---') {
              motorista = 'Não informado';
            }
          } else {
            motorista = 'Não informado';
          }
          
          let latitudeRaw = cells[5]?.innerText?.trim() || '';
          let latitude = latitudeRaw ? parseFloat(latitudeRaw.replace(',', '.')) : null;
          
          let longitudeRaw = cells[6]?.innerText?.trim() || '';
          let longitude = longitudeRaw ? parseFloat(longitudeRaw.replace(',', '.')) : null;
          
          let velocidade = 0;
          let velocidadeRaw = cells[8]?.innerText?.trim() || '';
          if (velocidadeRaw && !isNaN(parseFloat(velocidadeRaw))) {
            velocidade = parseFloat(velocidadeRaw);
          }
          
          let ignicao = 'DESCONHECIDO';
          const ignicaoCell = cells[11];
          
          if (ignicaoCell) {
            const ignicaoHtml = ignicaoCell.innerHTML?.trim() || '';
            const ignicaoTexto = ignicaoCell.innerText?.trim() || '';
            
            if (ignicaoHtml) {
              if (ignicaoHtml.includes('green') || 
                  ignicaoHtml.includes('verde') ||
                  ignicaoHtml.includes('ligado')) {
                ignicao = 'LIGADO';
              } 
              else if (ignicaoHtml.includes('red') || 
                       ignicaoHtml.includes('vermelho') ||
                       ignicaoHtml.includes('desligado')) {
                ignicao = 'DESLIGADO';
              }
            }
            
            if (ignicao === 'DESCONHECIDO' && ignicaoTexto) {
              const textoLower = ignicaoTexto.toLowerCase();
              if (textoLower.includes('ligado') || textoLower.includes('on')) {
                ignicao = 'LIGADO';
              } else if (textoLower.includes('desligado') || textoLower.includes('off')) {
                ignicao = 'DESLIGADO';
              }
            }
          }
          
          let logradouro = cells[17]?.innerText?.trim() || '';
          let local = cells[18]?.innerText?.trim() || '';
          
          if (logradouro === 'Não foi possível definir') logradouro = '';
          if (local === 'Não foi possível definir') local = '';
          
          let localizacao = '';
          if (logradouro) {
            localizacao = logradouro;
            if (local && local !== logradouro) {
              localizacao += ` - ${local}`;
            }
          } else if (local) {
            localizacao = local;
          }
          
          const macro = cells[14]?.innerText?.trim() || '';
          
          if (placa && placa.length >= 7) {
            resultados.push({
              placa: placa,
              motorista: motorista,
              latitude: latitude,
              longitude: longitude,
              velocidade: velocidade,
              ignicao: ignicao,
              localizacao: localizacao || 'Localização não disponível',
              logradouro: logradouro,
              local: local,
              macro: macro
            });
          }
        }
      }
      
      return resultados;
    });
    
    console.log(`✅ Encontrados ${veiculos.length} veículos`);
    
    if (veiculos.length === 0) {
      console.log('⚠️ Nenhum veículo encontrado');
      return;
    }
    
    // Log resumido para modo background
    console.log(`\n📋 Amostra dos dados (primeiros 3):`);
    veiculos.slice(0, 3).forEach(v => {
      const statusIcon = v.ignicao === 'LIGADO' ? '🟢' : (v.ignicao === 'DESLIGADO' ? '🔴' : '⚪');
      console.log(`   ${v.placa} | Motorista: ${v.motorista} | Vel: ${v.velocidade} km/h | ${statusIcon}`);
      if (v.localizacao && v.localizacao !== 'Localização não disponível') {
        console.log(`        📍 ${v.localizacao.substring(0, 60)}`);
      }
    });
    
    console.log('\n📝 Atualizando Firebase...');
    
    let atualizados = 0;
    let naoEncontrados = 0;
    
    for (const veiculo of veiculos) {
      try {
        const placaFormatada = converterPlaca(veiculo.placa);
        
        let querySnapshot = await db.collection('veiculos')
          .where('placa', '==', veiculo.placa)
          .limit(1)
          .get();
        
        if (querySnapshot.empty && placaFormatada !== veiculo.placa) {
          querySnapshot = await db.collection('veiculos')
            .where('placa', '==', placaFormatada)
            .limit(1)
            .get();
        }
        
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          
          const dadosAtualizacao = {
            ultimaLocalizacao: veiculo.localizacao,
            ultimoEndereco: veiculo.localizacao,
            ultimoLogradouro: veiculo.logradouro,
            ultimoLocal: veiculo.local,
            coordenadas: {
              lat: veiculo.latitude,
              lng: veiculo.longitude
            },
            velocidade: veiculo.velocidade,
            ignicao: veiculo.ignicao,
            ultimaMacro: veiculo.macro,
            motorista: veiculo.motorista,
            ultimoMotorista: veiculo.motorista,
            ultimaAtualizacaoRastreador: admin.firestore.Timestamp.now(),
            statusRastreador: 'online',
            fonte: 'SIGHRA',
            ultimaConsulta: new Date().toISOString(),
            ultimaLatitude: veiculo.latitude,
            ultimaLongitude: veiculo.longitude
          };
          
          await doc.ref.update(dadosAtualizacao);
          atualizados++;
        } else {
          naoEncontrados++;
          if (naoEncontrados <= 5) { // Limitar logs de não encontrados
            console.log(`⚠️ ${veiculo.placa} não cadastrado no Firebase`);
          }
        }
      } catch (error) {
        console.log(`❌ ${veiculo.placa}: ${error.message}`);
      }
    }
    
    if (naoEncontrados > 5) {
      console.log(`   ... e mais ${naoEncontrados - 5} veículos não cadastrados`);
    }
    
    console.log(`\n📈 RESUMO:`);
    console.log(`   ✅ Atualizados: ${atualizados}`);
    console.log(`   ⚠️ Não cadastrados: ${naoEncontrados}`);
    console.log(`   📊 Total no SIGHRA: ${veiculos.length}`);
    console.log(`   ⏱️ Duração: ${((Date.now() - new Date(timestamp).getTime()) / 1000).toFixed(2)}s`);
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    if (browser) {
      try {
        const pages = await browser.pages();
        if (pages.length > 0) {
          await pages[0].screenshot({ path: './erro-screenshot.png' });
          console.log('📸 Screenshot do erro salvo: erro-screenshot.png');
        }
      } catch (e) {
        console.log('Não foi possível salvar screenshot');
      }
    }
  } finally {
    if (browser) await browser.close();
    console.log(`🏁 [${new Date().toISOString()}] Finalizado\n`);
  }
}

// ==================== LOOP COM INTERVALO DO .ENV ====================
const INTERVALO_MINUTOS = parseInt(process.env.CRON_INTERVAL || '20');
const INTERVALO_MS = INTERVALO_MINUTOS * 60 * 1000;

async function executarLoop() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🕒 ROBÔ SIGHRA EM BACKGROUND`);
  console.log(`📆 Intervalo configurado: ${INTERVALO_MINUTOS} minutos`);
  console.log(`🤖 Modo headless: NOVO MODO (headless: "new")`);
  console.log(`💾 Memória: Modo otimizado para background`);
  console.log(`🌐 Chrome: Usando nova engine headless`);
  console.log(`⏰ Executando a cada ${INTERVALO_MINUTOS} minutos`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Executar primeira captura
  await capturarLocalizacoes();
  
  // Configurar intervalo para execuções subsequentes
  setInterval(async () => {
    console.log(`\n🔄 Executando coleta agendada (${INTERVALO_MINUTOS} min)...`);
    await capturarLocalizacoes();
  }, INTERVALO_MS);
}

// Tratamento para fechamento graceful
process.on('SIGINT', () => {
  console.log('\n\n🛑 Recebido sinal de interrupção. Encerrando robô...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Recebido sinal de término. Encerrando robô...');
  process.exit(0);
});

// Iniciar o robô
executarLoop().catch(console.error);