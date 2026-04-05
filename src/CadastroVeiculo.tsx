import React, { useState } from 'react';
import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';

const CadastroVeiculo = () => {
  const [placa, setPlaca] = useState('');
  const [tipo, setTipo] = useState('toco');
  const [capacidade, setCapacidade] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'veiculos'), {
        placa, tipo, capacidade, data: new Date()
      });
      alert('✅ Veículo cadastrado!');
    } catch (error) {
      alert('❌ Erro ao salvar veículo.');
    }
  };

  return (
    <div style={{ padding: '20px', background: 'white', borderRadius: '10px' }}>
      <h2 style={{ color: '#1E2A44' }}>Cadastro de Veículo</h2>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input placeholder="Placa" onChange={e => setPlaca(e.target.value)} style={{ padding: '10px' }} />
        <select onChange={e => setTipo(e.target.value)} style={{ padding: '10px' }}>
          <option value="toco">Toco (2 eixos)</option>
          <option value="trucado">Trucado (3 eixos)</option>
          <option value="truck">Truck (Cavalo + Carreta)</option>
        </select>
        <input placeholder="Capacidade de Paletes" onChange={e => setCapacidade(e.target.value)} style={{ padding: '10px' }} />
        <button type="submit" style={{ padding: '15px', background: '#1E2A44', color: 'white', border: 'none' }}>
          CADASTRAR VEÍCULO
        </button>
      </form>
    </div>
  );
};

export default CadastroVeiculo;