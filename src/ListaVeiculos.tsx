import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';

const ListaVeiculos = () => {
  const [veiculos, setVeiculos] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'veiculos'), (snap) => {
      setVeiculos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
      {veiculos.map(v => (
        <div key={v.id} style={{ background: 'white', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
          <h4>🚛 {v.placa}</h4>
          <p>Tipo: {v.tipo}</p>
          <p>Paletes: {v.capacidade}</p>
        </div>
      ))}
    </div>
  );
};

export default ListaVeiculos;