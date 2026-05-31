import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  doc
} from 'firebase/firestore';
import {
  Truck, MapPin, Calendar, Clock, AlertCircle, BarChart3, 
  Printer, X, Search, Filter, ChevronDown, User, Phone, 
  Map, Calendar as CalendarIcon, ArrowLeft, Download, 
  TrendingDown, Package, Building, Navigation, Edit3
} from 'lucide-react';

interface Motorista {
  id: string;
  nome: string;
  cpf: string;
  cidade?: string;
  whatsapp?: string;
  telefone?: string;
  cnhCategoria?: string;
  temMopp?: string;
  fotoPerfilUrl?: string;
  uid?: string;
  viagensRealizadas?: number;
}

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

interface VeiculoData {
  placa: string;
  ultimaLocalizacao?: string;
  ultimaAtualizacaoRastreador?: any;
  statusRastreador?: string;
  velocidade?: number;
  coordenadas?: { lat: number; lng: number };
  ultimaMacro?: string;
  ignicao?: string;
}

interface EventoEscala {
  id: string;
  tipo: string;
  dataInicio: string;
  criadoEm: any;
}

// STATUS DO MOTORISTA (mesmo do arquivo principal)
const STATUS_MOTORISTA_OPTS: Record<string, { label: string; icon: string; cor: string; bg: string }> = {
  'disponivel': { label: 'Disponível para Programar', icon: '✅', cor: '#22C55E', bg: '#22C55E20' },
  'folga': { label: 'Folga', icon: '😴', cor: '#FFD700', bg: '#FFD70020' },
  'ferias': { label: 'Férias', icon: '🏖️', cor: '#FFD700', bg: '#FFD70020' },
  'sem_veiculo': { label: 'Sem Veículo', icon: '🚫', cor: '#EF4444', bg: '#EF444420' },
  'falta': { label: 'Falta', icon: '❌', cor: '#EF4444', bg: '#EF444420' },
  'atestado': { label: 'Atestado', icon: '📋', cor: '#8B5CF6', bg: '#8B5CF620' },
  'veiculo_manutencao': { label: 'Veículo em Manutenção', icon: '🔧', cor: '#FF9500', bg: '#FF950020' }
};

const STATUS_CARGA_MAP: Record<string, { label: string; cor: string; bg: string; icon: string }> = {
  'programada': { label: 'Programado', cor: '#FFD700', bg: '#FFD70020', icon: '📋' },
  'aguardando_carregamento': { label: 'Aguardando Carregamento', cor: '#FF9500', bg: '#FF950020', icon: '⏳' },
  'seguindo_para_entrega': { label: 'Seguindo para a Entrega', cor: '#22C55E', bg: '#22C55E20', icon: '🚛' },
  'chegou_entrega': { label: 'Chegou na Entrega', cor: '#3B82F6', bg: '#3B82F620', icon: '📍' },
};

const STATUS_ATIVOS = ['programada', 'aguardando_carregamento', 'seguindo_para_entrega', 'chegou_entrega'];

interface RelatorioItem {
  id: string;
  motoristaId: string;
  nome: string;
  cpf: string;
  telefone: string;
  cidade: string;
  statusLabel: string;
  statusCor: string;
  statusIcon: string;
  statusValue: string;
  placa: string;
  carreta: string;
  clienteColeta: string;
  cidadeColeta: string;
  dataColeta: string;
  clienteEntrega: string;
  cidadeEntrega: string;
  dataEntrega: string;
  localizacao: string;
  leadTime: string;
  leadTimeHoras: number;
  velocidade: number;
  temProgramacao: boolean;
  rastreadorStatus: string;
  observacao: string;
  temMopp: boolean;
}

const RelatorioListaMotorista: React.FC = () => {
  const navigate = useNavigate();
  
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [cargasPorMotorista, setCargasPorMotorista] = useState<Record<string, CargaProgramada | null>>({});
  const [veiculos, setVeiculos] = useState<Record<string, VeiculoData>>({});
  const [escalaHojePorMotorista, setEscalaHojePorMotorista] = useState<Record<string, EventoEscala | null>>({});
  const [statusSelecionado, setStatusSelecionado] = useState<Record<string, string>>({});
  const [observacoesTemp, setObservacoesTemp] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  
  // FILTROS
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroMopp, setFiltroMopp] = useState<'todos' | 'comMopp' | 'semMopp'>('todos');
  const [filtroStatusCarga, setFiltroStatusCarga] = useState<string>('todos');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroPlaca, setFiltroPlaca] = useState('');
  const [filtroRastreador, setFiltroRastreador] = useState<'todos' | 'online' | 'offline'>('todos');
  const [filtroClienteColeta, setFiltroClienteColeta] = useState('');
  const [filtroClienteEntrega, setFiltroClienteEntrega] = useState('');
  const [filtroDataInicial, setFiltroDataInicial] = useState('');
  const [filtroDataFinal, setFiltroDataFinal] = useState('');
  const [ordenarPor, setOrdenarPor] = useState<'leadTime' | 'dataEntrega' | 'nome'>('leadTime');
  const [ordenarDirecao, setOrdenarDirecao] = useState<'crescente' | 'decrescente'>('decrescente');
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);

  const hoje = new Date().toISOString().split('T')[0];

  // Carregar status e observações salvos do localStorage
  useEffect(() => {
    motoristas.forEach(m => {
      const savedStatus = localStorage.getItem(`status_motorista_${m.id}`);
      if (savedStatus) {
        setStatusSelecionado(prev => ({ ...prev, [m.id]: savedStatus }));
      }
      const savedObservacao = localStorage.getItem(`observacao_temp_${m.id}`);
      if (savedObservacao) {
        setObservacoesTemp(prev => ({ ...prev, [m.id]: savedObservacao }));
      }
    });
  }, [motoristas]);

  // Carregar veículos
  useEffect(() => {
    const loadVeiculos = async () => {
      const veiculosSnap = await getDocs(collection(db, "veiculos"));
      const veiculosMap: Record<string, VeiculoData> = {};
      veiculosSnap.forEach(doc => {
        const data = doc.data();
        let velocidadeNum = 0;
        if (data.velocidade !== undefined && data.velocidade !== null) {
          velocidadeNum = typeof data.velocidade === 'string' 
            ? parseFloat(data.velocidade) 
            : data.velocidade;
        }
        veiculosMap[data.placa] = {
          placa: data.placa,
          ultimaLocalizacao: data.ultimaLocalizacao || data.ultimoEndereco || '—',
          ultimaAtualizacaoRastreador: data.ultimaAtualizacaoRastreador || data.ultimaConsulta,
          statusRastreador: data.statusRastreador || 'offline',
          velocidade: isNaN(velocidadeNum) ? 0 : velocidadeNum,
          coordenadas: (data.coordenadas?.lat && data.coordenadas?.lng) 
            ? data.coordenadas 
            : undefined,
          ultimaMacro: data.ultimaMacro || data.ultimoStatus || undefined,
          ignicao: data.ignicao || undefined
        };
      });
      setVeiculos(veiculosMap);
    };
    loadVeiculos();
  }, []);

  // Carregar escalas do dia
  useEffect(() => {
    if (motoristas.length === 0) return;

    const loadEscalas = async () => {
      const escalasMap: Record<string, EventoEscala | null> = {};
      
      for (const motorista of motoristas) {
        if (!motorista.id) continue;
        
        try {
          const escalasRef = collection(db, 'motoristas', motorista.id, 'escalas_motoristas');
          const q = query(escalasRef, where('dataInicio', '==', hoje));
          const escalasSnap = await getDocs(q);
          
          if (!escalasSnap.empty) {
            const doc = escalasSnap.docs[0];
            escalasMap[motorista.id] = { id: doc.id, ...doc.data() } as EventoEscala;
          } else {
            escalasMap[motorista.id] = null;
          }
        } catch (error) {
          console.error(`Erro ao buscar escala do motorista ${motorista.nome}:`, error);
          escalasMap[motorista.id] = null;
        }
      }
      
      setEscalaHojePorMotorista(escalasMap);
    };
    
    loadEscalas();
  }, [motoristas, hoje]);

  // Carregar motoristas e suas cargas
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Carregar motoristas
        const motoristasSnap = await getDocs(collection(db, 'motoristas'));
        const listaMotoristas: Motorista[] = [];
        
        for (const docMotorista of motoristasSnap.docs) {
          const motoristaData = { id: docMotorista.id, ...docMotorista.data() } as Motorista;
          
          // Contar viagens realizadas
          let viagensCount = 0;
          try {
            const cargasRef = collection(db, 'motoristas', docMotorista.id, 'cargas');
            const cargasSnap = await getDocs(cargasRef);
            viagensCount = cargasSnap.docs.filter(docCarga => docCarga.data().status === 'finalizada').length;
          } catch (error) {
            console.error(`Erro ao contar viagens do motorista ${motoristaData.nome}:`, error);
          }
          
          listaMotoristas.push({ ...motoristaData, viagensRealizadas: viagensCount });
        }
        
        setMotoristas(listaMotoristas);
        
        // Carregar cargas ativas para cada motorista
        const cargasMap: Record<string, CargaProgramada | null> = {};
        for (const motorista of listaMotoristas) {
          if (!motorista.id) continue;
          
          try {
            const cargasRef = collection(db, 'motoristas', motorista.id, 'cargas');
            const q = query(
              cargasRef,
              where('status', 'in', STATUS_ATIVOS),
              orderBy('criadoEm', 'desc'),
              limit(1)
            );
            const cargasSnap = await getDocs(q);
            
            if (!cargasSnap.empty) {
              const doc = cargasSnap.docs[0];
              const cargaData = doc.data();
              cargasMap[motorista.id] = {
                id: doc.id,
                docId: doc.ref.path,
                motoristaId: motorista.id,
                ...cargaData
              } as CargaProgramada;
            } else {
              cargasMap[motorista.id] = null;
            }
          } catch (error) {
            console.error(`Erro ao buscar cargas do motorista ${motorista.nome}:`, error);
            cargasMap[motorista.id] = null;
          }
        }
        
        setCargasPorMotorista(cargasMap);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Função para calcular lead time
  const calcularLeadTime = (dataEntrega: string): { leadTime: string; horas: number } => {
    if (!dataEntrega || dataEntrega === '—') {
      return { leadTime: '—', horas: 0 };
    }
    
    try {
      let dataEntregaDate: Date;
      
      if (dataEntrega.includes('/')) {
        const partes = dataEntrega.split(' ');
        const dataPartes = partes[0].split('/');
        const horaPartes = partes[1] ? partes[1].split(':') : ['00', '00'];
        dataEntregaDate = new Date(
          parseInt(dataPartes[2]),
          parseInt(dataPartes[1]) - 1,
          parseInt(dataPartes[0]),
          parseInt(horaPartes[0]),
          parseInt(horaPartes[1])
        );
      } else {
        dataEntregaDate = new Date(dataEntrega);
      }
      
      const agora = new Date();
      const diffMs = agora.getTime() - dataEntregaDate.getTime();
      const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDias = Math.floor(diffHoras / 24);
      
      if (diffHoras < 0) {
        return { leadTime: 'Programado para o futuro', horas: 0 };
      }
      
      if (diffHoras < 1) {
        return { leadTime: 'Menos de 1 hora', horas: diffHoras };
      } else if (diffHoras < 24) {
        return { leadTime: `${diffHoras} hora(s)`, horas: diffHoras };
      } else {
        return { leadTime: `${diffDias} dia(s) e ${diffHoras % 24} hora(s)`, horas: diffHoras };
      }
    } catch (error) {
      console.error('Erro ao calcular lead time:', error);
      return { leadTime: '—', horas: 0 };
    }
  };

  // Função para obter o status do motorista (integrado com as novas funcionalidades)
  const getStatusMotorista = (motorista: Motorista, carga: CargaProgramada | null, eventoEscala: EventoEscala | null) => {
    // Se tem carga, mostra o status da carga
    if (carga) {
      const statusCarga = STATUS_CARGA_MAP[carga.status];
      if (statusCarga) {
        return { ...statusCarga, value: carga.status, isCarga: true };
      }
    }
    
    // Se tem status manual salvo, mostra ele
    const statusManual = statusSelecionado[motorista.id];
    if (statusManual && STATUS_MOTORISTA_OPTS[statusManual]) {
      const statusOpt = STATUS_MOTORISTA_OPTS[statusManual];
      return { label: statusOpt.label, cor: statusOpt.cor, bg: statusOpt.bg, icon: statusOpt.icon, value: statusManual, isManual: true };
    }
    
    // Verifica escala do dia
    if (eventoEscala) {
      if (eventoEscala.tipo === 'Descanso Semanal') {
        return { label: 'Folga', cor: '#FFD700', bg: '#FFD70020', icon: '😴', value: 'folga' };
      }
      if (eventoEscala.tipo === 'Férias') {
        return { label: 'Férias', cor: '#FFD700', bg: '#FFD70020', icon: '🏖️', value: 'ferias' };
      }
      if (eventoEscala.tipo === 'Falta') {
        return { label: 'Falta', cor: '#EF4444', bg: '#EF444420', icon: '❌', value: 'falta' };
      }
      if (eventoEscala.tipo === 'Atestado') {
        return { label: 'Atestado', cor: '#8B5CF6', bg: '#8B5CF620', icon: '📋', value: 'atestado' };
      }
    }
    
    // Se não tem carga, nem escala, está disponível
    return { label: 'Disponível para Programar', cor: '#22C55E', bg: '#22C55E20', icon: '✅', value: 'disponivel' };
  };

  // Preparar dados do relatório
  const dadosRelatorio = useMemo(() => {
    const dados: RelatorioItem[] = [];
    
    for (const motorista of motoristas) {
      const carga = cargasPorMotorista[motorista.id];
      const eventoEscala = escalaHojePorMotorista[motorista.id];
      const statusInfo = getStatusMotorista(motorista, carga, eventoEscala);
      const veiculoData = carga?.placa ? veiculos[carga.placa] : null;
      const velocidade = veiculoData?.velocidade || 0;
      const rastreadorStatus = veiculoData?.statusRastreador || 'offline';
      const localizacao = veiculoData?.ultimaLocalizacao || '—';
      const temMopp = motorista.temMopp === 'Sim';
      const observacao = observacoesTemp[motorista.id] || '';
      
      const { leadTime: leadTimeStr, horas: leadTimeHoras } = calcularLeadTime(carga?.entregaData || '—');
      
      dados.push({
        id: motorista.id,
        motoristaId: motorista.id,
        nome: motorista.nome,
        cpf: motorista.cpf,
        telefone: motorista.whatsapp || motorista.telefone || '—',
        cidade: motorista.cidade || '—',
        statusLabel: statusInfo.label,
        statusCor: statusInfo.cor,
        statusIcon: statusInfo.icon,
        statusValue: statusInfo.value,
        placa: carga?.placa || '—',
        carreta: carga?.carreta || '—',
        clienteColeta: carga?.coletaLocal || '—',
        cidadeColeta: carga?.coletaCidade || '—',
        dataColeta: carga?.coletaData || '—',
        clienteEntrega: carga?.entregaLocal || '—',
        cidadeEntrega: carga?.entregaCidade || '—',
        dataEntrega: carga?.entregaData || '—',
        localizacao: localizacao,
        leadTime: leadTimeStr,
        leadTimeHoras: leadTimeHoras,
        velocidade: velocidade,
        temProgramacao: carga !== null && carga !== undefined,
        rastreadorStatus: rastreadorStatus,
        observacao: observacao,
        temMopp: temMopp,
      });
    }
    
    // Aplicar filtros
    let filtrados = dados.filter(item => {
      const matchTexto = !filtroTexto || 
        item.nome.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        item.cpf.includes(filtroTexto) ||
        item.cidade.toLowerCase().includes(filtroTexto.toLowerCase());
      
      const matchStatus = filtroStatus === 'todos' || item.statusValue === filtroStatus;
      
      const matchMopp = filtroMopp === 'todos' ||
        (filtroMopp === 'comMopp' && item.temMopp) ||
        (filtroMopp === 'semMopp' && !item.temMopp);
      
      const matchStatusCarga = filtroStatusCarga === 'todos' || 
        (item.temProgramacao && item.statusValue === filtroStatusCarga);
      
      const matchCidade = !filtroCidade || 
        item.cidade.toLowerCase().includes(filtroCidade.toLowerCase());
      
      const matchPlaca = !filtroPlaca || 
        item.placa.toLowerCase().includes(filtroPlaca.toLowerCase());
      
      const matchRastreador = filtroRastreador === 'todos' ||
        (filtroRastreador === 'online' && item.rastreadorStatus === 'online') ||
        (filtroRastreador === 'offline' && item.rastreadorStatus === 'offline');
      
      const matchClienteColeta = !filtroClienteColeta ||
        item.clienteColeta.toLowerCase().includes(filtroClienteColeta.toLowerCase());
      
      const matchClienteEntrega = !filtroClienteEntrega ||
        item.clienteEntrega.toLowerCase().includes(filtroClienteEntrega.toLowerCase());
      
      let matchData = true;
      if (filtroDataInicial && item.dataEntrega !== '—') {
        const dataEntrega = new Date(item.dataEntrega.split('/').reverse().join('-'));
        const dataIni = new Date(filtroDataInicial);
        if (dataEntrega < dataIni) matchData = false;
      }
      if (filtroDataFinal && item.dataEntrega !== '—' && matchData) {
        const dataEntrega = new Date(item.dataEntrega.split('/').reverse().join('-'));
        const dataFim = new Date(filtroDataFinal);
        if (dataEntrega > dataFim) matchData = false;
      }
      
      return matchTexto && matchStatus && matchMopp && matchStatusCarga && 
             matchCidade && matchPlaca && matchRastreador && 
             matchClienteColeta && matchClienteEntrega && matchData;
    });
    
    // Ordenar
    filtrados.sort((a, b) => {
      let comparison = 0;
      if (ordenarPor === 'leadTime') {
        comparison = a.leadTimeHoras - b.leadTimeHoras;
      } else if (ordenarPor === 'dataEntrega') {
        if (a.dataEntrega === '—') return 1;
        if (b.dataEntrega === '—') return -1;
        const dateA = new Date(a.dataEntrega.split('/').reverse().join('-'));
        const dateB = new Date(b.dataEntrega.split('/').reverse().join('-'));
        comparison = dateA.getTime() - dateB.getTime();
      } else if (ordenarPor === 'nome') {
        comparison = a.nome.localeCompare(b.nome);
      }
      return ordenarDirecao === 'crescente' ? comparison : -comparison;
    });
    
    return filtrados;
  }, [motoristas, cargasPorMotorista, veiculos, escalaHojePorMotorista, statusSelecionado, observacoesTemp,
      filtroTexto, filtroStatus, filtroMopp, filtroStatusCarga, filtroCidade, filtroPlaca, filtroRastreador, 
      filtroClienteColeta, filtroClienteEntrega, filtroDataInicial, filtroDataFinal, ordenarPor, ordenarDirecao]);

  // Estatísticas expandidas
  const stats = useMemo(() => {
    const total = motoristas.length;
    const comProgramacao = dadosRelatorio.filter(d => d.temProgramacao).length;
    
    // Estatísticas de status dos motoristas sem programação
    const disponiveis = dadosRelatorio.filter(d => d.statusValue === 'disponivel' && !d.temProgramacao).length;
    const folga = dadosRelatorio.filter(d => d.statusValue === 'folga' && !d.temProgramacao).length;
    const ferias = dadosRelatorio.filter(d => d.statusValue === 'ferias' && !d.temProgramacao).length;
    const semVeiculo = dadosRelatorio.filter(d => d.statusValue === 'sem_veiculo' && !d.temProgramacao).length;
    const veiculoManutencao = dadosRelatorio.filter(d => d.statusValue === 'veiculo_manutencao' && !d.temProgramacao).length;
    const falta = dadosRelatorio.filter(d => d.statusValue === 'falta' && !d.temProgramacao).length;
    const atestado = dadosRelatorio.filter(d => d.statusValue === 'atestado' && !d.temProgramacao).length;
    
    const comMopp = motoristas.filter(m => m.temMopp === 'Sim').length;
    const totalViagens = motoristas.reduce((sum, m) => sum + (m.viagensRealizadas || 0), 0);
    const tempoMedioEspera = dadosRelatorio
      .filter(d => d.leadTimeHoras > 0)
      .reduce((sum, d) => sum + d.leadTimeHoras, 0) / (dadosRelatorio.filter(d => d.leadTimeHoras > 0).length || 1);
    
    return { 
      total, comProgramacao, disponiveis, folga, ferias, semVeiculo, veiculoManutencao, falta, atestado,
      comMopp, totalViagens, tempoMedioEspera
    };
  }, [motoristas, dadosRelatorio]);

  const limparTodosFiltros = () => {
    setFiltroTexto('');
    setFiltroStatus('todos');
    setFiltroMopp('todos');
    setFiltroStatusCarga('todos');
    setFiltroCidade('');
    setFiltroPlaca('');
    setFiltroRastreador('todos');
    setFiltroClienteColeta('');
    setFiltroClienteEntrega('');
    setFiltroDataInicial('');
    setFiltroDataFinal('');
    setOrdenarPor('leadTime');
    setOrdenarDirecao('decrescente');
  };

  const exportarCSV = () => {
    const headers = [
      'Status', 'Motorista', 'CPF', 'Telefone', 'Cidade', 'Placa', 'Carreta',
      'Cliente Coleta', 'Cidade Coleta', 'Data Coleta', 'Cliente Entrega',
      'Cidade Entrega', 'Data Entrega', 'Lead Time', 'Localização', 'Velocidade', 'Observação'
    ];
    
    const rows = dadosRelatorio.map(item => [
      item.statusLabel,
      item.nome,
      item.cpf,
      item.telefone,
      item.cidade,
      item.placa,
      item.carreta,
      item.clienteColeta,
      item.cidadeColeta,
      item.dataColeta,
      item.clienteEntrega,
      item.cidadeEntrega,
      item.dataEntrega,
      item.leadTime,
      item.localizacao,
      item.velocidade > 0 ? `${item.velocidade} km/h` : 'Parado',
      item.observacao
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_motoristas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getLeadTimeColor = (horas: number): string => {
    if (horas <= 0) return '#666';
    if (horas < 2) return '#22C55E';
    if (horas < 6) return '#FFD700';
    if (horas < 12) return '#FF9500';
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
    marginBottom: '24px'
  };
  
  const statCardStyle: React.CSSProperties = {
    background: '#0A0A0A',
    border: '1px solid #1F1F1F',
    borderRadius: '12px',
    padding: '12px 16px',
    textAlign: 'center'
  };
  
  const statValueStyle: React.CSSProperties = {
    fontSize: '22px',
    fontWeight: 800,
    color: '#FFD700',
    margin: 0
  };
  
  const statLabelStyle: React.CSSProperties = {
    fontSize: '10px',
    color: '#888',
    marginTop: '4px',
    textTransform: 'uppercase'
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
    maxHeight: 'calc(100vh - 400px)',
    overflowY: 'auto',
    borderRadius: '16px',
    border: '1px solid #1F1F1F'
  };
  
  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
    minWidth: '1500px'
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
            Relatório de Motoristas
          </h1>
          <p style={{ color: '#666', marginTop: '8px' }}>
            Análise completa da frota com filtros avançados e lead time de espera
          </p>
        </div>
        <button style={backButtonStyle} onClick={() => navigate('/motoristas')}>
          <ArrowLeft size={18} /> Voltar
        </button>
      </div>

      {/* Cards de Estatísticas Expandidas */}
      <div style={statsGridStyle}>
        <div style={statCardStyle}>
          <p style={statValueStyle}>{stats.total}</p>
          <p style={statLabelStyle}>Total</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#22C55E' }}>{stats.comProgramacao}</p>
          <p style={statLabelStyle}>Programados</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#3B82F6' }}>{stats.disponiveis}</p>
          <p style={statLabelStyle}>Disponíveis</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#FFD700' }}>{stats.folga}</p>
          <p style={statLabelStyle}>Folga</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#FFD700' }}>{stats.ferias}</p>
          <p style={statLabelStyle}>Férias</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#EF4444' }}>{stats.semVeiculo}</p>
          <p style={statLabelStyle}>Sem Veículo</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#FF9500' }}>{stats.veiculoManutencao}</p>
          <p style={statLabelStyle}>Veic. Manut.</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#EF4444' }}>{stats.falta}</p>
          <p style={statLabelStyle}>Falta</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#8B5CF6' }}>{stats.atestado}</p>
          <p style={statLabelStyle}>Atestado</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#8B5CF6' }}>{stats.comMopp}</p>
          <p style={statLabelStyle}>Com MOPP</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#FF9500' }}>{stats.totalViagens}</p>
          <p style={statLabelStyle}>Viagens</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ ...statValueStyle, color: '#3B82F6' }}>
            {stats.tempoMedioEspera > 0 ? `${Math.round(stats.tempoMedioEspera)}h` : '—'}
          </p>
          <p style={statLabelStyle}>Tempo Médio</p>
        </div>
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
          {(filtroTexto || filtroStatus !== 'todos' || filtroMopp !== 'todos' || filtroStatusCarga !== 'todos' ||
            filtroCidade || filtroPlaca || filtroRastreador !== 'todos' || filtroClienteColeta || filtroClienteEntrega ||
            filtroDataInicial || filtroDataFinal) && (
            <button style={clearButtonStyle} onClick={limparTodosFiltros}>
              <X size={14} /> Limpar Filtros
            </button>
          )}
        </div>
        <div style={searchWrapperStyle}>
          <Search size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou cidade..."
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
              <label style={filterLabelStyle}>Status do Motorista</label>
              <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={selectStyle}>
                <option value="todos">Todos</option>
                <option value="disponivel">✅ Disponível</option>
                <option value="programada">📋 Programado</option>
                <option value="aguardando_carregamento">⏳ Aguardando Carregamento</option>
                <option value="seguindo_para_entrega">🚛 Seguindo para Entrega</option>
                <option value="chegou_entrega">📍 Chegou na Entrega</option>
                <option value="folga">😴 Folga</option>
                <option value="ferias">🏖️ Férias</option>
                <option value="sem_veiculo">🚫 Sem Veículo</option>
                <option value="falta">❌ Falta</option>
                <option value="atestado">📋 Atestado</option>
                <option value="veiculo_manutencao">🔧 Veículo em Manutenção</option>
              </select>
            </div>
            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>MOPP</label>
              <select value={filtroMopp} onChange={(e) => setFiltroMopp(e.target.value as any)} style={selectStyle}>
                <option value="todos">Todos</option>
                <option value="comMopp">✅ Com MOPP</option>
                <option value="semMopp">❌ Sem MOPP</option>
              </select>
            </div>
            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>Status Rastreador</label>
              <select value={filtroRastreador} onChange={(e) => setFiltroRastreador(e.target.value as any)} style={selectStyle}>
                <option value="todos">Todos</option>
                <option value="online">🟢 Online</option>
                <option value="offline">🔴 Offline</option>
              </select>
            </div>
            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>Cidade Residência</label>
              <input type="text" placeholder="Cidade..." value={filtroCidade} onChange={(e) => setFiltroCidade(e.target.value)} style={filterInputStyle} />
            </div>
            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>Placa do Veículo</label>
              <input type="text" placeholder="Placa..." value={filtroPlaca} onChange={(e) => setFiltroPlaca(e.target.value.toUpperCase())} style={filterInputStyle} />
            </div>
            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>Cliente Coleta</label>
              <input type="text" placeholder="Cliente..." value={filtroClienteColeta} onChange={(e) => setFiltroClienteColeta(e.target.value)} style={filterInputStyle} />
            </div>
            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>Cliente Entrega</label>
              <input type="text" placeholder="Cliente..." value={filtroClienteEntrega} onChange={(e) => setFiltroClienteEntrega(e.target.value)} style={filterInputStyle} />
            </div>
            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>Data Entrega (Início)</label>
              <input type="date" value={filtroDataInicial} onChange={(e) => setFiltroDataInicial(e.target.value)} style={filterInputStyle} />
            </div>
            <div style={filterGroupStyle}>
              <label style={filterLabelStyle}>Data Entrega (Fim)</label>
              <input type="date" value={filtroDataFinal} onChange={(e) => setFiltroDataFinal(e.target.value)} style={filterInputStyle} />
            </div>
          </div>
        </div>
      )}

      {/* Ordenação */}
      <div style={ordenacaoBarStyle}>
        <div style={ordenacaoButtonsStyle}>
          <span style={{ fontSize: '12px', color: '#888' }}>Ordenar por:</span>
          <button
            style={ordenacaoBtnStyle(ordenarPor === 'leadTime')}
            onClick={() => setOrdenarPor('leadTime')}
          >
            <TrendingDown size={12} /> Lead Time
          </button>
          <button
            style={ordenacaoBtnStyle(ordenarPor === 'dataEntrega')}
            onClick={() => setOrdenarPor('dataEntrega')}
          >
            <CalendarIcon size={12} /> Data Entrega
          </button>
          <button
            style={ordenacaoBtnStyle(ordenarPor === 'nome')}
            onClick={() => setOrdenarPor('nome')}
          >
            <User size={12} /> Nome
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
          📊 {dadosRelatorio.length} motorista(s) encontrado(s)
        </span>
      </div>

      {/* Tabela de Relatório */}
      <div style={tableContainerStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Motorista</th>
              <th style={thStyle}>CPF</th>
              <th style={thStyle}>Telefone</th>
              <th style={thStyle}>Placa</th>
              <th style={thStyle}>Carreta</th>
              <th style={thStyle}>Cliente Coleta</th>
              <th style={thStyle}>Cidade Coleta</th>
              <th style={thStyle}>Data Coleta</th>
              <th style={thStyle}>Cliente Entrega</th>
              <th style={thStyle}>Cidade Entrega</th>
              <th style={thStyle}>Data Entrega</th>
              <th style={thStyle}>Lead Time</th>
              <th style={thStyle}>Localização</th>
              <th style={thStyle}>Observação</th>
            </tr>
          </thead>
          <tbody>
            {dadosRelatorio.length === 0 ? (
              <tr>
                <td colSpan={15} style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
                  <AlertCircle size={40} color="#666" />
                  <p style={{ marginTop: '12px' }}>Nenhum motorista encontrado com os filtros aplicados</p>
                </td>
              </tr>
            ) : (
              dadosRelatorio.map((item, idx) => (
                <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? '#0A0A0A' : '#0F0F0F' }}>
                  <td style={tdStyle}>
                    <span style={{ color: item.statusCor, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {item.statusIcon} {item.statusLabel}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <strong style={{ color: '#FFF' }}>{item.nome}</strong>
                    <div style={{ fontSize: '10px', color: '#666' }}>📍 {item.cidade}</div>
                    {item.temMopp && <div style={{ fontSize: '9px', color: '#22C55E', marginTop: '2px' }}>✅ MOPP</div>}
                  </td>
                  <td style={tdStyle}>{item.cpf}</td>
                  <td style={tdStyle}>
                    {item.telefone !== '—' ? (
                      <a href={`https://wa.me/55${item.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', textDecoration: 'none' }}>
                        <Phone size={12} style={{ display: 'inline', marginRight: '4px' }} /> {item.telefone}
                      </a>
                    ) : '—'}
                  </td>
                  <td style={tdStyle}>
                    {item.placa !== '—' ? <span style={{ color: '#FFD700', fontWeight: 600 }}>{item.placa}</span> : '—'}
                  </td>
                  <td style={tdStyle}>
                    {item.carreta !== '—' && item.carreta !== item.placa ? 
                      <span style={{ color: '#FF9500' }}>{item.carreta}</span> : '—'}
                  </td>
                  <td style={tdStyle}>
                    {item.clienteColeta !== '—' ? (
                      <div>
                        <div>{item.clienteColeta.length > 30 ? item.clienteColeta.substring(0, 27) + '...' : item.clienteColeta}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={tdStyle}>
                    {item.cidadeColeta !== '—' ? <span style={{ color: '#3B82F6' }}>{item.cidadeColeta}</span> : '—'}
                  </td>
                  <td style={tdStyle}>{item.dataColeta !== '—' ? item.dataColeta : '—'}</td>
                  <td style={tdStyle}>
                    {item.clienteEntrega !== '—' ? (
                      <div>
                        <div>{item.clienteEntrega.length > 30 ? item.clienteEntrega.substring(0, 27) + '...' : item.clienteEntrega}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={tdStyle}>
                    {item.cidadeEntrega !== '—' ? <span style={{ color: '#10b981' }}>{item.cidadeEntrega}</span> : '—'}
                  </td>
                  <td style={tdStyle}>
                    {item.dataEntrega !== '—' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={10} color="#FFD700" />
                        <span>{item.dataEntrega}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={tdStyle}>
                    {item.leadTime !== '—' && item.leadTimeHoras > 0 ? (
                      <div>
                        <span style={{ 
                          color: getLeadTimeColor(item.leadTimeHoras),
                          fontWeight: 700,
                          fontSize: '13px'
                        }}>
                          ⏱️ {item.leadTime}
                        </span>
                        {item.leadTimeHoras > 12 && (
                          <div style={{ fontSize: '10px', color: '#EF4444', marginTop: '2px' }}>
                            ⚠️ Atraso crítico
                          </div>
                        )}
                      </div>
                    ) : item.leadTime === 'Programado para o futuro' ? (
                      <span style={{ color: '#3B82F6' }}>📅 Futuro</span>
                    ) : '—'}
                  </td>
                  <td style={tdStyle}>
                    {item.localizacao !== '—' ? (
                      <div>
                        <div style={{ color: '#22C55E', fontSize: '11px' }}>
                          📍 {item.localizacao.length > 40 ? item.localizacao.substring(0, 37) + '...' : item.localizacao}
                        </div>
                        {item.velocidade > 0 && (
                          <div style={{ fontSize: '10px', color: '#FFD700', marginTop: '4px' }}>
                            🏎️ {item.velocidade} km/h
                          </div>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                  <td style={tdStyle}>
                    {item.observacao ? (
                      <div style={{ fontSize: '11px', color: '#FFD700', maxWidth: '200px' }}>
                        <Edit3 size={10} style={{ display: 'inline', marginRight: '4px' }} />
                        {item.observacao.length > 40 ? item.observacao.substring(0, 37) + '...' : item.observacao}
                      </div>
                    ) : '—'}
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

export default RelatorioListaMotorista;