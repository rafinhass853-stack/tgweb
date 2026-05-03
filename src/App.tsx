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

  if (loading) return <div style={styles.loading}>Carregando sistema...</div>;

  return (
    <BrowserRouter>
      <Routes>
        {/* Rota para o Menu principal (protegida) */}
        <Route 
          path="/" 
          element={user ? <Menu /> : <Navigate to="/login" />} 
        />
        
        {/* Rota para login */}
        <Route 
          path="/login" 
          element={!user ? <Login /> : <Navigate to="/" />} 
        />
        
        {/* Rota para a lista de motoristas */}
        <Route 
          path="/motoristas" 
          element={user ? <ListaMotoristas onSelectMotorista={(id) => {
            console.log('Selecionado motorista:', id);
          }} /> : <Navigate to="/login" />} 
        />
        
        {/* Rota para a lista de veículos */}
        <Route 
          path="/veiculos" 
          element={user ? <ListaVeiculos /> : <Navigate to="/login" />} 
        />
        
        {/* Rota para o relatório de motoristas */}
        <Route 
          path="/relatorio-motoristas" 
          element={user ? <RelatorioListaMotorista /> : <Navigate to="/login" />} 
        />
        
        {/* Rota para o relatório de veículos */}
        <Route 
          path="/relatorio-veiculos" 
          element={user ? <RelatorioListaVeiculos /> : <Navigate to="/login" />} 
        />
        
        {/* Rota para qualquer outro caminho não encontrado */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

const styles = {
  loading: { 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh', 
    backgroundColor: '#1E2A44', 
    color: 'white',
    fontSize: '18px',
    fontFamily: 'Arial, sans-serif'
  }
};

export default App;