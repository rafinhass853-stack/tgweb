import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';

const ListaMotoristas = () => {
  const [lista, setLista] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'motoristas'), (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLista(docs);
    });
    return () => unsub();
  }, []);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
      {lista.map(m => (
        <div key={m.id} style={cardStyles.fifaCard}>
          <div style={cardStyles.cnhBadge}>{m.cnh}</div>
          <img src={m.fotoPerfilUrl || 'https://via.placeholder.com/100'} alt="Perfil" style={cardStyles.img} />
          <h3 style={{ margin: '10px 0 5px 0' }}>{m.nome.split(' ')[0]}</h3>
          <p style={{ fontSize: '12px' }}>{m.cidade}</p>
          <div style={{ background: 'rgba(0,0,0,0.1)', padding: '5px', width: '80%', borderRadius: '5px', margin: '10px 0' }}>
            <strong>MOPP:</strong> {m.mopp}
          </div>
          <a href={`https://wa.me/55${m.telefone}`} target="_blank" style={cardStyles.waBtn}>WhatsApp</a>
        </div>
      ))}
    </div>
  );
};

const cardStyles = {
  fifaCard: {
    width: '180px', height: '280px', background: 'linear-gradient(135deg, #FFC400 0%, #E6B100 100%)',
    borderRadius: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '15px', boxShadow: '0 5px 15px rgba(0,0,0,0.2)', position: 'relative' as 'relative'
  },
  cnhBadge: { position: 'absolute' as 'absolute', top: '10px', left: '10px', background: '#1E2A44', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' },
  img: { width: '90px', height: '90px', borderRadius: '50%', border: '3px solid white', objectFit: 'cover' as 'cover' },
  waBtn: { background: '#25D366', color: 'white', padding: '5px 10px', borderRadius: '5px', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold' }
};

export default ListaMotoristas;