// src/App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

import Login from './Login';
import Menu from './Menu';
import ListaMotoristas from './ListaMotoristas';
import ListaVeiculos from './ListaVeiculos';
import RelatorioListaMotorista from './RelatorioListaMotorista';
import RelatorioListaVeiculos from './RelatorioListaVeiculos';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1E2A44',
        color: 'white',
        fontSize: '18px'
      }}>
        Carregando sistema...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        
        <Route path="/" element={user ? <Menu /> : <Navigate to="/login" />} />
        
        <Route 
          path="/motoristas" 
          element={user ? <ListaMotoristas /> : <Navigate to="/login" />} 
        />
        
        <Route 
          path="/veiculos" 
          element={user ? <ListaVeiculos /> : <Navigate to="/login" />} 
        />
        
        <Route 
          path="/relatorio-motoristas" 
          element={user ? <RelatorioListaMotorista /> : <Navigate to="/login" />} 
        />
        
        <Route 
          path="/relatorio-veiculos" 
          element={user ? <RelatorioListaVeiculos /> : <Navigate to="/login" />} 
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;