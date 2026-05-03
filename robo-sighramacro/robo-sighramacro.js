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
  headless: process.env.HEADLESS === 'false',
  motoristaAlvo: 'JOAO SILVA', // 👈 COLOQUE O NOME DO MOTORISTA AQUI
};

async function acessarMenuAcoesEClicarOlho(page, nomeMotoristaAlvo) {
  console.log(`\n🔍 Procurando motorista: "${nomeMotoristaAlvo}"...`);
  
  // Aguarda a tabela carregar
  await page.waitForSelector('#mainForm\\:tablePosicoes tbody tr', { timeout: 30000 });
  
  const resultado = await page.evaluate((motoristaAlvo) => {
    const tabela = document.querySelector('#mainForm\\:tablePosicoes');
    if (!tabela) return { encontrado: false, mensagem: 'Tabela não encontrada' };
    
    const tbody = tabela.querySelector('tbody');
    if (!tbody) return { encontrado: false, mensagem: 'Corpo da tabela não encontrado' };
    
    const rows = tbody.querySelectorAll('tr');
    
    // Índices da tabela:
    // 0: Ação (botões: visualizar/olho, editar, etc)
    // 13: Motorista
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.querySelectorAll('td');
      
      if (cells.length > 13) {
        const nomeMotorista = cells[13]?.innerText?.trim() || '';
        
        if (nomeMotorista.toLowerCase().includes(motoristaAlvo.toLowerCase())) {
          // Encontrou o motorista! Agora vamos na coluna de Ação (índice 0)
          const acaoCell = cells[0];
          
          if (acaoCell) {
            // Procura especificamente pelo ícone/botão do olho (visualizar)
            // Pode ser: <i class="fa fa-eye">, <img src="...olho...">, <button title="Visualizar">
            const olhoBtn = acaoCell.querySelector(
              'img[src*="olho"], img[src*="eye"], ' +
              'i.fa-eye, i.fa-eye-slash, ' +
              'button[title*="Visualizar"], button[title*="visualizar"], ' +
              'a[title*="Visualizar"], a[title*="visualizar"], ' +
              'span[title*="Visualizar"], div[title*="Visualizar"]'
            );
            
            if (olhoBtn) {
              // Clica no botão do olho
              olhoBtn.click();
              return {
                encontrado: true,
                mensagem: `✅ Motorista "${nomeMotorista}" encontrado! Clicou no botão 👁️ (Visualizar)`,
                linha: i + 1,
                nome: nomeMotorista
              };
            } else {
              // Tenta encontrar qualquer botão na célula de ação
              const botoes = acaoCell.querySelectorAll('button, a, input[type="button"], img, i');
              
              if (botoes.length > 0) {
                // Tenta identificar qual é o botão de visualizar (geralmente é o primeiro ou tem ícone de olho)
                let botaoVisualizar = null;
                
                for (let botao of botoes) {
                  const html = botao.outerHTML.toLowerCase();
                  const titulo = (botao.title || '').toLowerCase();
                  const classe = (botao.className || '').toLowerCase();
                  
                  if (html.includes('eye') || titulo.includes('visualizar') || classe.includes('eye')) {
                    botaoVisualizar = botao;
                    break;
                  }
                }
                
                if (botaoVisualizar) {
                  botaoVisualizar.click();
                  return {
                    encontrado: true,
                    mensagem: `✅ Motorista "${nomeMotorista}" encontrado! Clicou no botão de visualizar`,
                    linha: i + 1,
                    nome: nomeMotorista
                  };
                } else if (botoes[0]) {
                  // Se não achou o olho específico, clica no primeiro botão (geralmente é o visualizar)
                  botoes[0].click();
                  return {
                    encontrado: true,
                    mensagem: `⚠️ Motorista "${nomeMotorista}" encontrado! Clicou no primeiro botão da ação (presumindo ser o visualizar)`,
                    linha: i + 1,
                    nome: nomeMotorista
                  };
                }
              }
            }
          }
          
          return {
            encontrado: true,
            mensagem: `⚠️ Motorista "${nomeMotorista}" encontrado, mas não foi possível clicar no botão de ação.`,
            linha: i + 1,
            nome: nomeMotorista
          };
        }
      }
    }
    
    return { 
      encontrado: false, 
      mensagem: `❌ Motorista "${motoristaAlvo}" não encontrado na tabela.` 
    };
  }, nomeMotoristaAlvo);
  
  console.log(resultado.mensagem);
  return resultado;
}

async function executarRobo() {
  console.log('\n🚀 INICIANDO ROBÔ SIGHRA - ACESSAR MENU AÇÕES E VISUALIZAR\n');
  console.log(`🎯 Motorista alvo: ${CONFIG.motoristaAlvo}\n`);
  
  let browser = null;
  
  try {
    browser = await puppeteer.launch({
      headless: CONFIG.headless === 'true' ? 'new' : false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    
    // 1. LOGIN
    console.log('📝 1. Fazendo login no sistema...');
    await page.goto(CONFIG.url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    
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
      console.log('   ✓ Usuário preenchido');
    }
    
    if (campoSenha) {
      await campoSenha.click({ clickCount: 3 });
      await campoSenha.type(CONFIG.password);
      console.log('   ✓ Senha preenchida');
    }
    
    const botoes = await page.$$('button, input[type="submit"]');
    if (botoes.length > 0) {
      await botoes[0].click();
      console.log('   ✓ Botão de login clicado');
    }
    
    await delay(5000);
    console.log('✅ Login realizado com sucesso!\n');
    
    // 2. CLICAR EM "GERAL"
    console.log('📂 2. Acessando menu "Geral"...');
    
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
      console.log('   ✓ Clicou em "Geral"');
      await delay(3000);
    } else {
      console.log('   ⚠️ Não encontrou botão "Geral", tentando continuar...');
    }
    
    // 3. CLICAR EM "RASTREAMENTO" (ou onde fica a tabela de veículos)
    console.log('📍 3. Acessando tela de rastreamento...');
    await delay(2000);
    
    const clicouRast = await page.evaluate(() => {
      const elementos = Array.from(document.querySelectorAll('a, button'));
      const rastreamento = elementos.find(el =>
        el.innerText?.toLowerCase().includes('rastreamento') ||
        el.innerText?.toLowerCase().includes('rastrear') ||
        el.innerText?.toLowerCase().includes('veículos')
      );
      if (rastreamento) {
        rastreamento.click();
        return true;
      }
      return false;
    });
    
    if (clicouRast) {
      console.log('   ✓ Clicou em "Rastreamento"');
      await delay(5000);
    } else {
      console.log('   ⚠️ Não encontrou "Rastreamento", tentando continuar...');
    }
    
    // 4. AGUARDAR TABELA CARREGAR
    console.log('⏳ 4. Aguardando tabela de veículos carregar...');
    
    try {
      await page.waitForSelector('#mainForm\\:tablePosicoes tbody tr', { timeout: 30000 });
      console.log('   ✅ Tabela carregada com sucesso!\n');
    } catch (error) {
      console.log('   ⚠️ Timeout aguardando tabela, mas continuando...\n');
    }
    
    await delay(3000);
    
    // 5. ACESSAR O MENU AÇÕES E CLICAR NO OLHO DO MOTORISTA ESPECÍFICO
    console.log('👁️ 5. Procurando motorista e clicando no botão visualizar (olho)...');
    
    const resultado = await acessarMenuAcoesEClicarOlho(page, CONFIG.motoristaAlvo);
    
    if (resultado.encontrado) {
      // Aguarda o modal/popup abrir após clicar no olho
      console.log('\n⏳ Aguardando janela de visualização abrir...');
      await delay(5000);
      
      // Tira screenshot da tela de visualização
      await page.screenshot({ path: './visualizacao-veiculo.png' });
      console.log('📸 Screenshot salvo: visualizacao-veiculo.png');
      
      // Aguarda mais um pouco para ver o conteúdo
      console.log('⏳ Mantendo janela aberta por 10 segundos para visualização...');
      await delay(10000);
      
      console.log('\n✨ AÇÃO CONCLUÍDA! O robô abriu a visualização do veículo do motorista.');
    } else {
      console.log('\n❌ Não foi possível encontrar o motorista especificado.');
      console.log('💡 DICA: Verifique se o nome está exatamente como aparece na tabela');
      console.log(`   Nome procurado: "${CONFIG.motoristaAlvo}"`);
    }
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    if (browser) {
      const pages = await browser.pages();
      if (pages.length > 0) {
        await pages[0].screenshot({ path: './erro-screenshot.png' });
        console.log('📸 Screenshot do erro salvo: erro-screenshot.png');
      }
    }
  } finally {
    if (browser) {
      console.log('\n🔚 Fechando navegador...');
      await browser.close();
    }
    console.log('\n🏁 Robô finalizado\n');
  }
}

// Executar o robô
executarRobo();