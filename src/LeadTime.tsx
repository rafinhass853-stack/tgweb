import React, { useState } from 'react';

const LeadTime = () => {
  const [leadTimes, setLeadTimes] = useState([
    { id: 1, rota: 'São Paulo → Rio de Janeiro', tempoPrevisto: '6h', tempoReal: '5h30m', status: 'No prazo' },
    { id: 2, rota: 'Belo Horizonte → Salvador', tempoPrevisto: '12h', tempoReal: '13h', status: 'Atrasado' },
    { id: 3, rota: 'Curitiba → Porto Alegre', tempoPrevisto: '8h', tempoReal: '7h45m', status: 'Adiantado' },
  ]);

  const [novaRota, setNovaRota] = useState({
    rota: '',
    tempoPrevisto: '',
    tempoReal: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNovaRota({
      ...novaRota,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const status = calcularStatus(novaRota.tempoPrevisto, novaRota.tempoReal);
    const leadTime = {
      id: leadTimes.length + 1,
      ...novaRota,
      status
    };
    setLeadTimes([...leadTimes, leadTime]);
    setNovaRota({ rota: '', tempoPrevisto: '', tempoReal: '' });
  };

  const calcularStatus = (previsto: string, real: string): string => {
    // Função simplificada para calcular status
    const previstoNum = parseInt(previsto);
    const realNum = parseInt(real);
    if (realNum <= previstoNum) return 'No prazo';
    if (realNum > previstoNum) return 'Atrasado';
    return 'Adiantado';
  };

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Lead Time - Acompanhamento de Prazos</h1>
      
      <div style={formContainerStyle}>
        <h3 style={formTitleStyle}>Nova Rota</h3>
        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Rota</label>
            <input
              type="text"
              name="rota"
              value={novaRota.rota}
              onChange={handleInputChange}
              required
              style={inputStyle}
              placeholder="Ex: São Paulo → Rio de Janeiro"
            />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Tempo Previsto (horas)</label>
            <input
              type="text"
              name="tempoPrevisto"
              value={novaRota.tempoPrevisto}
              onChange={handleInputChange}
              required
              style={inputStyle}
              placeholder="Ex: 6"
            />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Tempo Real (horas)</label>
            <input
              type="text"
              name="tempoReal"
              value={novaRota.tempoReal}
              onChange={handleInputChange}
              required
              style={inputStyle}
              placeholder="Ex: 5.5"
            />
          </div>
          <button type="submit" style={submitButtonStyle}>Adicionar Rota</button>
        </form>
      </div>

      <div style={statsContainerStyle}>
        <div style={statCardStyle}>
          <div style={statValueStyle}>{leadTimes.length}</div>
          <div style={statLabelStyle}>Total de Rotas</div>
        </div>
        <div style={statCardStyle}>
          <div style={statValueStyle}>
            {leadTimes.filter(l => l.status === 'No prazo').length}
          </div>
          <div style={statLabelStyle}>No Prazo</div>
        </div>
        <div style={statCardStyle}>
          <div style={statValueStyle}>
            {leadTimes.filter(l => l.status === 'Atrasado').length}
          </div>
          <div style={statLabelStyle}>Atrasados</div>
        </div>
        <div style={statCardStyle}>
          <div style={statValueStyle}>
            {leadTimes.filter(l => l.status === 'Adiantado').length}
          </div>
          <div style={statLabelStyle}>Adiantados</div>
        </div>
      </div>

      <div style={tableContainerStyle}>
        <table style={tableStyle}>
          <thead>
            <tr style={tableHeaderStyle}>
              <th style={tableCellStyle}>ID</th>
              <th style={tableCellStyle}>Rota</th>
              <th style={tableCellStyle}>Tempo Previsto</th>
              <th style={tableCellStyle}>Tempo Real</th>
              <th style={tableCellStyle}>Status</th>
              <th style={tableCellStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {leadTimes.map((leadTime) => (
              <tr key={leadTime.id} style={tableRowStyle}>
                <td style={tableCellStyle}>{leadTime.id}</td>
                <td style={tableCellStyle}>{leadTime.rota}</td>
                <td style={tableCellStyle}>{leadTime.tempoPrevisto}</td>
                <td style={tableCellStyle}>{leadTime.tempoReal}</td>
                <td style={tableCellStyle}>
                  <span style={{ ...statusStyle, ...getLeadTimeStatusStyle(leadTime.status) }}>
                    {leadTime.status}
                  </span>
                </td>
                <td style={tableCellStyle}>
                  <button style={actionButtonStyle}>📊 Detalhes</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const getLeadTimeStatusStyle = (status: string): React.CSSProperties => {
  if (status === 'No prazo') return { backgroundColor: '#10B981' };
  if (status === 'Atrasado') return { backgroundColor: '#EF4444' };
  return { backgroundColor: '#3B82F6' };
};

const containerStyle: React.CSSProperties = {
  padding: '24px',
  background: '#0A0A0A',
  borderRadius: '16px',
  minHeight: '500px'
};

const titleStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#FFD700',
  marginBottom: '24px'
};

const formContainerStyle: React.CSSProperties = {
  backgroundColor: '#1A1A1A',
  padding: '20px',
  borderRadius: '12px',
  marginBottom: '24px'
};

const formTitleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#FFD700',
  marginBottom: '16px'
};

const formStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: '16px'
};

const formGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
};

const labelStyle: React.CSSProperties = {
  color: '#CCC',
  fontSize: '14px',
  fontWeight: '500'
};

const inputStyle: React.CSSProperties = {
  padding: '10px',
  backgroundColor: '#0A0A0A',
  border: '1px solid #333',
  borderRadius: '6px',
  color: '#FFF',
  fontSize: '14px'
};

const submitButtonStyle: React.CSSProperties = {
  padding: '10px 20px',
  backgroundColor: '#FFD700',
  color: '#000',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600',
  alignSelf: 'flex-end'
};

const statsContainerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '16px',
  marginBottom: '24px'
};

const statCardStyle: React.CSSProperties = {
  backgroundColor: '#1A1A1A',
  padding: '20px',
  borderRadius: '12px',
  textAlign: 'center'
};

const statValueStyle: React.CSSProperties = {
  fontSize: '32px',
  fontWeight: '900',
  color: '#FFD700'
};

const statLabelStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#CCC',
  marginTop: '8px'
};

const tableContainerStyle: React.CSSProperties = {
  overflowX: 'auto'
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  backgroundColor: '#1A1A1A',
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
  fontWeight: '600',
  color: '#FFF'
};

const actionButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  backgroundColor: '#FFD700',
  color: '#000',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: '600'
};

export default LeadTime;