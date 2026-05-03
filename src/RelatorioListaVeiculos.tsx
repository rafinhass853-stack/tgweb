// RelatorioListaVeiculos.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import {
  Truck, MapPin, Calendar, Clock, AlertCircle, BarChart3, 
  Printer, X, Search, Filter, ChevronDown, User, Phone, 
  Map, Calendar as CalendarIcon, ArrowLeft, Download, 
  TrendingDown, Package, Building, Navigation, Fuel,
  Wrench, Activity, Gauge
} from 'lucide-react';

interface CargaProgramada {
  id: string;
  docId?: string;
  dt: string;
  coletaCidade: string;
  coletaLocal: string;
  coletaData: string;
  entregaCidade: string;
  entregaLocal: string;
  entregaData: string;
  placa: string;
  carreta?: string;
  peso: string;
  status: string;
  tipo: string;
  veiculo: string;
  motorista: string;
  cpf: string;
  criadoEm?: any;
  motoristaId?: string;
  ultimoStatus?: string;
}

interface Veiculo {
  id: string;
  placa: string;
  tipo: string;
  capacidade?: number;
  createdAt?: any;
  ultimaLocalizacao?: string;
  ultimoEndereco?: string;
  velocidade?: number;
  ultimaAtualizacaoRastreador?: Timestamp;
  statusRastreador?: 'online' | 'offline' | 'parado';
  ultimaMacro?: string;
  coordenadas?: {
    lat: number;
    lng: number;
  };
  ignicao?: string;
}

interface MotivoIndisponibilidade {
  id?: string;
  veiculoId: string;
  motivo: 'manutencao' | 'folga_motorista' | 'aguardando_programacao';
  descricao?: string;
  dataInicio: string;
  dataFim?: string | null;
  atualizadoEm: any;
}

interface RelatorioItem {
  id: string;
  veiculoId: string;
  placa: string;
  tipo: string;
  tipoLabel: string;
  capacidade: string;
  statusLabel: string;
  statusCor: string;
  statusIcon: string;
  motivoLabel: string | null;
  motivoIcon: string | null;
  motivoCor: string | null;
  motivoDescricao: string | null;
  motivoDataInicio: string | null;
  diasIndisponivel: number;
  localizacao: string;
  velocidade: number;
  ultimaAtualizacao: string;
  statusRastreador: string;
  ultimaMacro: string;
}

const MOTIVO_MAP: Record<string, { label: string; icon: string; cor: string }> = {
  'manutencao': { label: 'Em Manutenção', icon: '🔧', cor: '#FF9500' },
  'folga_motorista': { label: 'Aguardando Motorista', icon: '😴', cor: '#8B5CF6' },
  'aguardando_programacao': { label: 'Aguardando Programação', icon: '⏳', cor: '#3B82F6' },
};

const STATUS_ATIVOS = ['programada', 'aguardando_carregamento', 'seguindo_para_entrega', 'chegou_entrega'];

const RelatorioListaVeiculos: React.FC = () => {
  const navigate = useNavigate();
  
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [cargasPorVeiculo, setCargasPorVeiculo] = useState<Record<string, CargaProgramada | null>>({});
  const [motivosPorVeiculo, setMotivosPorVeiculo] = useState<Record<string, MotivoIndisponibilidade | null>>({});
  const [loading, setLoading] = useState(true);
  
  // FILTROS
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos'); // todos, com_motivo, sem_motivo
  const [filtroStatusRastreador, setFiltroStatusRastreador] = useState<'todos' | 'online' | 'offline' | 'parado'>('todos');
  const [ordenarPor, setOrdenarPor] = useState<'placa' | 'diasIndisponivel' | 'velocidade'>('placa');
  const [ordenarDirecao, setOrdenarDirecao] = useState<'crescente' | 'decrescente'>('crescente');
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);

  // Função para normalizar placas
  const normalizarPlaca = (placa: string): string => {
    if (!placa) return '';
    return placa.toUpperCase().replace(/[-\s]/g, '');
  };

  // Buscar todas as cargas ativas
  const buscarTodasCargasAtivas = async () => {
    try {
      const todasCargas: CargaProgramada[] = [];
      const motoristasSnapshot = await getDocs(collection(db, 'motoristas'));
      
      for (const motoristaDoc of motoristasSnapshot.docs) {
        const cargasQuery = query(
          collection(db, 'motoristas', motoristaDoc.id, 'cargas'),
          where('status', 'in', STATUS_ATIVOS)
        );
        const cargasSnapshot = await getDocs(cargasQuery);
        
        cargasSnapshot.forEach(cargaDoc => {
          const cargaData = cargaDoc.data() as CargaProgramada;
          todasCargas.push({ 
            ...cargaData, 
            id: cargaDoc.id,
            motoristaId: motoristaDoc.id
          });
        });
      }
      
      return todasCargas;
    } catch (error) {
      console.error('Erro ao buscar cargas:', error);
      return [];
    }
  };

  // Buscar motivos de indisponibilidade
  const buscarMotivosIndisponibilidade = async (veiculoId: string) => {
    try {
      const motivoRef = collection(db, 'veiculos', veiculoId, 'indisponibilidade');
      const q = query(motivoRef, where('dataFim', '==', null));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return null;
      
      const docSnap = snapshot.docs[0];
      const motivoData = docSnap.data();
      return {
        id: docSnap.id,
        veiculoId: motivoData.veiculoId,
        motivo: motivoData.motivo,
        descricao: motivoData.descricao,
        dataInicio: motivoData.dataInicio,
        dataFim: motivoData.dataFim,
        atualizadoEm: motivoData.atualizadoEm
      } as MotivoIndisponibilidade;
    } catch (error) {
      console.error('Erro ao buscar motivo:', error);
      return null;
    }
  };

  // Carregar dados
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Carregar veículos
        const veiculosSnap = await getDocs(collection(db, 'veiculos'));
        const listaVeiculos: Veiculo[] = veiculosSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as Veiculo));
        setVeiculos(listaVeiculos);
        
        // Carregar cargas ativas
        const todasCargas = await buscarTodasCargasAtivas();
        const cargasMap: Record<string, CargaProgramada | null> = {};
        
        listaVeiculos.forEach(veiculo => {
          const placaVeiculoNorm = normalizarPlaca(veiculo.placa);
          const cargaEncontrada = todasCargas.find(carga => 
            normalizarPlaca(carga.placa) === placaVeiculoNorm
          );
          cargasMap[veiculo.id] = cargaEncontrada || null;
        });
        setCargasPorVeiculo(cargasMap);
        
        // Carregar motivos de indisponibilidade
        const motivosMap: Record<string, MotivoIndisponibilidade | null> = {};
        for (const veiculo of listaVeiculos) {
          const motivo = await buscarMotivosIndisponibilidade(veiculo.id);
          motivosMap[veiculo.id] = motivo;
        }
        setMotivosPorVeiculo(motivosMap);
        
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Calcular dias de indisponibilidade
  const calcularDiasIndisponivel = (dataInicio: string | null): number => {
    if (!dataInicio) return 0;
    const inicio = new Date(dataInicio);
    const agora = new Date();
    const diffMs = agora.getTime() - inicio.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  const getTipoLabel = (tipo: string): string => {
    switch(tipo) {
      case 'toco': return 'Toco (2 eixos)';
      case 'trucado': return 'Trucado (3 eixos)';
      case 'truck': return 'Truck (Cavalo)';
      default: return tipo || '—';
    }
  };

  // Preparar dados do relatório - APENAS VEÍCULOS SEM PROGRAMAÇÃO ATIVA
  const dadosRelatorio = useMemo(() => {
    const dados: RelatorioItem[] = [];
    
    for (const veiculo of veiculos) {
      const carga = cargasPorVeiculo[veiculo.id];
      const motivo = motivosPorVeiculo[veiculo.id];
      
      // PULAR VEÍCULOS COM PROGRAMAÇÃO ATIVA
      if (carga !== null) {
        continue;
      }
      
      const motivoInfo = motivo ? MOTIVO_MAP[motivo.motivo] : null;
      const diasIndisponivel = motivo ? calcularDiasIndisponivel(motivo.dataInicio) : 0;
      
      // Formatar data da última atualização
      let ultimaAtualizacao = '—';
      if (veiculo.ultimaAtualizacaoRastreador) {
        const data = veiculo.ultimaAtualizacaoRastreador.toDate();
        ultimaAtualizacao = data.toLocaleString('pt-BR');
      }
      
      // Determinar status do veículo sem programação
      let statusLabel = 'Disponível';
      let statusCor = '#22C55E';
      let statusIcon = '✅';
      
      if (motivo) {
        statusLabel = motivoInfo!.label;
        statusCor = motivoInfo!.cor;
        statusIcon = motivoInfo!.icon;
      }
      
      dados.push({
        id: veiculo.id,
        veiculoId: veiculo.id,
        placa: veiculo.placa,
        tipo: veiculo.tipo,
        tipoLabel: getTipoLabel(veiculo.tipo),
        capacidade: veiculo.capacidade ? `${veiculo.capacidade} paletes` : '—',
        statusLabel: statusLabel,
        statusCor: statusCor,
        statusIcon: statusIcon,
        motivoLabel: motivoInfo?.label || null,
        motivoIcon: motivoInfo?.icon || null,
        motivoCor: motivoInfo?.cor || null,
        motivoDescricao: motivo?.descricao || null,
        motivoDataInicio: motivo?.dataInicio || null,
        diasIndisponivel: diasIndisponivel,
        localizacao: veiculo.ultimaLocalizacao || veiculo.ultimoEndereco || '—',
        velocidade: veiculo.velocidade || 0,
        ultimaAtualizacao: ultimaAtualizacao,
        statusRastreador: veiculo.statusRastreador || 'offline',
        ultimaMacro: veiculo.ultimaMacro || '—',
      });
    }
    
    // Aplicar filtros
    let filtrados = dados.filter(item => {
      const matchTexto = !filtroTexto || 
        item.placa.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        item.tipoLabel.toLowerCase().includes(filtroTexto.toLowerCase());
      
      const matchTipo = filtroTipo === 'todos' || item.tipo === filtroTipo;
      
      const matchStatus = filtroStatus === 'todos' ||
        (filtroStatus === 'com_motivo' && item.motivoLabel !== null) ||
        (filtroStatus === 'sem_motivo' && item.motivoLabel === null);
      
      const matchRastreador = filtroStatusRastreador === 'todos' ||
        item.statusRastreador === filtroStatusRastreador;
      
      return matchTexto && matchTipo && matchStatus && matchRastreador;
    });
    
    // Ordenar
    filtrados.sort((a, b) => {
      let comparison = 0;
      if (ordenarPor === 'placa') {
        comparison = a.placa.localeCompare(b.placa);
      } else if (ordenarPor === 'diasIndisponivel') {
        comparison = a.diasIndisponivel - b.diasIndisponivel;
      } else if (ordenarPor === 'velocidade') {
        comparison = a.velocidade - b.velocidade;
      }
      return ordenarDirecao === 'crescente' ? comparison : -comparison;
    });
    
    return filtrados;
  }, [veiculos, cargasPorVeiculo, motivosPorVeiculo, filtroTexto, 
      filtroTipo, filtroStatus, filtroStatusRastreador, ordenarPor, ordenarDirecao]);

  const stats = useMemo(() => {
    const totalSemProgramacao = dadosRelatorio.length;
    const comMotivo = dadosRelatorio.filter(d => d.motivoLabel !== null).length;
    const semMotivo = totalSemProgramacao - comMotivo;
    
    const porMotivo = {
      manutencao: dadosRelatorio.filter(d => d.motivoLabel === 'Em Manutenção').length,
      folgaMotorista: dadosRelatorio.filter(d => d.motivoLabel === 'Aguardando Motorista').length,
      aguardandoProgramacao: dadosRelatorio.filter(d => d.motivoLabel === 'Aguardando Programação').length,
    };
    
    const tempoMedioIndisponivel = dadosRelatorio
      .filter(d => d.diasIndisponivel > 0)
      .reduce((sum, d) => sum + d.diasIndisponivel, 0) / (dadosRelatorio.filter(d => d.diasIndisponivel > 0).length || 1);
    
    const online = dadosRelatorio.filter(d => d.statusRastreador === 'online').length;
    const offline = dadosRelatorio.filter(d => d.statusRastreador === 'offline').length;
    const parado = dadosRelatorio.filter(d => d.statusRastreador === 'parado').length;
    
    return { 
      totalSemProgramacao,
      comMotivo,
      semMotivo,
      porMotivo,
      tempoMedioIndisponivel,
      online,
      offline,
      parado
    };
  }, [dadosRelatorio]);

  const limparTodosFiltros = () => {
    setFiltroTexto('');
    setFiltroTipo('todos');
    setFiltroStatus('todos');
    setFiltroStatusRastreador('todos');
    setOrdenarPor('placa');
    setOrdenarDirecao('crescente');
  };

  const exportarCSV = () => {
    const headers = [
      'Status', 'Placa', 'Tipo', 'Capacidade', 'Motivo',
      'Dias Indisponível', 'Data Início', 'Descrição', 
      'Localização', 'Velocidade (km/h)', 'Status Rastreador', 'Última Atualização'
    ];
    
    const rows = dadosRelatorio.map(item => [
      item.statusLabel,
      item.placa,
      item.tipoLabel,
      item.capacidade,
      item.motivoLabel || 'Disponível',
      item.diasIndisponivel,
      item.motivoDataInicio || '',
      item.motivoDescricao || '',
      item.localizacao,
      item.velocidade,
      item.statusRastreador === 'online' ? 'Online' : item.statusRastreador === 'parado' ? 'Parado' : 'Offline',
      item.ultimaAtualizacao
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_veiculos_sem_programacao_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getRastreadorStatusColor = (status: string): string => {
    switch(status) {
      case 'online': return '#22C55E';
      case 'parado': return '#FFD700';
      default: return '#EF4444';
    }
  };

  const getDiasColor = (dias: number): string => {
    if (dias === 0) return '#888';
    if (dias < 3) return '#22C55E';
    if (dias < 7) return '#FFD700';
    if (dias < 15) return '#FF9500';
    return '#EF4444';
  };

  // Estilos
  const containerStyle: React.CSSProperties = {
    padding: '32px 24px',
    backgroundColor: '#000',
    minHeight: '100vh',
    fontFamily: 'Inter, sans-serif'
  };
  
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    flexWrap: 'wrap',
    gap: '16px'
  };
  
  const titleStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 800,
    color: '#FFF',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  };
  
  const backButtonStyle: React.CSSProperties = {
    background: '#1A1A1A',
    border: '1px solid #333',
    borderRadius: '12px',
    padding: '10px 16px',
    color: '#FFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 500
  };
  
  const statsGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  };
  
  const statCardStyle: React.CSSProperties = {
    background: '#0A0A0A',
    border: '1px solid #1F1F1F',
    borderRadius: '16px',
    padding: '16px 20px'
  };
  
  const statValueStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 800,
    color: '#FFD700',
    margin: 0
  };
  
  const statLabelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#888',
    marginTop: '4px'
  };
  
  const filtersBarStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '16px'
  };
  
  const filterButtonStyle: React.CSSProperties = {
    background: '#0A0A0A',
    border: '1px solid #27272a',
    borderRadius: '12px',
    padding: '10px 18px',
    color: '#e5e7eb',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 500
  };
  
  const clearButtonStyle: React.CSSProperties = {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: '12px',
    padding: '10px 18px',
    color: '#f87171',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px'
  };
  
  const searchWrapperStyle: React.CSSProperties = {
    position: 'relative',
    flexGrow: 1,
    maxWidth: '400px'
  };
  
  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 12px 12px 48px',
    borderRadius: '12px',
    border: '1px solid #333',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#1A1A1A',
    color: '#FFF'
  };
  
  const filtersPanelStyle: React.CSSProperties = {
    background: '#0A0A0A',
    border: '1px solid #1F1F1F',
    borderRadius: '18px',
    marginBottom: '24px',
    padding: '20px 24px'
  };
  
  const filtersGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px'
  };
  
  const filterGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  };
  
  const filterLabelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    color: '#888',
    textTransform: 'uppercase'
  };
  
  const filterInputStyle: React.CSSProperties = {
    background: '#111',
    border: '1px solid #27272a',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#e5e7eb',
    outline: 'none'
  };
  
  const selectStyle: React.CSSProperties = {
    background: '#111',
    border: '1px solid #27272a',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#e5e7eb',
    outline: 'none',
    cursor: 'pointer'
  };
  
  const ordenacaoBarStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    padding: '12px 0',
    flexWrap: 'wrap',
    gap: '12px'
  };
  
  const ordenacaoButtonsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap'
  };
  
  const ordenacaoBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: '8px',
    border: '1px solid',
    borderColor: active ? '#FFD700' : '#333',
    backgroundColor: active ? '#FFD70020' : '#1A1A1A',
    color: active ? '#FFD700' : '#AAA',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  });
  
  const tableContainerStyle: React.CSSProperties = {
    overflowX: 'auto',
    maxHeight: 'calc(100vh - 350px)',
    overflowY: 'auto',
    borderRadius: '16px',
    border: '1px solid #1F1F1F'
  };
  
  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
    minWidth: '1300px'
  };
  
  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '14px 10px',
    color: '#FFD700',
    borderBottom: '2px solid #FFD700',
    backgroundColor: '#0A0A0A',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    fontWeight: 700,
    fontSize: '12px'
  };
  
  const tdStyle: React.CSSProperties = {
    padding: '12px 10px',
    color: '#BBB',
    borderBottom: '1px solid #1F1F1F'
  };
  
  const exportButtonStyle: React.CSSProperties = {
    background: '#22C55E20',
    border: '1px solid #22C55E',
    borderRadius: '10px',
    padding: '10px 18px',
    color: '#22C55E',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 500
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <Clock size={48} color="#666" />
          <h3 style={{ color: '#FFF' }}>Carregando dados...</h3>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>
            <BarChart3 size={28} color="#FFD700" />
            Veículos sem Programação
          </h1>
          <p style={{ color: '#666', marginTop: '8px' }}>
            Relatório completo de veículos que não possuem programação ativa
          </p>
        </div>
        <button style={backButtonStyle} onClick={() => navigate('/veiculos')}>
          <ArrowLeft size={18} /> Voltar
        </button>
      </div>

      {/* Cards de Estatísticas */}
      <div style={statsGridStyle}>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#EF4444' }}>{stats.totalSemProgramacao}</p>
          <p style={statLabelStyle}>Total sem Programação</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#FF9500' }}>{stats.comMotivo}</p>
          <p style={statLabelStyle}>Com Motivo Registrado</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#22C55E' }}>{stats.semMotivo}</p>
          <p style={statLabelStyle}>Disponíveis (Sem Motivo)</p>
        </div>
      </div>

      {/* Segunda linha de estatísticas */}
      <div style={{ ...statsGridStyle, marginTop: '-8px' }}>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#FF9500' }}>{stats.porMotivo.manutencao}</p>
          <p style={statLabelStyle}>🔧 Em Manutenção</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#8B5CF6' }}>{stats.porMotivo.folgaMotorista}</p>
          <p style={statLabelStyle}>😴 Aguardando Motorista</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#3B82F6' }}>{stats.porMotivo.aguardandoProgramacao}</p>
          <p style={statLabelStyle}>⏳ Aguardando Programação</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#22C55E' }}>{stats.online}</p>
          <p style={statLabelStyle}>Rastreador Online</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#EF4444' }}>{stats.offline}</p>
          <p style={statLabelStyle}>Rastreador Offline</p>
        </div>
        {stats.tempoMedioIndisponivel > 0 && (
          <div style={statCardStyle}>
            <p style={{ ...statValueStyle, color: '#FFD700' }}>
              {Math.round(stats.tempoMedioIndisponivel)} dias
            </p>
            <p style={statLabelStyle}>Tempo Médio Indisponível</p>
          </div>
        )}
      </div>

      {/* Barra de Filtros */}
      <div style={filtersBarStyle}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            style={{ ...filterButtonStyle, ...(filtrosAbertos ? { borderColor: '#FFD700', color: '#FFD700' } : {}) }}
            onClick={() => setFiltrosAbertos(!filtrosAbertos)}
          >
            <Filter size={14} /> Filtros
            <ChevronDown size={14} style={{ transform: filtrosAbertos ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
          </button>
          {(filtroTexto || filtroTipo !== 'todos' || filtroStatus !== 'todos' || filtroStatusRastreador !== 'todos') && (
            <button style={clearButtonStyle} onClick={limparTodosFiltros}>
              <X size={14} /> Limpar Filtros
            </button>
          )}
        </div>
        <div style={searchWrapperStyle}>
          <Search size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
          <input
            type="text"
            placeholder="Buscar por placa ou tipo..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            style={searchInputStyle}
          />
        </div>
        <button style={exportButtonStyle} onClick={exportarCSV}>
          <Download size={14} /> Exportar CSV
        </button>
        <button style={filterButtonStyle} onClick={() => window.print()}>
          <Printer size={14} /> Imprimir
        </button>
      </div>

      {/* Painel de Filtros Avançados */}
      {filtrosAbertos && (
        <div style={filtersPanelStyle}>
          <div style={filtersGridStyle}>
            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>Tipo de Veículo</label>
              <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={selectStyle}>
                <option value="todos">Todos</option>
                <option value="toco">Toco (2 eixos)</option>
                <option value="trucado">Trucado (3 eixos)</option>
                <option value="truck">Truck (Cavalo)</option>
              </select>
            </div>
            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>Status</label>
              <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={selectStyle}>
                <option value="todos">Todos</option>
                <option value="com_motivo">⚠️ Com Motivo (Indisponível)</option>
                <option value="sem_motivo">✅ Disponível (Sem Motivo)</option>
              </select>
            </div>
            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>Status Rastreador</label>
              <select value={filtroStatusRastreador} onChange={(e) => setFiltroStatusRastreador(e.target.value as any)} style={selectStyle}>
                <option value="todos">Todos</option>
                <option value="online">🟢 Online</option>
                <option value="parado">🟡 Parado</option>
                <option value="offline">🔴 Offline</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Ordenação */}
      <div style={ordenacaoBarStyle}>
        <div style={ordenacaoButtonsStyle}>
          <span style={{ fontSize: '12px', color: '#888' }}>Ordenar por:</span>
          <button
            style={ordenacaoBtnStyle(ordenarPor === 'placa')}
            onClick={() => setOrdenarPor('placa')}
          >
            <Truck size={12} /> Placa
          </button>
          <button
            style={ordenacaoBtnStyle(ordenarPor === 'diasIndisponivel')}
            onClick={() => setOrdenarPor('diasIndisponivel')}
          >
            <CalendarIcon size={12} /> Dias Indisponível
          </button>
          <button
            style={ordenacaoBtnStyle(ordenarPor === 'velocidade')}
            onClick={() => setOrdenarPor('velocidade')}
          >
            <Gauge size={12} /> Velocidade
          </button>
          <div style={{ width: '1px', height: '24px', background: '#333', margin: '0 8px' }} />
          <button
            style={ordenacaoBtnStyle(ordenarDirecao === 'crescente')}
            onClick={() => setOrdenarDirecao('crescente')}
          >
            ↑ Crescente
          </button>
          <button
            style={ordenacaoBtnStyle(ordenarDirecao === 'decrescente')}
            onClick={() => setOrdenarDirecao('decrescente')}
          >
            ↓ Decrescente
          </button>
        </div>
        <span style={{ fontSize: '12px', color: '#FFD700' }}>
          📊 {dadosRelatorio.length} veículo(s) sem programação
        </span>
      </div>

      {/* Tabela de Relatório */}
      <div style={tableContainerStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Placa</th>
              <th style={thStyle}>Tipo</th>
              <th style={thStyle}>Capacidade</th>
              <th style={thStyle}>Motivo</th>
              <th style={thStyle}>Dias</th>
              <th style={thStyle}>Data Início</th>
              <th style={thStyle}>Descrição</th>
              <th style={thStyle}>Localização</th>
              <th style={thStyle}>Velocidade</th>
              <th style={thStyle}>Rastreador</th>
            </tr>
          </thead>
          <tbody>
            {dadosRelatorio.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
                  <AlertCircle size={40} color="#666" />
                  <p style={{ marginTop: '12px' }}>Nenhum veículo encontrado</p>
                  <p style={{ fontSize: '12px', marginTop: '8px' }}>
                    Todos os veículos estão com programação ativa
                  </p>
                </td>
              </tr>
            ) : (
              dadosRelatorio.map((item, idx) => (
                <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? '#0A0A0A' : '#0F0F0F' }}>
                  <td style={tdStyle}>
                    <span style={{ color: item.statusCor, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {item.statusIcon} {item.statusLabel}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <strong style={{ color: '#FFF' }}>{item.placa}</strong>
                    <div style={{ fontSize: '10px', color: '#666' }}>{item.tipoLabel}</div>
                  </td>
                  <td style={tdStyle}>
                    {item.capacidade !== '—' ? (
                      <span style={{ color: '#FFD700' }}>📦 {item.capacidade}</span>
                    ) : (
                      <span style={{ color: '#666' }}>—</span>
                    )}
                  </td>
                  <td style={tdStyle}>
  {item.motivoLabel ? (
    <span style={{ color: item.motivoCor || '#FFD700' }}>{item.motivoIcon} {item.motivoLabel}</span>
  ) : (
    <span style={{ color: '#22C55E' }}>✅ Disponível</span>
  )}
</td>
                  <td style={tdStyle}>
                    {item.diasIndisponivel > 0 ? (
                      <span style={{ 
                        color: getDiasColor(item.diasIndisponivel),
                        fontWeight: 700
                      }}>
                        {item.diasIndisponivel} {item.diasIndisponivel === 1 ? 'dia' : 'dias'}
                      </span>
                    ) : (
                      <span style={{ color: '#666' }}>—</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: '#888' }}>{item.motivoDataInicio || '—'}</span>
                  </td>
                  <td style={tdStyle}>
                    {item.motivoDescricao ? (
                      <span style={{ fontSize: '11px', color: '#AAA' }}>
                        📝 {item.motivoDescricao.length > 35 ? item.motivoDescricao.substring(0, 32) + '...' : item.motivoDescricao}
                      </span>
                    ) : (
                      <span style={{ color: '#666' }}>—</span>
                    )}
                   </td>
                  <td style={tdStyle}>
                    {item.localizacao !== '—' ? (
                      <div>
                        <div style={{ color: '#22C55E', fontSize: '11px' }}>
                          📍 {item.localizacao.length > 30 ? item.localizacao.substring(0, 27) + '...' : item.localizacao}
                        </div>
                        {item.ultimaMacro !== '—' && (
                          <div style={{ fontSize: '10px', color: '#FFD700', marginTop: '4px' }}>
                            🏷️ {item.ultimaMacro.length > 15 ? item.ultimaMacro.substring(0, 12) + '...' : item.ultimaMacro}
                          </div>
                        )}
                      </div>
                    ) : '—'}
                   </td>
                  <td style={tdStyle}>
                    {item.velocidade > 0 ? (
                      <span style={{ color: '#22C55E', fontWeight: 600 }}>
                        🏎️ {item.velocidade} km/h
                      </span>
                    ) : (
                      <span style={{ color: '#666' }}>⏹️ Parado</span>
                    )}
                   </td>
                  <td style={tdStyle}>
                    <div>
                      <span style={{ 
                        color: getRastreadorStatusColor(item.statusRastreador),
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {item.statusRastreador === 'online' ? '🟢' : item.statusRastreador === 'parado' ? '🟡' : '🔴'}
                        {item.statusRastreador === 'online' ? 'Online' : item.statusRastreador === 'parado' ? 'Parado' : 'Offline'}
                      </span>
                      {item.ultimaAtualizacao !== '—' && (
                        <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                          {item.ultimaAtualizacao}
                        </div>
                      )}
                    </div>
                   </td>
                 </tr>
              ))
            )}
          </tbody>
         </table>
      </div>
    </div>
  );
};

export default RelatorioListaVeiculos;