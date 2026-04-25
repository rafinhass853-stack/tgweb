import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './Login';
import Menu from './Menu';

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
