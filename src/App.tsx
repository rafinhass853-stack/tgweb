import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase';
import { auth, db } from './firebase';
import Login from './Login';
import Menu from './Menu'; // O arquivo que criamos com o Sidebar

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Monitora se o usuário está logado ou não no Firebase
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div style={styles.loading}>Carregando sistema...</div>;

  // Se tiver usuário, mostra o Menu (Dashboard), se não, mostra o Login
  return (
    <>
      {user ? <Menu /> : <Login />}
    </>
  );
}

const styles = {
  loading: { 
    display: 'flex', justifyContent: 'center', alignItems: 'center', 
    height: '100vh', backgroundColor: '#1E2A44', color: 'white' 
  }
};

export default App;