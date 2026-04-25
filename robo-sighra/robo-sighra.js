const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
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
  headless: process.env.HEADLESS === 'true'
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
  console.log('\n🚀 INICIANDO CAPTURA SIGHRA\n');
  
  let browser = null;
  
  try {
    browser = await puppeteer.launch({
      headless: CONFIG.headless === 'true' ? 'new' : false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    
    // 1. LOGIN
    console.log('📝 Fazendo login...');
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
    }
    
    if (campoSenha) {
      await campoSenha.click({ clickCount: 3 });
      await campoSenha.type(CONFIG.password);
    }
    
    const botoes = await page.$$('button, input[type="submit"]');
    if (botoes.length > 0) {
      await botoes[0].click();
    }
    
    await delay(5000);
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
        const geralItem = document.querySelector('li.feed-item');
        if (geralItem) {
          const link = geralItem.querySelector('a');
          if (link) {
            link.click();
            return true;
          }
        }
        return false;
      });
    }
    
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
      await delay(3000);
    }
    
    // 3. CLICAR EM "RASTREAMENTO"
    console.log('📊 Procurando "Rastreamento"...');
    await delay(2000);
    
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
      await delay(5000);
    }
    
    // 4. AGUARDAR TABELA CARREGAR
    console.log('📊 Aguardando tabela carregar...');
    
    try {
      await page.waitForSelector('#mainForm\\:tablePosicoes tbody tr', { timeout: 30000 });
      console.log('✅ Tabela carregou!');
    } catch (error) {
      console.log('⚠️ Timeout aguardando tabela');
    }
    
    await delay(3000);
    
    // 5. EXTRAIR DADOS - APENAS O NECESSÁRIO
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
        if (cells.length >= 18) {
          // Placa está na coluna 3 (índice 2)
          const placa = cells[2]?.innerText?.trim() || '';
          
          // Latitude está na coluna 6 (índice 5) - vem como "-22,83330"
          let latitudeRaw = cells[5]?.innerText?.trim() || '';
          // Converter vírgula para ponto
          let latitude = latitudeRaw.replace(',', '.');
          
          // Longitude está na coluna 7 (índice 6)
          let longitudeRaw = cells[6]?.innerText?.trim() || '';
          let longitude = longitudeRaw.replace(',', '.');
          
          // Macro está na coluna 15 (índice 14) - é o status/macro do veículo
          const macro = cells[14]?.innerText?.trim() || '';
          
          // Local está na coluna 19 (índice 18) - "Local"
          const local = cells[18]?.innerText?.trim() || '';
          
          // Logradouro está na coluna 18 (índice 17) - "Logradouro"
          const logradouro = cells[17]?.innerText?.trim() || '';
          
          // Construir o endereço completo
          let endereco = '';
          if (logradouro && logradouro !== 'Não foi possível definir') {
            endereco = logradouro;
            if (local && local !== logradouro) {
              endereco += ` - ${local}`;
            }
          } else if (local) {
            endereco = local;
          }
          
          if (placa && placa.length >= 7) {
            resultados.push({
              placa: placa,
              latitude: latitude ? parseFloat(latitude) : null,
              longitude: longitude ? parseFloat(longitude) : null,
              macro: macro,
              localizacao: endereco || 'Localização não disponível',
              logradouro: logradouro,
              local: local
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
    
    // Mostrar preview dos dados
    console.log('\n📋 Dados extraídos (primeiros 5):');
    veiculos.slice(0, 5).forEach(v => {
      console.log(`   ${v.placa} | Lat: ${v.latitude} | Lng: ${v.longitude} | Macro: ${v.macro} | Local: ${v.localizacao.substring(0, 40)}`);
    });
    
    // 6. ATUALIZAR FIRESTORE - APENAS OS CAMPOS NECESSÁRIOS
    console.log('\n📝 Atualizando Firebase...');
    
    let atualizados = 0;
    let naoEncontrados = 0;
    
    for (const veiculo of veiculos) {
      try {
        const placaFormatada = converterPlaca(veiculo.placa);
        
        // Buscar veículo pela placa
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
          
          // Atualizar APENAS os campos necessários
          await doc.ref.update({
            // Campos principais de localização
            ultimaLocalizacao: veiculo.localizacao,
            ultimoEndereco: veiculo.localizacao,
            coordenadas: {
              lat: veiculo.latitude,
              lng: veiculo.longitude
            },
            // Macro/status do veículo
            ultimaMacro: veiculo.macro,
            // Timestamp da captura
            ultimaAtualizacaoRastreador: admin.firestore.Timestamp.now(),
            statusRastreador: 'online',
            fonte: 'SIGHRA',
            ultimaConsulta: new Date().toISOString(),
            // Campos auxiliares
            ultimaLatitude: veiculo.latitude,
            ultimaLongitude: veiculo.longitude,
            velocidade: 0 // Padrão, não temos velocidade no momento
          });
          
          atualizados++;
          console.log(`✅ ${veiculo.placa} atualizado`);
        } else {
          naoEncontrados++;
          if (naoEncontrados < 10) {
            console.log(`⚠️ ${veiculo.placa} : Não cadastrado no Firebase`);
          }
        }
      } catch (error) {
        console.log(`❌ ${veiculo.placa}: ${error.message}`);
      }
    }
    
    console.log(`\n📈 RESUMO:`);
    console.log(`   ✅ Atualizados: ${atualizados}`);
    console.log(`   ⚠️ Não cadastrados: ${naoEncontrados}`);
    console.log(`   📊 Total de veículos no SIGHRA: ${veiculos.length}`);
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    if (browser) {
      const page = (await browser.pages())[0];
      if (page) {
        await page.screenshot({ path: './erro-screenshot.png' });
        console.log('📸 Screenshot do erro salvo: erro-screenshot.png');
      }
    }
  } finally {
    if (browser) await browser.close();
    console.log('\n🏁 Finalizado\n');
  }
}

// Executar
capturarLocalizacoes();