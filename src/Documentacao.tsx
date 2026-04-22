import React, { useState } from 'react';

const Documentacao = () => {
  const [activeDocTab, setActiveDocTab] = useState<'canhotos' | 'devolucoes'>('canhotos');

  // Dados de exemplo para canhotos
  const canhotosData = [
    { id: 1, carga: 'CARGA-001', motorista: 'João Silva', data: '2024-01-15', status: 'Assinado', arquivo: 'canhoto_001.pdf' },
    { id: 2, carga: 'CARGA-002', motorista: 'Maria Santos', data: '2024-01-16', status: 'Pendente', arquivo: 'canhoto_002.pdf' },
    { id: 3, carga: 'CARGA-003', motorista: 'Pedro Oliveira', data: '2024-01-17', status: 'Assinado', arquivo: 'canhoto_003.pdf' },
  ];

  // Dados de exemplo para devoluções
  const devolucoesData = [
    { id: 1, carga: 'CARGA-005', motorista: 'Carlos Lima', data: '2024-01-18', motivo: 'Produto danificado', status: 'Em análise' },
    { id: 2, carga: 'CARGA-008', motorista: 'Ana Paula', data: '2024-01-19', motivo: 'Endereço incorreto', status: 'Aprovada' },
  ];

  return (
    <div style={containerStyle}>
      <div style={tabsStyle}>
        <button
          style={{ ...tabStyle, ...(activeDocTab === 'canhotos' ? activeTabStyle : {}) }}
          onClick={() => setActiveDocTab('canhotos')}
        >
          📄 Canhotos
        </button>
        <button
          style={{ ...tabStyle, ...(activeDocTab === 'devolucoes' ? activeTabStyle : {}) }}
          onClick={() => setActiveDocTab('devolucoes')}
        >
          🔄 Devoluções
        </button>
      </div>

      <div style={contentCardStyle}>
        {activeDocTab === 'canhotos' ? (
          <div>
            <h2 style={sectionTitleStyle}>Canhotos de Entregas</h2>
            <table style={tableStyle}>
              <thead>
                <tr style={tableHeaderStyle}>
                  <th style={tableCellStyle}>ID Carga</th>
                  <th style={tableCellStyle}>Motorista</th>
                  <th style={tableCellStyle}>Data</th>
                  <th style={tableCellStyle}>Status</th>
                  <th style={tableCellStyle}>Arquivo</th>
                  <th style={tableCellStyle}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {canhotosData.map((item) => (
                  <tr key={item.id} style={tableRowStyle}>
                    <td style={tableCellStyle}>{item.carga}</td>
                    <td style={tableCellStyle}>{item.motorista}</td>
                    <td style={tableCellStyle}>{item.data}</td>
                    <td style={tableCellStyle}>
                      <span style={{ ...statusStyle, ...(item.status === 'Assinado' ? successStyle : warningStyle) }}>
                        {item.status}
                      </span>
                    </td>
                    <td style={tableCellStyle}>{item.arquivo}</td>
                    <td style={tableCellStyle}>
                      <button style={actionButtonStyle}>📥 Baixar</button>
                      <button style={actionButtonStyle}>👁️ Visualizar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div>
            <h2 style={sectionTitleStyle}>Devoluções</h2>
            <table style={tableStyle}>
              <thead>
                <tr style={tableHeaderStyle}>
                  <th style={tableCellStyle}>ID Carga</th>
                  <th style={tableCellStyle}>Motorista</th>
                  <th style={tableCellStyle}>Data</th>
                  <th style={tableCellStyle}>Motivo</th>
                  <th style={tableCellStyle}>Status</th>
                  <th style={tableCellStyle}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {devolucoesData.map((item) => (
                  <tr key={item.id} style={tableRowStyle}>
                    <td style={tableCellStyle}>{item.carga}</td>
                    <td style={tableCellStyle}>{item.motorista}</td>
                    <td style={tableCellStyle}>{item.data}</td>
                    <td style={tableCellStyle}>{item.motivo}</td>
                    <td style={tableCellStyle}>
                      <span style={{ ...statusStyle, ...(item.status === 'Aprovada' ? successStyle : warningStyle) }}>
                        {item.status}
                      </span>
                    </td>
                    <td style={tableCellStyle}>
                      <button style={actionButtonStyle}>📝 Detalhes</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  padding: '24px',
  background: '#0A0A0A',
  borderRadius: '16px',
  minHeight: '500px'
};

const tabsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginBottom: '24px',
  borderBottom: '1px solid #333',
  paddingBottom: '12px'
};

const tabStyle: React.CSSProperties = {
  padding: '10px 24px',
  backgroundColor: 'transparent',
  color: '#CCC',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: '600',
  transition: 'all 0.3s ease'
};

const activeTabStyle: React.CSSProperties = {
  backgroundColor: '#FFD700',
  color: '#000'
};

const contentCardStyle: React.CSSProperties = {
  backgroundColor: '#1A1A1A',
  borderRadius: '12px',
  padding: '20px'
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: '700',
  color: '#FFD700',
  marginBottom: '20px'
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  backgroundColor: '#0A0A0A',
  borderRadius: '8px',
  overflow: 'hidden'
};

const tableHeaderStyle: React.CSSProperties = {
  backgroundColor: '#FFD700',
  color: '#000'
};

const tableRowStyle: React.CSSProperties = {
  borderBottom: '1px solid #333'
};

const tableCellStyle: React.CSSProperties = {
  padding: '12px',
  textAlign: 'left',
  color: '#FFF'
};

const statusStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: '600'
};

const successStyle: React.CSSProperties = {
  backgroundColor: '#10B981',
  color: '#FFF'
};

const warningStyle: React.CSSProperties = {
  backgroundColor: '#F59E0B',
  color: '#FFF'
};

const actionButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  margin: '0 4px',
  backgroundColor: '#FFD700',
  color: '#000',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: '600'
};

export default Documentacao;