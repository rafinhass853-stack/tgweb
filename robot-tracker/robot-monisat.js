const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Função para converter placa (adicionar traço)
function converterPlaca(placaMonisat) {
  if (!placaMonisat) return placaMonisat;
  let placa = placaMonisat.replace(/-/g, '');
  if (placa.length === 7) {
    return `${placa.substring(0, 3)}-${placa.substring(3)}`;
  }
  return placaMonisat;
}

// Inicializar Firebase
const serviceAccount = require('./firebasegoogle.json');
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
console.log('✅ Firebase inicializado');

const CONFIG = {
  url: process.env.MONISAT_URL || 'https://site.monisat.com.br/index.php',
  user: process.env.MONISAT_USER || 'TG',
  loginName: process.env.MONISAT_LOGIN_NAME || 'RAFAEL',
  password: process.env.MONISAT_PASSWORD || 'ARAUJO',
  headless: process.env.MONISAT_HEADLESS === 'true' || false
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function capturarRotas() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 INICIANDO CAPTURA MONISAT - ROTAS POR PLACA');
  console.log('📅 ' + new Date().toLocaleString());
  console.log('='.repeat(60) + '\n');
  
  let browser = null;
  
  try {
    browser = await puppeteer.launch({
      headless: CONFIG.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    
    // LOGIN
    console.log('📝 Fazendo login no MONISAT...');
    await page.goto(CONFIG.url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    
    await page.evaluate((user, loginName, password) => {
      const inputs = Array.from(document.querySelectorAll('input'));
      if (inputs.length >= 3) {
        inputs[0].value = user;
        inputs[1].value = loginName;
        inputs[2].value = password;
      }
    }, CONFIG.user, CONFIG.loginName, CONFIG.password);
    
    const botoes = await page.$$('button, input[type="submit"]');
    if (botoes.length > 0) {
      await botoes[0].click();
      console.log('✅ Botão de login clicado');
    }
    
    await delay(8000);
    console.log('✅ Login OK');
    
    // ACESSAR GRID
    console.log('📊 Acessando Grid...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const gridLink = links.find(a => a.innerText?.trim() === 'Grid');
      if (gridLink) gridLink.click();
    });
    
    await delay(5000);
    console.log('✅ Grid acessado');
    
    // Aguardar tabela carregar
    console.log('📊 Aguardando tabela de veículos...');
    await delay(3000);
    
    // EXTRAIR DADOS
    const dadosVeiculos = await page.evaluate(() => {
      const resultados = [];
      
      function limparTexto(texto) {
        if (!texto) return '';
        // Remove padrões como &MM1>&MR0... e &IDV...
        let limpo = texto.replace(/&[A-Z0-9]+>/g, ' ');
        limpo = limpo.replace(/&[A-Z0-9]+/g, ' ');
        limpo = limpo.replace(/\s+/g, ' ').trim();
        return limpo;
      }
      
      function extrairPlaca(texto) {
        const match = texto.match(/[A-Z]{3}[0-9]{4}|[A-Z]{3}[0-9][A-Z][0-9]{2}/g);
        if (match) {
          const prefixosCarreta = ['IDV', 'DSM', 'ATA', 'CZZ', 'CDL', 'EOF'];
          for (const p of match) {
            if (!prefixosCarreta.some(pre => p.startsWith(pre))) {
              return p.length === 7 ? `${p.substring(0, 3)}-${p.substring(3)}` : p;
            }
          }
        }
        return null;
      }

      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length >= 5) {
            const textoCompleto = cells.map(c => c.innerText).join(' ');
            const placa = extrairPlaca(textoCompleto);
            
            // --- AJUSTE NA LÓGICA DA ROTA ---
            // Procuramos em todas as células da linha pela que contém o separador " X "
            let rotaBruta = "";
            const celulaComRota = cells.find(c => c.innerText.includes(' X '));
            
            if (celulaComRota) {
              rotaBruta = celulaComRota.innerText;
            } else {
              // Se não achou o " X ", tenta pegar a célula que tem o maior texto (provavelmente a rota)
              rotaBruta = cells.reduce((prev, curr) => prev.innerText.length > curr.innerText.length ? prev : curr).innerText;
            }

            const rotaLimpa = limparTexto(rotaBruta);

            if (placa && rotaLimpa.length > 10) {
              resultados.push({ placa: placa, rota: rotaLimpa });
            }
          }
        }
      }
      
      // Remover duplicatas
      const unique = [];
      const placasVistas = new Set();
      for (const v of resultados) {
        if (!placasVistas.has(v.placa)) {
          placasVistas.add(v.placa);
          unique.push(v);
        }
      }
      return unique;
    });
    
    console.log(`✅ Encontrados ${dadosVeiculos.length} veículos com rota válida`);
    
    if (dadosVeiculos.length === 0) {
      console.log('⚠️ Nenhum veículo com rota válida encontrado');
      return;
    }
    
    // ATUALIZAR FIRESTORE
    console.log('\n📝 Atualizando Firebase...');
    const nomeColecao = 'veiculos';
    let atualizados = 0;
    
    for (const veiculo of dadosVeiculos) {
      try {
        const placaOriginal = veiculo.placa;
        const placaSemTraco = placaOriginal.replace(/-/g, '');
        
        let querySnapshot = await db.collection(nomeColecao)
          .where('placa', '==', placaOriginal)
          .limit(1).get();
        
        if (querySnapshot.empty) {
          querySnapshot = await db.collection(nomeColecao)
            .where('placa', '==', placaSemTraco)
            .limit(1).get();
        }
        
        if (!querySnapshot.empty) {
          await querySnapshot.docs[0].ref.update({
            rotaMonisat: veiculo.rota,
            ultimaAtualizacaoRotaMonisat: admin.firestore.Timestamp.now()
          });
          atualizados++;
          console.log(`✅ ${placaOriginal} atualizada.`);
        }
      } catch (error) {
        console.log(`❌ ${veiculo.placa}: ${error.message}`);
      }
    }
    
    console.log(`\n📈 RESUMO: ${atualizados} atualizados.`);
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
  } finally {
    if (browser) await browser.close();
    console.log('\n🏁 Finalizado\n');
  }
}

capturarRotas();