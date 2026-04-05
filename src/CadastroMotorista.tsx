import React, { useState } from 'react';
import { db, storage } from 'firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const CadastroMotorista = () => {
  const [formData, setFormData] = useState({
    nome: '', cpf: '', cnhCategoria: '', whatsapp: '', 
    cidade: '', temMopp: 'Não'
  });
  const [fotoPerfil, setFotoPerfil] = useState<File | null>(null);
  const [fotoCNH, setFotoCNH] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (file: File, path: string) => {
    const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const urlPerfil = fotoPerfil ? await handleUpload(fotoPerfil, 'perfil') : '';
      const urlCNH = fotoCNH ? await handleUpload(fotoCNH, 'docs_cnh') : '';

      await addDoc(collection(db, 'motoristas'), {
        ...formData,
        fotoPerfilUrl: urlPerfil,
        fotoCnhUrl: urlCNH,
        createdAt: new Date()
      });

      alert('Motorista cadastrado com sucesso!');
      // Limpar campos aqui...
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar no Firebase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Novo Cadastro de Motorista</h2>
      <form onSubmit={handleSubmit} style={styles.formGrid}>
        <input type="text" placeholder="Nome Completo" required onChange={e => setFormData({...formData, nome: e.target.value})} style={styles.input} />
        <input type="text" placeholder="CPF" required onChange={e => setFormData({...formData, cpf: e.target.value})} style={styles.input} />
        <input type="text" placeholder="Categoria CNH (ex: D, E)" onChange={e => setFormData({...formData, cnhCategoria: e.target.value})} style={styles.input} />
        <input type="text" placeholder="WhatsApp (DDD + Número)" onChange={e => setFormData({...formData, whatsapp: e.target.value})} style={styles.input} />
        <input type="text" placeholder="Cidade de Residência" onChange={e => setFormData({...formData, cidade: e.target.value})} style={styles.input} />
        
        <select onChange={e => setFormData({...formData, temMopp: e.target.value})} style={styles.input}>
          <option value="Não">Possui MOPP? Não</option>
          <option value="Sim">Possui MOPP? Sim</option>
        </select>

        <div style={styles.fileBox}>
          <label>Foto de Perfil:</label>
          <input type="file" accept="image/*" onChange={e => setFotoPerfil(e.target.files?.[0] || null)} />
        </div>

        <div style={styles.fileBox}>
          <label>Foto da CNH (JPG/PDF):</label>
          <input type="file" accept="image/*,application/pdf" onChange={e => setFotoCNH(e.target.files?.[0] || null)} />
        </div>

        <button type="submit" disabled={loading} style={styles.submitBtn}>
          {loading ? 'Salvando...' : 'FINALIZAR CADASTRO'}
        </button>
      </form>
    </div>
  );
};

// Estilos rápidos para o form
const styles: { [key: string]: React.CSSProperties } = {
  container: { backgroundColor: 'white', padding: '30px', borderRadius: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
  title: { color: '#1E2A44', marginBottom: '20px', borderLeft: '5px solid #FFC400', paddingLeft: '15px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  input: { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px' },
  fileBox: { display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px', fontWeight: 'bold' },
  submitBtn: { gridColumn: 'span 2', padding: '15px', backgroundColor: '#1E2A44', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '10px' }
};

export default CadastroMotorista;