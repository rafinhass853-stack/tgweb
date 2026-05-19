import React, { useState } from 'react';
import { auth } from './firebase';
import ListaMotoristas from './ListaMotoristas';
import ListaVeiculos from './ListaVeiculos';
import ListaCarretas from './ListaCarretas';
import MenuMotorista from './MenuMotorista';
// import ProgramacaoMapa from './ProgramacaoMapa'; // COMENTADO - DESATIVADO
import InserirProgramacao from './InserirProgramacao';
// import VisualizarProgramacoes from './VisualizarProgramacoes'; // COMENTADO - DESATIVADO
import LeadTime from './LeadTime';
import Documentacao from './Documentacao';
import EscalaTodosMotoristas from './EscalaTodosMotoristas';

// Definição de tipos
type MenuItemType = {
  id: string;
  label: string;
  icon: string;
  color: string;
  isSection?: boolean;
  children?: MenuChildItemType[];
};

type MenuChildItemType = {
  id: string;
  label: string;
  icon: string;
  color: string;
  disabled?: boolean;
};

const Menu = () => {
  const [activeTab, setActiveTab] = useState<
    'monitoramento' | 
    'frota-motoristas' | 
    'frota-veiculos' |
    'cargas-inserir' |
    'frota-escala-geral'
    // 'cargas-visualizar' // REMOVIDO
  >('frota-motoristas'); // ALTERADO: agora começa em frota-motoristas

  const [selectedMotoristaId, setSelectedMotoristaId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [expandedFrota, setExpandedFrota] = useState(true);
  const [expandedCargas, setExpandedCargas] = useState(true);
  const [expandedEmDesenvolvimento, setExpandedEmDesenvolvimento] = useState(false);

  const handleLogout = () => {
    auth.signOut();
    window.location.href = '/';
  };

  const handleSelectMotorista = (id: string) => {
    setSelectedMotoristaId(id);
  };

  const handleVoltarParaLista = () => {
    setSelectedMotoristaId(null);
  };

  const menuItems: MenuItemType[] = [
    // BLOCO MONITORAMENTO REMOVIDO - DESATIVADO
    // {
    //   id: 'monitoramento',
    //   label: 'Monitoramento',
    //   icon: '🗺️',
    //   color: '#FFD700'
    // },
    {
      id: 'frota',
      label: 'Frota',
      icon: '🚛',
      color: '#FFD700',
      isSection: true,
      children: [
        { id: 'frota-motoristas', label: 'Motoristas', icon: '👤', color: '#FFD700' },
        { id: 'frota-veiculos', label: 'Veículos', icon: '🚙', color: '#FFD700' },
        { id: 'frota-escala-geral', label: 'Escala Geral', icon: '📅', color: '#FFD700' }
      ]
    },
    {
      id: 'cargas',
      label: 'Cargas',
      icon: '📊',
      color: '#FFD700',
      isSection: true,
      children: [
        { id: 'cargas-inserir', label: 'Inserir Programação', icon: '➕', color: '#FFD700' }
        // { id: 'cargas-visualizar', label: 'Visualizar Programações', icon: '👁️', color: '#FFD700' } // REMOVIDO - DESATIVADO
      ]
    },
    {
      id: 'em-desenvolvimento',
      label: 'Em Desenvolvimento',
      icon: '🚧',
      color: '#FFA500',
      isSection: true,
      children: [
        { id: 'frota-carretas', label: 'Carretas', icon: '📦', color: '#FFA500', disabled: true },
        { id: 'cargas-leadtime', label: 'Lead Time', icon: '⏱️', color: '#FFA500', disabled: true },
        { id: 'cargas-documentacao', label: 'Documentação', icon: '📄', color: '#FFA500', disabled: true }
      ]
    }
  ];

  const getCurrentTitle = () => {
    // if (activeTab === 'monitoramento') return 'Monitoramento'; // REMOVIDO
    if (activeTab === 'frota-motoristas') return 'Motoristas Cadastrados';
    if (activeTab === 'frota-veiculos') return 'Veículos Cadastrados';
    if (activeTab === 'frota-escala-geral') return 'Escala Geral de Motoristas';
    if (activeTab === 'cargas-inserir') return 'Inserir Programação';
    // if (activeTab === 'cargas-visualizar') return 'Visualizar Programações'; // REMOVIDO
    return 'Dashboard';
  };

  const getCurrentSubtitle = () => {
    // if (activeTab === 'monitoramento') return 'Acompanhamento em tempo real'; // REMOVIDO
    if (activeTab === 'frota-motoristas') return 'Gerencie os motoristas da sua frota';
    if (activeTab === 'frota-veiculos') return 'Gerencie os veículos da sua frota';
    if (activeTab === 'frota-escala-geral') return 'Controle unificado de presenças e folgas';
    if (activeTab === 'cargas-inserir') return 'Cadastre novas cargas no sistema';
    // if (activeTab === 'cargas-visualizar') return 'Acompanhe e gerencie todas as cargas'; // REMOVIDO
    return 'Gerencie sua frota de forma eficiente';
  };

  const handleDisabledClick = (itemLabel: string) => {
    alert(`🚧 O módulo "${itemLabel}" está em desenvolvimento e será disponibilizado em breve!`);
  };

  return (
    <div style={dashboardStyle}>
      {/* Sidebar */}
      <div style={{ ...sidebarStyle, width: sidebarCollapsed ? '80px' : '280px' }}>
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)} 
          style={collapseButtonStyle}
          title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {sidebarCollapsed ? '→' : '←'}
        </button>

        <div style={logoStyle}>
          {!sidebarCollapsed ? (
            <div style={logoWrapperStyle}>
              <img src="/tg-logo.png" alt="TG Logística" style={logoImageStyle} />
              <p style={logoSubtitleStyle}>Painel Gestor</p>
            </div>
          ) : (
            <div style={logoIconStyle}>
               <img src="/tg-logo.png" alt="TG" style={{ width: '40px', height: 'auto' }} />
            </div>
          )}
        </div>

        <nav style={navStyle}>
          {menuItems.map((item) => {
            if (item.isSection && item.children) {
              let isExpanded: boolean;
              let setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
              
              if (item.id === 'frota') {
                isExpanded = expandedFrota;
                setExpanded = setExpandedFrota;
              } else if (item.id === 'cargas') {
                isExpanded = expandedCargas;
                setExpanded = setExpandedCargas;
              } else {
                isExpanded = expandedEmDesenvolvimento;
                setExpanded = setExpandedEmDesenvolvimento;
              }
              
              return (
                <div key={item.id}>
                  <button
                    style={{
                      ...(sidebarCollapsed ? navButtonCollapsedStyle : navButtonStyle),
                      justifyContent: 'space-between',
                      backgroundColor: 'transparent',
                      color: item.id === 'em-desenvolvimento' ? '#FFA500' : '#CCC',
                    }}
                    onClick={() => !sidebarCollapsed && setExpanded(!isExpanded)}
                    title={sidebarCollapsed ? item.label : ''}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={iconStyle}>{item.icon}</span>
                      {!sidebarCollapsed && item.label}
                    </div>
                    {!sidebarCollapsed && (
                      <span style={{ fontSize: '12px' }}>{isExpanded ? '▼' : '▶'}</span>
                    )}
                  </button>
                  {!sidebarCollapsed && isExpanded && (
                    <div style={submenuStyle}>
                      {item.children.map((child) => (
                        <button
                          key={child.id}
                          style={{
                            ...submenuButtonStyle,
                            backgroundColor: hoveredItem === child.id && activeTab !== child.id ? 'rgba(255,215,0,0.1)' : 'transparent',
                            color: child.disabled ? '#666' : '#CCC',
                            cursor: child.disabled ? 'not-allowed' : 'pointer',
                            opacity: child.disabled ? 0.6 : 1,
                          }}
                          onMouseEnter={() => setHoveredItem(child.id)}
                          onMouseLeave={() => setHoveredItem(null)}
                          onClick={() => { 
                            if (child.disabled) {
                              handleDisabledClick(child.label);
                            } else {
                              setActiveTab(child.id as any); 
                              setSelectedMotoristaId(null);
                            }
                          }}
                        >
                          <span style={iconStyle}>{child.icon}</span>
                          {child.label}
                          {child.disabled && (
                            <span style={devBadgeStyle}>🚧</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            } else if (!item.isSection) {
              return (
                <button
                  key={item.id}
                  style={{
                    ...(sidebarCollapsed ? navButtonCollapsedStyle : navButtonStyle),
                    backgroundColor: hoveredItem === item.id && activeTab !== item.id ? 'rgba(255,215,0,0.1)' : (activeTab === item.id ? '#FFD700' : 'transparent'),
                    color: activeTab === item.id ? '#000' : '#CCC',
                  }}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  onClick={() => { 
                    setActiveTab(item.id as any); 
                    setSelectedMotoristaId(null);
                  }}
                  title={sidebarCollapsed ? item.label : ''}
                >
                  <span style={iconStyle}>{item.icon}</span>
                  {!sidebarCollapsed && item.label}
                </button>
              );
            }
            return null;
          })}
          
          {/* Botão Sair */}
          <button onClick={handleLogout} style={logoutButtonStyle}>
            <span style={iconStyle}>🚪</span>
            {!sidebarCollapsed && 'Sair do Sistema'}
          </button>
        </nav>
      </div>

      {/* Conteúdo Principal */}
      <div style={contentStyle}>
        <div style={headerStyle}>
          <div style={headerLeftStyle}>
            <h1 style={pageTitleStyle}>{getCurrentTitle()}</h1>
            <p style={pageSubtitleStyle}>
              {selectedMotoristaId ? 'Gerenciando motorista específico' : getCurrentSubtitle()}
            </p>
          </div>
          <div style={userInfoStyle}>
            <div style={avatarStyle}>👨‍💼</div>
            <div style={userDetailsStyle}>
              <div style={userNameStyle}>Administrador</div>
              <div style={userRoleStyle}>Gestor de Frota</div>
            </div>
          </div>
        </div>

        <div style={contentAreaStyle}>
          <div style={contentWrapperStyle}>
            {/* {activeTab === 'monitoramento' && <ProgramacaoMapa />} COMENTADO - DESATIVADO */}
            {activeTab === 'frota-motoristas' && (
              selectedMotoristaId ? 
                <MenuMotorista motoristaId={selectedMotoristaId} onVoltar={handleVoltarParaLista} /> 
                : 
                <ListaMotoristas onSelectMotorista={handleSelectMotorista} />
            )}
            {activeTab === 'frota-veiculos' && <ListaVeiculos />}
            {activeTab === 'frota-escala-geral' && <EscalaTodosMotoristas />}
            {activeTab === 'cargas-inserir' && <InserirProgramacao />}
            {/* {activeTab === 'cargas-visualizar' && <VisualizarProgramacoes />} COMENTADO - DESATIVADO */}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== ESTILOS ====================
const dashboardStyle: React.CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  background: '#000',
  fontFamily: "'Segoe UI', 'Inter', system-ui, sans-serif"
};

const sidebarStyle: React.CSSProperties = {
  backgroundColor: '#0A0A0A',
  color: 'white',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '2px 0 20px rgba(0,0,0,0.5)',
  transition: 'width 0.3s ease',
  position: 'relative',
  zIndex: 10,
  borderRight: '1px solid #1A1A1A'
};

const collapseButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '20px',
  right: '-12px',
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  background: '#FFD700',
  border: 'none',
  color: '#000',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: '900',
  transition: 'all 0.3s ease',
  zIndex: 20
};

const logoStyle: React.CSSProperties = {
  marginBottom: '40px',
  textAlign: 'center',
  marginTop: '20px',
  display: 'flex',
  justifyContent: 'center'
};

const logoWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px'
};

const logoImageStyle: React.CSSProperties = {
  width: '160px',
  height: 'auto',
};

const logoSubtitleStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#FFD700',
  marginTop: '2px',
  fontWeight: '600'
};

const logoIconStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

const navStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '4px'
};

const navButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  width: '100%',
  padding: '12px 16px',
  margin: '4px 0',
  backgroundColor: 'transparent',
  color: '#CCC',
  border: 'none',
  borderRadius: '12px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600',
  transition: 'all 0.2s ease',
  textAlign: 'left'
};

const navButtonCollapsedStyle: React.CSSProperties = {
  ...navButtonStyle,
  justifyContent: 'center',
  padding: '12px',
  fontSize: '20px'
};

const submenuStyle: React.CSSProperties = {
  marginLeft: '20px',
  paddingLeft: '8px',
  borderLeft: '1px solid #333',
  marginBottom: '8px'
};

const submenuButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  width: '100%',
  padding: '10px 16px',
  margin: '4px 0',
  backgroundColor: 'transparent',
  color: '#CCC',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '500',
  transition: 'all 0.2s ease',
  textAlign: 'left'
};

const iconStyle: React.CSSProperties = {
  fontSize: '18px',
  minWidth: '24px'
};

const devBadgeStyle: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: '12px'
};

const logoutButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  backgroundColor: '#EF4444',
  color: 'white',
  border: 'none',
  borderRadius: '12px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '700',
  marginTop: '20px',
  transition: 'all 0.3s ease',
  width: '100%'
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const headerStyle: React.CSSProperties = {
  background: '#0A0A0A',
  padding: '24px 32px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid #1A1A1A',
  flexWrap: 'wrap',
  gap: '16px'
};

const headerLeftStyle: React.CSSProperties = {
  flex: 1
};

const pageTitleStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: '900',
  color: '#FFF',
  marginBottom: '8px'
};

const pageSubtitleStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#888'
};

const userInfoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '8px 16px',
  background: '#1A1A1A',
  borderRadius: '16px',
  border: '1px solid #333'
};

const avatarStyle: React.CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  background: '#FFD700',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px'
};

const userDetailsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column'
};

const userNameStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#FFF'
};

const userRoleStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#888'
};

const contentAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  background: '#000'
};

const contentWrapperStyle: React.CSSProperties = {
  padding: '24px'
};

export default Menu;