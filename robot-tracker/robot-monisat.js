const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Função para converter placa
function converterPlaca(placaMonisat) {
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

// Vamos listar as coleções para debug
async function listarColecoes() {
  console.log('\n📁 Coleções no Firestore:');
  const collections = await db.listCollections();
  collections.forEach(col => console.log(`   - ${col.id}`));
}

const CONFIG = {
  url: 'https://site.monisat.com.br/index.php',
  user: 'TG',
  loginName: 'RAFAEL',
  password: 'ARAUJO',
  headless: process.env.HEADLESS === 'true'
};

async function capturarLocalizacoes() {
  console.log('\n🚀 INICIANDO CAPTURA MONISAT\n');
  
  // Listar coleções para debug
  await listarColecoes();
  
  let browser = null;
  
  try {
    browser = await puppeteer.launch({
      headless: false,  // Deixe false para ver o que acontece
      args: ['--no-sandbox', '--start-maximized']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    
    // LOGIN
    console.log('📝 Fazendo login...');
    await page.goto(CONFIG.url, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));
    
    const inputs = await page.$$('input');
    if (inputs.length >= 3) {
      await inputs[0].type(CONFIG.user);
      await inputs[1].type(CONFIG.loginName);
      await inputs[2].type(CONFIG.password);
    }
    
    const botoes = await page.$$('button, input[type="submit"]');
    if (botoes.length > 0) await botoes[0].click();
    
    await new Promise(r => setTimeout(r, 5000));
    console.log('✅ Login OK');
    
    // ACESSAR GRID
    console.log('📊 Acessando Grid...');
    
    await page.evaluate(() => {
      const elementos = Array.from(document.querySelectorAll('a, button, div, span'));
      const grid = elementos.find(el => 
        el.innerText && el.innerText.trim().toLowerCase() === 'grid'
      );
      if (grid) grid.click();
    });
    
    await new Promise(r => setTimeout(r, 5000));
    console.log('✅ Grid acessado');
    
    // EXTRAIR PLACAS E LOCALIZAÇÕES
    console.log('📊 Extraindo placas e localizações...');
    await new Promise(r => setTimeout(r, 3000));
    
    const dadosVeiculos = await page.evaluate(() => {
      const resultados = [];
      const linhas = document.querySelectorAll('tr');
      
      for (let linha of linhas) {
        const texto = linha.innerText;
        
        // Pegar todas as placas possíveis
        const placasEncontradas = texto.match(/[A-Z]{3}[0-9]{4}|[A-Z]{3}[0-9][A-Z][0-9]{2}/g) || [];
        
        for (let placa of placasEncontradas) {
          // Ignorar códigos internos
          const prefixosIgnorar = ['IDV', 'DSM', 'ATA', 'CZZ', 'CDL', 'EOF', 'FYI', 'AUD', 'EGJ', 'EGK', 'ETU', 'GDS', 'BPK', 'CUB', 'FSN', 'HJZ', 'ECZ', 'GIJ', 'BPZ', 'EJZ', 'PVB', 'IUS', 'CZB', 'DSK', 'DJC', 'AHY', 'GEU', 'MHY', 'BSY', 'BYI', 'AEX', 'FVC', 'FRD', 'DYT', 'FVH', 'DGY', 'GFG', 'GJE', 'FGL', 'GKB', 'GBD', 'BPQ', 'BYY', 'HMV', 'GEI', 'FWO', 'FRF'];
          
          const isIgnorar = prefixosIgnorar.some(prefix => placa.startsWith(prefix));
          
          if (!isIgnorar && placa.length >= 7) {
            let localizacao = '';
            
            const cidadeMatch = texto.match(/[A-Z]{2}\s*[-–]\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/);
            if (cidadeMatch) {
              localizacao = cidadeMatch[0];
            } else {
              const spMatch = texto.match(/SP\s*[-–]\s*([A-Z\s]+)/i);
              if (spMatch) localizacao = `SP - ${spMatch[1].trim()}`;
              
              const rjMatch = texto.match(/RJ\s*[-–]\s*([A-Z\s]+)/i);
              if (rjMatch) localizacao = `RJ - ${rjMatch[1].trim()}`;
              
              const mgMatch = texto.match(/MG\s*[-–]\s*([A-Z\s]+)/i);
              if (mgMatch) localizacao = `MG - ${mgMatch[1].trim()}`;
            }
            
            resultados.push({ placa: placa, localizacao: localizacao || 'Localização não disponível' });
            break;
          }
        }
      }
      
      // Remover duplicatas
      const unique = [];
      const placasVistas = new Set();
      for (let v of resultados) {
        if (!placasVistas.has(v.placa)) {
          placasVistas.add(v.placa);
          unique.push(v);
        }
      }
      
      return unique;
    });
    
    console.log(`✅ Encontrados ${dadosVeiculos.length} veículos`);
    
    if (dadosVeiculos.length === 0) {
      console.log('⚠️ Nenhum veículo encontrado');
      return;
    }
    
    console.log('\n📋 Primeiros veículos:');
    dadosVeiculos.slice(0, 10).forEach(v => {
      console.log(`   ${v.placa} : ${v.localizacao}`);
    });
    
    // ATUALIZAR FIRESTORE - Tentar com e sem traço
    console.log('\n📝 Atualizando Firebase...');
    
    // Determinar o nome correto da coleção
    const nomeColecao = 'veiculos'; // sem acento
    
    let atualizados = 0;
    let naoEncontrados = 0;
    
    for (const veiculo of dadosVeiculos) {
      try {
        // Tentar buscar com a placa original (sem traço)
        let querySnapshot = await db.collection(nomeColecao)
          .where('placa', '==', veiculo.placa)
          .limit(1)
          .get();
        
        // Se não achou, tentar com traço
        if (querySnapshot.empty) {
          const placaComTraco = converterPlaca(veiculo.placa);
          querySnapshot = await db.collection(nomeColecao)
            .where('placa', '==', placaComTraco)
            .limit(1)
            .get();
        }
        
        // Se não achou, tentar pelo ID do documento
        if (querySnapshot.empty) {
          const docRef = db.collection(nomeColecao).doc(veiculo.placa);
          const doc = await docRef.get();
          if (doc.exists) {
            querySnapshot = { docs: [doc], empty: false };
          }
        }
        
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          await doc.ref.update({
            ultimaLocalizacao: veiculo.localizacao,
            ultimaAtualizacaoRastreador: admin.firestore.Timestamp.now(),
            statusRastreador: 'online',
            ultimaConsulta: new Date().toISOString()
          });
          atualizados++;
          console.log(`✅ ${veiculo.placa} : ${veiculo.localizacao}`);
        } else {
          naoEncontrados++;
          if (naoEncontrados < 20) {
            console.log(`⚠️ ${veiculo.placa} : Não cadastrado`);
          }
        }
      } catch (error) {
        console.log(`❌ ${veiculo.placa}: ${error.message}`);
      }
    }
    
    console.log(`\n📈 RESUMO:`);
    console.log(`   ✅ Atualizados: ${atualizados}`);
    console.log(`   ⚠️ Não cadastrados: ${naoEncontrados}`);
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
  } finally {
    if (browser) await browser.close();
    console.log('\n🏁 Finalizado\n');
  }
}

// Executar
capturarLocalizacoes();