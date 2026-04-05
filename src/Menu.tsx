import React, { useState } from 'react';
import { auth, db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';
// Importaremos os componentes de conteúdo abaixo
import CadastroMotorista from './CadastroMotorista';
import ListaMotoristas from './ListaMotoristas';
import CadastroVeiculo from './CadastroVeiculo';
import ListaVeiculos from './ListaVeiculos';

const Menu = () => {
  const [activeTab, setActiveTab] = useState('motoristas-cad');

  const handleLogout = () => {
    auth.signOut();
    window.location.href = '/';
  };

  return (
    <div style={styles.dashboard}>
      {/* Sidebar Esquerda */}
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <img src="/src/assets/tg-logo.png" alt="Logo" style={styles.miniLogo} />
          <h3 style={styles.title}>Gestão Logística</h3>
        </div>

        <nav style={styles.nav}>
          <p style={styles.menuLabel}>MOTORISTAS</p>
          <button 
            style={activeTab === 'motoristas-cad' ? styles.activeBtn : styles.navBtn}
            onClick={() => setActiveTab('motoristas-cad')}
          >
            ➕ Cadastro
          </button>
          <button 
            style={activeTab === 'motoristas-list' ? styles.activeBtn : styles.navBtn}
            onClick={() => setActiveTab('motoristas-list')}
          >
            📇 Motoristas Cadastrados
          </button>

          <p style={styles.menuLabel}>VEÍCULOS</p>
          <button 
            style={activeTab === 'veiculos-cad' ? styles.activeBtn : styles.navBtn}
            onClick={() => setActiveTab('veiculos-cad')}
          >
            🚛 Cadastro de Veículos
          </button>
          <button 
            style={activeTab === 'veiculos-list' ? styles.activeBtn : styles.navBtn}
            onClick={() => setActiveTab('veiculos-list')}
          >
            📋 Frota Cadastrada
          </button>
        </nav>

        <button onClick={handleLogout} style={styles.logoutBtn}>Sair</button>
      </aside>

      {/* Conteúdo Principal */}
      <main style={styles.content}>
        {activeTab === 'motoristas-cad' && <CadastroMotorista />}
        {activeTab === 'motoristas-list' && <ListaMotoristas />}
        {activeTab === 'veiculos-cad' && <CadastroVeiculo />}
        {activeTab === 'veiculos-list' && <ListaVeiculos />}
      </main>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  dashboard: { display: 'flex', minHeight: '100vh', backgroundColor: '#f4f7f6' },
  sidebar: { 
    width: '260px', 
    backgroundColor: '#1E2A44', 
    color: 'white', 
    display: 'flex', 
    flexDirection: 'column',
    padding: '20px' 
  },
  logoArea: { textAlign: 'center', marginBottom: '30px', borderBottom: '1px solid #34495e', paddingBottom: '15px' },
  miniLogo: { width: '120px' },
  title: { fontSize: '16px', color: '#FFC400', marginTop: '10px' },
  nav: { flexGrow: 1 },
  menuLabel: { fontSize: '12px', color: '#888', margin: '20px 0 10px 10px', fontWeight: 'bold' },
  navBtn: { 
    width: '100%', padding: '12px', textAlign: 'left', backgroundColor: 'transparent', 
    border: 'none', color: 'white', cursor: 'pointer', borderRadius: '8px', marginBottom: '5px' 
  },
  activeBtn: { 
    width: '100%', padding: '12px', textAlign: 'left', backgroundColor: '#FFC400', 
    border: 'none', color: '#1E2A44', cursor: 'pointer', borderRadius: '8px', marginBottom: '5px', fontWeight: 'bold' 
  },
  content: { flexGrow: 1, padding: '30px', overflowY: 'auto' },
  logoutBtn: { padding: '10px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }
};

export default Menu;