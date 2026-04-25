const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

console.log('🧪 TESTANDO CONEXÃO COM FIREBASE...');

// Carregar a chave de serviço
let serviceAccount;
try {
  serviceAccount = require('./serviceAccountKey.json');
  console.log('✅ Arquivo serviceAccountKey.json carregado');
} catch (error) {
  console.error('❌ Erro ao carregar serviceAccountKey.json:', error.message);
  process.exit(1);
}

// Inicializar Firebase
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase inicializado');
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase:', error.message);
  process.exit(1);
}

const db = admin.firestore();

async function testarPermissoes() {
  console.log('\n📝 Testando permissões do Firestore...');
  
  try {
    // Tentar criar um documento de teste
    const testDoc = db.collection('veiculos').doc('teste_permissao');
    await testDoc.set({
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Teste de permissão'
    });
    console.log('✅ Escrita permitida! Documento criado com sucesso.');
    
    // Tentar ler o documento
    const doc = await testDoc.get();
    if (doc.exists) {
      console.log('✅ Leitura permitida! Dados lidos com sucesso.');
      console.log('   Dados:', doc.data());
    }
    
    // Tentar deletar o documento de teste
    await testDoc.delete();
    console.log('✅ Deleção permitida! Documento removido com sucesso.');
    
    console.log('\n🎉 Todas as operações funcionaram! O Firebase está OK.');
    
    // Listar veículos existentes
    const veiculos = await db.collection('veiculos').limit(5).get();
    console.log(`\n📋 Veículos encontrados: ${veiculos.size}`);
    veiculos.forEach(doc => {
      console.log(`   - ${doc.id}: ${doc.data().placa || 'Sem placa'}`);
    });
    
  } catch (error) {
    console.error('\n❌ ERRO DE PERMISSÃO:', error.message);
    console.log('\n🔧 Possíveis soluções:');
    console.log('1. Verifique se o arquivo serviceAccountKey.json é válido');
    console.log('2. No Firebase Console, vá em Configurações do Projeto > Contas de Serviço');
    console.log('3. Gere uma nova chave privada e substitua o arquivo');
    console.log('4. Aguarde alguns minutos para as regras serem aplicadas');
  }
}

testarPermissoes();