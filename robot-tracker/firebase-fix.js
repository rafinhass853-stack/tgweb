const admin = require('firebase-admin');
require('dotenv').config();

// Chave de serviço
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar com opções adicionais
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

console.log('🔧 FORÇANDO TESTE DE PERMISSÃO\n');

async function forcarPermissao() {
  try {
    // Tentativa 1: Listar coleções
    console.log('📝 1. Tentando listar veículos...');
    const veiculosRef = db.collection('veiculos');
    const snapshot = await veiculosRef.limit(1).get();
    console.log(`✅ Sucesso! Encontrado ${snapshot.size} veículo(s)`);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      console.log(`   Exemplo: ${doc.id} -> Placa: ${doc.data().placa}`);
    }
    
    // Tentativa 2: Criar documento de teste
    console.log('\n📝 2. Tentando criar documento de teste...');
    const testRef = db.collection('_testes').doc('permissao_check');
    await testRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      message: 'Teste de permissão',
      source: 'firebase-fix'
    });
    console.log('✅ Documento de teste criado!');
    
    // Tentativa 3: Ler o documento
    console.log('\n📝 3. Tentando ler documento de teste...');
    const testDoc = await testRef.get();
    if (testDoc.exists) {
      console.log('✅ Leitura do documento OK!');
      console.log(`   Dados: ${JSON.stringify(testDoc.data())}`);
    }
    
    // Limpar
    await testRef.delete();
    console.log('\n✅ Documento de teste removido');
    
    console.log('\n🎉 SUCESSO! O Firebase está funcionando!');
    console.log('\nAgora execute o robô novamente:');
    console.log('node robot-monisat.js');
    
  } catch (error) {
    console.error(`\n❌ ERRO: ${error.message}`);
    console.log('\n🔧 SOLUÇÃO MANUAL:');
    console.log('1. Acesse: https://console.firebase.google.com/project/projeto-tg-edef9/firestore/rules');
    console.log('2. Clique em "Editar regras"');
    console.log('3. Delete tudo e cole o código abaixo:');
    console.log('\n' + '='.repeat(50));
    console.log(`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permite tudo para testes
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`);
    console.log('='.repeat(50));
    console.log('\n4. Clique em "Publicar"');
    console.log('5. Aguarde 2 minutos');
    console.log('6. Execute este script novamente');
  }
}

forcarPermissao();