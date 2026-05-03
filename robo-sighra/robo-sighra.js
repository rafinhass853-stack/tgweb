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
    
    // 5. EXTRAIR DADOS
    console.log('📊 Extraindo dados dos veículos...');
    
    // Mapeamento manual dos índices baseado nos cabeçalhos
    const veiculos = await page.evaluate(() => {
      const resultados = [];
      
      const tabela = document.querySelector('#mainForm\\:tablePosicoes');
      if (!tabela) return resultados;
      
      const tbody = tabela.querySelector('tbody');
      if (!tbody) return resultados;
      
      const rows = tbody.querySelectorAll('tr');
      
      // ÍNDICES CONHECIDOS (baseado no cabeçalho):
      // 0: Ação
      // 1: Veículo
      // 2: Placa
      // 3: Frota
      // 4: Data Posição
      // 5: Latitude
      // 6: Longitude
      // 7: Curso
      // 8: Vel.
      // 9: Vel.Máx
      // 10: Alarme
      // 11: Ignição  <-- ÍNDICE DA IGNIÇÃO (chave verde/vermelha)
      // 12: Login
      // 13: Motorista
      // 14: Macro
      // 15: Data Macro
      // 16: Cliente
      // 17: Logradouro
      // 18: Local
      // 19: PA Sat.
      // 20: Data PA. Sat
      // 21: Obs
      // 22: Obs2
      // 23: Obs3
      
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        
        if (cells.length >= 18) {
          // Placa - índice 2
          const placa = cells[2]?.innerText?.trim() || '';
          
          // Latitude - índice 5
          let latitudeRaw = cells[5]?.innerText?.trim() || '';
          let latitude = latitudeRaw ? parseFloat(latitudeRaw.replace(',', '.')) : null;
          
          // Longitude - índice 6
          let longitudeRaw = cells[6]?.innerText?.trim() || '';
          let longitude = longitudeRaw ? parseFloat(longitudeRaw.replace(',', '.')) : null;
          
          // Velocidade - índice 8
          let velocidade = 0;
          let velocidadeRaw = cells[8]?.innerText?.trim() || '';
          if (velocidadeRaw && !isNaN(parseFloat(velocidadeRaw))) {
            velocidade = parseFloat(velocidadeRaw);
          }
          
          // IGNIÇÃO - índice 11 (coluna "Ignição")
          // Esta coluna contém uma imagem/ícone de chave verde ou vermelha
          let ignicao = 'DESCONHECIDO';
          const ignicaoCell = cells[11];
          
          if (ignicaoCell) {
            const ignicaoHtml = ignicaoCell.innerHTML?.trim() || '';
            const ignicaoTexto = ignicaoCell.innerText?.trim() || '';
            
            // Procura por imagem/ícone de chave
            // Chave VERDE = Ignição LIGADA
            // Chave VERMELHA = Ignição DESLIGADA
            
            // Verifica no HTML
            if (ignicaoHtml) {
              // Cor VERDE (ligado)
              if (ignicaoHtml.includes('green') || 
                  ignicaoHtml.includes('success') ||
                  ignicaoHtml.includes('verde') ||
                  ignicaoHtml.includes('ligado') ||
                  ignicaoHtml.includes('online') ||
                  (ignicaoHtml.toLowerCase().includes('verde') && ignicaoHtml.toLowerCase().includes('chave')) ||
                  ignicaoHtml.includes('color:green') ||
                  ignicaoHtml.includes('color:#0f0') ||
                  ignicaoHtml.includes('color:#00ff00')) {
                ignicao = 'LIGADO';
              } 
              // Cor VERMELHA (desligado)
              else if (ignicaoHtml.includes('red') || 
                       ignicaoHtml.includes('danger') ||
                       ignicaoHtml.includes('vermelho') ||
                       ignicaoHtml.includes('desligado') ||
                       ignicaoHtml.includes('offline') ||
                       (ignicaoHtml.toLowerCase().includes('vermelho') && ignicaoHtml.toLowerCase().includes('chave')) ||
                       ignicaoHtml.includes('color:red') ||
                       ignicaoHtml.includes('color:#f00') ||
                       ignicaoHtml.includes('color:#ff0000')) {
                ignicao = 'DESLIGADO';
              }
              
              // Verifica se tem imagem (src) com nome que indica cor
              const imgMatch = ignicaoHtml.match(/src="[^"]*(verde|vermelho|green|red)[^"]*"/i);
              if (imgMatch) {
                if (imgMatch[1].toLowerCase().includes('verde') || imgMatch[1].toLowerCase().includes('green')) {
                  ignicao = 'LIGADO';
                } else if (imgMatch[1].toLowerCase().includes('vermelho') || imgMatch[1].toLowerCase().includes('red')) {
                  ignicao = 'DESLIGADO';
                }
              }
            }
            
            // Se ainda não identificou, tenta pelo texto
            if (ignicao === 'DESCONHECIDO' && ignicaoTexto) {
              const textoLower = ignicaoTexto.toLowerCase();
              if (textoLower.includes('ligado') || textoLower.includes('on') || textoLower.includes('ativo') || textoLower.includes('verde')) {
                ignicao = 'LIGADO';
              } else if (textoLower.includes('desligado') || textoLower.includes('off') || textoLower.includes('inativo') || textoLower.includes('vermelho')) {
                ignicao = 'DESLIGADO';
              }
            }
          }
          
          // LOCALIZAÇÃO - Logradouro (índice 17) e Local (índice 18)
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
          
          // Macro (índice 14)
          const macro = cells[14]?.innerText?.trim() || '';
          
          if (placa && placa.length >= 7) {
            resultados.push({
              placa: placa,
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
    
    // Mostrar preview dos dados
    console.log('\n📋 Dados extraídos (primeiros 5):');
    veiculos.slice(0, 5).forEach(v => {
      const statusIcon = v.ignicao === 'LIGADO' ? '🟢' : (v.ignicao === 'DESLIGADO' ? '🔴' : '⚪');
      console.log(`   ${v.placa} | Vel: ${v.velocidade} km/h | ${statusIcon} Ignição: ${v.ignicao}`);
      console.log(`        📍 Localização: ${v.localizacao}`);
      console.log(`        🗺️ Coord: ${v.latitude}, ${v.longitude}`);
      if (v.macro) console.log(`        🏷️ Macro: ${v.macro}`);
    });
    
    // 6. ATUALIZAR FIRESTORE
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
            ultimaAtualizacaoRastreador: admin.firestore.Timestamp.now(),
            statusRastreador: 'online',
            fonte: 'SIGHRA',
            ultimaConsulta: new Date().toISOString(),
            ultimaLatitude: veiculo.latitude,
            ultimaLongitude: veiculo.longitude
          };
          
          await doc.ref.update(dadosAtualizacao);
          
          atualizados++;
          const statusIcon = veiculo.ignicao === 'LIGADO' ? '🟢' : (veiculo.ignicao === 'DESLIGADO' ? '🔴' : '⚪');
          console.log(`✅ ${veiculo.placa} | Vel: ${veiculo.velocidade}km/h | ${statusIcon} ${veiculo.ignicao} | 📍 ${veiculo.localizacao.substring(0, 40)}`);
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
      const pages = await browser.pages();
      if (pages.length > 0) {
        await pages[0].screenshot({ path: './erro-screenshot.png' });
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