import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import { 
  Eye, Search, MapPin, Truck, Package, AlertCircle, Clock, X, Filter, ChevronDown, 
  Calendar, CheckCircle, Circle, WifiOff, Compass, Smartphone, Activity 
} from 'lucide-react';
import L from 'leaflet';
import { db } from "./firebase";
import { collection, onSnapshot, query, orderBy, limit, where, doc, getDoc } from "firebase/firestore";

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix Leaflet Icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const caminhaoIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [46, 46],
    iconAnchor: [23, 46],
    popupAnchor: [0, -46],
});

const ChangeView = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, zoom, { duration: 1.6 });
    }, [center, zoom, map]);
    return null;
};

// MESMOS STATUS DO APP
const STATUS_ATIVOS = ['programada', 'aguardando_carregamento', 'seguindo_para_entrega', 'chegou_entrega'];

// MAPEAMENTO DE STATUS DO HISTÓRICO DE CHECKINS
const getStatusFromCheckin = (tipo?: string) => {
    const statusMap: any = {
        'chegada_coleta':   { label: 'Chegada na Coleta',   color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', icon: '📍', step: 1 },
        'saida_coleta':     { label: 'Saída da Coleta',     color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: '🚚', step: 2 },
        'chegada_entrega':  { label: 'Chegada na Entrega',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', icon: '🏭', step: 3 },
        'saida_entrega':    { label: 'Saída da Entrega',    color: '#059669', bg: 'rgba(5,150,105,0.15)', icon: '✅', step: 4 },
        'inicio_viagem':    { label: 'Início da Viagem',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: '🚛', step: 0 },
    };
    return statusMap[tipo?.toLowerCase() || ''];
};

// MAPEAMENTO DE STATUS DAS CARGAS (MESMOS DO APP)
const getStatusFromCarga = (status?: string) => {
    const statusMap: any = {
        'programada':               { label: 'Programada', color: '#FFD700', bg: 'rgba(255,215,0,0.15)', icon: '📋', step: 0 },
        'aguardando_carregamento':  { label: 'Aguardando Carregamento', color: '#FF9500', bg: 'rgba(255,149,0,0.15)', icon: '⏳', step: 1 },
        'seguindo_para_entrega':    { label: 'Seguindo para Entrega', color: '#22C55E', bg: 'rgba(34,197,94,0.15)', icon: '🚛', step: 2 },
        'chegou_entrega':           { label: 'Chegou na Entrega', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', icon: '📍', step: 3 },
        'finalizada':               { label: 'Finalizada', color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: '🏁', step: 5 },
        'cancelada':                { label: 'Cancelada', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: '❌', step: -1 },
    };
    return statusMap[status?.toLowerCase() || ''] || { label: 'Aguardando', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: '⏳', step: 0 };
};

interface CargaData {
    id: string;
    motoristaId?: string;
    cpf?: string;
    motorista?: string;
    coletaLocal?: string;
    coletaCidade?: string;
    entregaLocal?: string;
    entregaCidade?: string;
    placa?: string;
    carreta?: string;
    status?: string;
    coletaData?: string;
    entregaData?: string;
    dt?: string;
}

interface LocalizacaoData {
    latitude: number;
    longitude: number;
    cidadeNome?: string;
    cidade?: string;
    dataHora?: string;
    timestamp?: any;
}

interface HistoricoCheckinData {
    id: string;
    viagemId?: string;
    tipo?: string;
    timestamp?: any;
    dataHora?: string;
}

interface MotoristaData {
    id: string;
    nome: string;
    cpf: string;
    telefone?: string;
    whatsapp?: string;
    cidade?: string;
}

interface FiltrosState {
    motorista: string;
    status: string;
    coletaCliente: string;
    entregaCliente: string;
    placa: string;
    cidade: string;
    comGPS: boolean;
    semGPS: boolean;
}

const ProgramacaoMapa = () => {
    const [motoristas, setMotoristas] = useState<MotoristaData[]>([]);
    const [cargas, setCargas] = useState<Record<string, CargaData>>({});
    const [localizacoes, setLocalizacoes] = useState<Record<string, LocalizacaoData>>({});
    const [ultimoCheckin, setUltimoCheckin] = useState<Record<string, HistoricoCheckinData>>({});
    const [filtros, setFiltros] = useState<FiltrosState>({
        motorista: '', status: '', coletaCliente: '', entregaCliente: '', placa: '', cidade: '', comGPS: false, semGPS: false
    });
    const [filtrosAbertos, setFiltrosAbertos] = useState(false);
    const [mapFocus, setMapFocus] = useState({ center: [-21.78, -48.17] as [number, number], zoom: 6 });
    const [modalVisible, setModalVisible] = useState(false);
    const [motoristaSelecionado, setMotoristaSelecionado] = useState<any>(null);

    // Buscar motoristas
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "motoristas"), (snap) => {
            const lista: MotoristaData[] = [];
            snap.forEach(doc => {
                const data = doc.data();
                lista.push({
                    id: doc.id,
                    nome: data.nome || 'NÃO INFORMADO',
                    cpf: data.cpf || '—',
                    telefone: data.telefone || data.celular || data.whatsapp || '—',
                    whatsapp: data.whatsapp,
                    cidade: data.cidade || '—'
                });
            });
            setMotoristas(lista);
        });
        return () => unsub();
    }, []);

    // Buscar cargas ATIVAS - MESMOS STATUS DO APP
    useEffect(() => {
        if (motoristas.length === 0) return;
        const unsubs: (() => void)[] = [];
        
        motoristas.forEach(motorista => {
            const cargasRef = collection(db, `motoristas/${motorista.id}/cargas`);
            const q = query(cargasRef, where('status', 'in', STATUS_ATIVOS));
            
            const unsub = onSnapshot(q, (snap) => {
                snap.forEach(doc => {
                    const data = doc.data();
                    setCargas(prev => ({
                        ...prev,
                        [doc.id]: {
                            id: doc.id,
                            motoristaId: motorista.id,
                            motorista: motorista.nome,
                            cpf: data.cpf || motorista.cpf,
                            coletaLocal: data.coletaLocal || data.coleta || '—',
                            coletaCidade: data.coletaCidade || '—',
                            entregaLocal: data.entregaLocal || data.entrega || '—',
                            entregaCidade: data.entregaCidade || '—',
                            placa: data.placa || data.veiculo || '—',
                            carreta: data.carreta || '—',
                            status: data.status,
                            coletaData: data.coletaData || data.dataColeta || '—',
                            entregaData: data.entregaData || data.dataEntrega || '—',
                            dt: data.dt || '—',
                        }
                    }));
                });
            });
            unsubs.push(unsub);
        });
        
        return () => unsubs.forEach(u => u());
    }, [motoristas]);

    // Buscar localizações - PRIORIZA O DOCUMENTO 'atual' (salvo pelo app)
    useEffect(() => {
        if (motoristas.length === 0) return;
        const unsubs: (() => void)[] = [];
        
        motoristas.forEach(motorista => {
            const localizacaoAtualRef = doc(db, `motoristas/${motorista.id}/localizacoes`, 'atual');
            const unsub = onSnapshot(localizacaoAtualRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as LocalizacaoData;
                    if (data?.latitude && data?.longitude) {
                        setLocalizacoes(prev => ({ 
                            ...prev, 
                            [motorista.id]: {
                                latitude: data.latitude,
                                longitude: data.longitude,
                                cidadeNome: data.cidadeNome || data.cidade || '—',
                                dataHora: data.dataHora || (data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString('pt-BR') : '—')
                            }
                        }));
                    }
                } else {
                    // Fallback: busca a última localização da coleção
                    const localizacoesRef = collection(db, `motoristas/${motorista.id}/localizacoes`);
                    const q = query(localizacoesRef, orderBy('timestamp', 'desc'), limit(1));
                    const unsubFallback = onSnapshot(q, (snap) => {
                        if (!snap.empty) {
                            const data = snap.docs[0].data() as LocalizacaoData;
                            if (data?.latitude && data?.longitude) {
                                setLocalizacoes(prev => ({ 
                                    ...prev, 
                                    [motorista.id]: {
                                        latitude: data.latitude,
                                        longitude: data.longitude,
                                        cidadeNome: data.cidadeNome || data.cidade || '—',
                                        dataHora: data.dataHora || (data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString('pt-BR') : '—')
                                    }
                                }));
                            }
                        }
                    });
                    unsubs.push(unsubFallback);
                }
            });
            unsubs.push(unsub);
        });
        
        return () => unsubs.forEach(u => u());
    }, [motoristas]);

    // Buscar último check-in de cada carga
    useEffect(() => {
        if (motoristas.length === 0) return;
        const unsubs: (() => void)[] = [];
        
        motoristas.forEach(motorista => {
            const historicoRef = collection(db, `motoristas/${motorista.id}/historicoCheckins`);
            const q = query(historicoRef, orderBy('timestamp', 'desc'), limit(1));
            const unsub = onSnapshot(q, (snap) => {
                if (!snap.empty) {
                    const data = snap.docs[0].data() as HistoricoCheckinData;
                    setUltimoCheckin(prev => ({ 
                        ...prev, 
                        [motorista.id]: {
                            id: snap.docs[0].id,
                            viagemId: data.viagemId,
                            tipo: data.tipo,
                            timestamp: data.timestamp,
                            dataHora: data.dataHora || (data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString('pt-BR') : '—')
                        }
                    }));
                } else {
                    setUltimoCheckin(prev => ({ ...prev, [motorista.id]: undefined }));
                }
            });
            unsubs.push(unsub);
        });
        
        return () => unsubs.forEach(u => u());
    }, [motoristas]);

    // Combinar dados - APENAS motoristas com cargas ativas
    const dadosCombinados = useMemo(() => {
        // Pega todos os motoristas que têm carga ativa
        const motoristasComCargaAtiva = motoristas.filter(motorista => {
            return Object.values(cargas).some(c => c.motoristaId === motorista.id);
        });

        return motoristasComCargaAtiva.map(motorista => {
            const cargaAtiva = Object.values(cargas).find(c => c.motoristaId === motorista.id);
            const checkin = ultimoCheckin[motorista.id];
            const loc = localizacoes[motorista.id];
            
            // Prioriza status do checkin, se não tiver, usa status da carga
            let statusInfo;
            if (checkin?.tipo) {
                statusInfo = getStatusFromCheckin(checkin.tipo);
            }
            if (!statusInfo && cargaAtiva?.status) {
                statusInfo = getStatusFromCarga(cargaAtiva.status);
            }
            if (!statusInfo) {
                statusInfo = getStatusFromCarga('aguardando_carregamento');
            }

            // Determina se tem checkin de coleta/entrega
            const temCheckinColeta = checkin?.tipo === 'chegada_coleta' || checkin?.tipo === 'saida_coleta';
            const temCheckinEntrega = checkin?.tipo === 'chegada_entrega' || checkin?.tipo === 'saida_entrega';

            // Formata localização para exibição
            const clienteColetaDisplay = cargaAtiva?.coletaCidade && cargaAtiva?.coletaLocal 
                ? `${cargaAtiva.coletaCidade} - ${cargaAtiva.coletaLocal}`
                : cargaAtiva?.coletaLocal || '—';
            
            const clienteEntregaDisplay = cargaAtiva?.entregaCidade && cargaAtiva?.entregaLocal
                ? `${cargaAtiva.entregaCidade} - ${cargaAtiva.entregaLocal}`
                : cargaAtiva?.entregaLocal || '—';

            return {
                id: motorista.id,
                motoristaNome: motorista.nome,
                motoristaCpf: motorista.cpf,
                motoristaTelefone: motorista.telefone,
                status: statusInfo.label,
                statusRaw: checkin?.tipo || cargaAtiva?.status || '',
                statusColor: statusInfo.color,
                statusBg: statusInfo.bg,
                statusIcon: statusInfo.icon,
                statusStep: statusInfo.step,
                clienteColeta: clienteColetaDisplay,
                clienteEntrega: clienteEntregaDisplay,
                placa: cargaAtiva?.placa || '—',
                carreta: cargaAtiva?.carreta || '—',
                coletaData: cargaAtiva?.coletaData || '—',
                entregaData: cargaAtiva?.entregaData || '—',
                dt: cargaAtiva?.dt || '—',
                checkinColeta: checkin?.dataHora && temCheckinColeta ? checkin.dataHora : '—',
                checkinEntrega: checkin?.dataHora && temCheckinEntrega ? checkin.dataHora : '—',
                temCheckinColeta,
                temCheckinEntrega,
                localizacao: loc,
                cidade: loc?.cidadeNome || loc?.cidade || motorista.cidade || '—',
                temGPS: !!(loc?.latitude && loc?.longitude),
                ultimaAtualizacao: loc?.dataHora || '—',
                cargaId: cargaAtiva?.id,
            };
        });
    }, [motoristas, cargas, localizacoes, ultimoCheckin]);

    // Aplicar filtros
    const dadosFiltrados = useMemo(() => {
        return dadosCombinados.filter(item => {
            if (filtros.motorista && !item.motoristaNome.toLowerCase().includes(filtros.motorista.toLowerCase()) && !item.motoristaCpf.includes(filtros.motorista)) return false;
            if (filtros.status && item.statusRaw !== filtros.status) return false;
            if (filtros.coletaCliente && !item.clienteColeta.toLowerCase().includes(filtros.coletaCliente.toLowerCase())) return false;
            if (filtros.entregaCliente && !item.clienteEntrega.toLowerCase().includes(filtros.entregaCliente.toLowerCase())) return false;
            if (filtros.placa && !item.placa.toLowerCase().includes(filtros.placa.toLowerCase())) return false;
            if (filtros.cidade && !item.cidade.toLowerCase().includes(filtros.cidade.toLowerCase())) return false;
            if (filtros.comGPS && !item.temGPS) return false;
            if (filtros.semGPS && item.temGPS) return false;
            return true;
        });
    }, [dadosCombinados, filtros]);

    const limparFiltros = () => setFiltros({ motorista: '', status: '', coletaCliente: '', entregaCliente: '', placa: '', cidade: '', comGPS: false, semGPS: false });
    const temFiltrosAtivos = () => Object.values(filtros).some(v => v !== '' && v !== false);
    const ativosComGPS = dadosFiltrados.filter(d => d.temGPS).length;

    const abrirModal = (motorista: any) => { setMotoristaSelecionado(motorista); setModalVisible(true); };
    const fecharModal = () => { setModalVisible(false); setMotoristaSelecionado(null); };

    const getProgresso = (step: number) => {
        if (step < 0) return 0;
        if (step >= 5) return 100;
        return (step / 5) * 100;
    };

    return (
        <div style={styles.container}>
            <div style={styles.bgGradient}></div>
            
            <div style={styles.content}>
                {/* Header */}
                <div style={styles.header}>
                    <div>
                        <div style={styles.headerBadge}>
                            <Activity size={14} />
                            <span>MONITORAMENTO EM TEMPO REAL</span>
                        </div>
                        <h1 style={styles.title}>
                            Controle de Frota <span style={styles.highlight}>Inteligente</span>
                        </h1>
                        <p style={styles.subtitle}>Acompanhamento de viagens ativas, check-ins e localização ao vivo</p>
                    </div>

                    <div style={styles.statsContainer}>
                        <div style={styles.statCard}>
                            <Truck size={24} color="#FFD700" />
                            <div>
                                <div style={styles.statValue}>{dadosFiltrados.length}</div>
                                <div style={styles.statLabel}>Viagens Ativas</div>
                            </div>
                        </div>
                        <div style={styles.statCard}>
                            <Package size={24} color="#10b981" />
                            <div>
                                <div style={styles.statValue}>{dadosFiltrados.filter(d => d.cargaId).length}</div>
                                <div style={styles.statLabel}>Em Rota</div>
                            </div>
                        </div>
                        <div style={styles.statCard}>
                            <Smartphone size={24} color="#3b82f6" />
                            <div>
                                <div style={styles.statValue}>{ativosComGPS}</div>
                                <div style={styles.statLabel}>Com Sinal GPS</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Barra de Filtros */}
                <div style={styles.filterBar}>
                    <div style={styles.filterGroup}>
                        <button 
                            style={{...styles.filterBtn, ...(filtrosAbertos ? styles.filterBtnActive : {})}} 
                            onClick={() => setFiltrosAbertos(!filtrosAbertos)}
                        >
                            <Filter size={15} /> Filtros 
                            <ChevronDown size={15} style={{ transform: filtrosAbertos ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
                        </button>
                        {temFiltrosAtivos() && (
                            <button style={styles.clearBtn} onClick={limparFiltros}>
                                <X size={14} /> Limpar Filtros
                            </button>
                        )}
                    </div>

                    <div style={styles.searchBox}>
                        <Search size={16} color="#71717a" />
                        <input 
                            type="text" 
                            placeholder="Buscar motorista, CPF ou placa..." 
                            value={filtros.motorista} 
                            onChange={(e) => setFiltros({...filtros, motorista: e.target.value})} 
                            style={styles.searchInput} 
                        />
                    </div>
                </div>

                {/* Filtros Avançados */}
                {filtrosAbertos && (
                    <div style={styles.filtersPanel}>
                        <div style={styles.filtersRow}>
                            <select style={styles.filterSelect} value={filtros.status} onChange={(e) => setFiltros({...filtros, status: e.target.value})}>
                                <option value="">Todos os Status</option>
                                <option value="chegada_coleta">📍 Chegada na Coleta</option>
                                <option value="saida_coleta">🚚 Saída da Coleta</option>
                                <option value="chegada_entrega">🏭 Chegada na Entrega</option>
                                <option value="saida_entrega">✅ Saída da Entrega</option>
                                <option value="inicio_viagem">🚛 Início da Viagem</option>
                                <option value="programada">📋 Programada</option>
                                <option value="aguardando_carregamento">⏳ Aguardando Carregamento</option>
                                <option value="seguindo_para_entrega">🚛 Seguindo para Entrega</option>
                                <option value="chegou_entrega">📍 Chegou na Entrega</option>
                            </select>
                            <input 
                                type="text" 
                                placeholder="Cliente de Coleta..." 
                                value={filtros.coletaCliente} 
                                onChange={(e) => setFiltros({...filtros, coletaCliente: e.target.value})} 
                                style={styles.filterInput} 
                            />
                            <input 
                                type="text" 
                                placeholder="Cliente de Entrega..." 
                                value={filtros.entregaCliente} 
                                onChange={(e) => setFiltros({...filtros, entregaCliente: e.target.value})} 
                                style={styles.filterInput} 
                            />
                            <input type="text" placeholder="Placa..." value={filtros.placa} onChange={(e) => setFiltros({...filtros, placa: e.target.value.toUpperCase()})} style={styles.filterInput} />
                            <input type="text" placeholder="Cidade..." value={filtros.cidade} onChange={(e) => setFiltros({...filtros, cidade: e.target.value})} style={styles.filterInput} />
                            
                            <div style={styles.gpsFilter}>
                                <label style={styles.gpsLabel}>
                                    <input type="checkbox" checked={filtros.comGPS} onChange={(e) => setFiltros({...filtros, comGPS: e.target.checked, semGPS: false})} /> 📡 Com GPS
                                </label>
                                <label style={styles.gpsLabel}>
                                    <input type="checkbox" checked={filtros.semGPS} onChange={(e) => setFiltros({...filtros, semGPS: e.target.checked, comGPS: false})} /> 📴 Sem GPS
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mapa */}
                <div style={styles.mapCard}>
                    <div style={styles.mapHeader}>
                        <div style={styles.mapTitle}>
                            <Compass size={18} color="#FFD700" /> Mapa de Localização em Tempo Real
                        </div>
                        <div style={styles.mapStatus}>
                            <div style={styles.mapDot}></div> {ativosComGPS} veículos com sinal ativo
                        </div>
                    </div>
                    <div style={styles.mapContainer}>
                        <MapContainer center={mapFocus.center} zoom={mapFocus.zoom} style={{ height: '100%', width: '100%' }}>
                            <ChangeView center={mapFocus.center} zoom={mapFocus.zoom} />
                            <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
                            <MarkerClusterGroup chunkedLoading>
                                {dadosFiltrados.filter(i => i.temGPS).map(item => (
                                    <Marker key={item.id} position={[item.localizacao.latitude, item.localizacao.longitude]} icon={caminhaoIcon}>
                                        <Popup>
                                            <div style={{ padding: '10px', minWidth: '220px' }}>
                                                <strong style={{ fontSize: '15px', color: '#FFD700' }}>{item.motoristaNome}</strong><br />
                                                <span style={{ color: item.statusColor }}>{item.status}</span><br />
                                                <span style={{ fontSize: '12px', color: '#aaa' }}>📍 {item.cidade}</span><br />
                                                <span style={{ fontSize: '11px', color: '#666' }}>🕒 {item.ultimaAtualizacao}</span><br />
                                                <span style={{ fontSize: '11px', color: '#666' }}>🚛 Placa: {item.placa}</span>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </MarkerClusterGroup>
                        </MapContainer>
                    </div>
                </div>

                {/* Tabela */}
                <div style={styles.tableCard}>
                    <div style={styles.tableHeader}>
                        <div style={styles.tableTitle}>
                            <Package size={18} color="#e5e7eb" /> Viagens Ativas
                        </div>
                        <div style={styles.tableInfo}>{dadosFiltrados.length} viagem(ns) ativa(s)</div>
                    </div>
                    <div style={styles.tableContainer}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}></th>
                                    <th style={styles.th}>MOTORISTA</th>
                                    <th style={styles.th}>STATUS</th>
                                    <th style={styles.th}>CLIENTE COLETA</th>
                                    <th style={styles.th}>CLIENTE ENTREGA</th>
                                    <th style={styles.th}>DATA COLETA</th>
                                    <th style={styles.th}>DATA ENTREGA</th>
                                    <th style={styles.th}>CHECK-IN COLETA</th>
                                    <th style={styles.th}>CHECK-IN ENTREGA</th>
                                    <th style={styles.th}>VEÍCULO</th>
                                    <th style={styles.th}>LOCALIZAÇÃO</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dadosFiltrados.map((item, idx) => {
                                    const progresso = getProgresso(item.statusStep);
                                    
                                    return (
                                        <tr key={item.id} style={{...styles.tr, animationDelay: `${idx * 0.035}s`}} className="fade-in">
                                            <td style={styles.tdAction}>
                                                {item.temGPS ? (
                                                    <button onClick={() => abrirModal(item)} style={styles.mapBtn} title="Ver no mapa">
                                                        <Eye size={16} />
                                                    </button>
                                                ) : (
                                                    <span style={styles.offlineIcon} title="Sem sinal GPS"><WifiOff size={18} /></span>
                                                )}
                                            </td>
                                            <td style={styles.td}>
                                                <div style={styles.driverInfo}>
                                                    <div style={styles.avatar}>{item.motoristaNome.charAt(0).toUpperCase()}</div>
                                                    <div>
                                                        <div style={styles.driverName}>{item.motoristaNome}</div>
                                                        <div style={styles.driverDetail}>{item.motoristaCpf}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={styles.td}>
                                                <div style={{ position: 'relative' }}>
                                                    <span style={{...styles.statusChip, background: item.statusBg, color: item.statusColor}}>
                                                        {item.statusIcon} {item.status}
                                                    </span>
                                                    {item.statusStep >= 0 && item.statusStep < 5 && (
                                                        <div style={styles.progressBar}>
                                                            <div style={{...styles.progressFill, width: `${progresso}%`}}></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={styles.td}>
                                                <div style={styles.locationCell} title={item.clienteColeta}>
                                                    <MapPin size={14} color="#10b981" />
                                                    <span>{item.clienteColeta.length > 40 ? item.clienteColeta.substring(0, 37) + '...' : item.clienteColeta}</span>
                                                </div>
                                            </td>
                                            <td style={styles.td}>
                                                <div style={styles.locationCell} title={item.clienteEntrega}>
                                                    <MapPin size={14} color="#f59e0b" />
                                                    <span>{item.clienteEntrega.length > 40 ? item.clienteEntrega.substring(0, 37) + '...' : item.clienteEntrega}</span>
                                                </div>
                                            </td>
                                            <td style={styles.td}>
                                                {item.coletaData !== '—' ? (
                                                    <div style={styles.dateCell}>
                                                        <Calendar size={14} />
                                                        <span>{item.coletaData}</span>
                                                    </div>
                                                ) : <span style={styles.emptyValue}>—</span>}
                                            </td>
                                            <td style={styles.td}>
                                                {item.entregaData !== '—' ? (
                                                    <div style={styles.dateCell}>
                                                        <Calendar size={14} />
                                                        <span>{item.entregaData}</span>
                                                    </div>
                                                ) : <span style={styles.emptyValue}>—</span>}
                                            </td>
                                            <td style={styles.td}>
                                                {item.temCheckinColeta ? (
                                                    <div style={styles.checkinSuccess}>
                                                        <CheckCircle size={14} />
                                                        <span>{item.checkinColeta}</span>
                                                    </div>
                                                ) : (
                                                    <div style={styles.checkinPending}>
                                                        <Circle size={14} />
                                                        <span>Pendente</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={styles.td}>
                                                {item.temCheckinEntrega ? (
                                                    <div style={styles.checkinSuccess}>
                                                        <CheckCircle size={14} />
                                                        <span>{item.checkinEntrega}</span>
                                                    </div>
                                                ) : (
                                                    <div style={styles.checkinPending}>
                                                        <Circle size={14} />
                                                        <span>Pendente</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={styles.td}>
                                                <span style={styles.plateChip}>{item.placa}</span>
                                                {item.carreta !== '—' && <span style={{...styles.plateChip, marginLeft: '6px', background: 'rgba(255,215,0,0.08)' }}>{item.carreta}</span>}
                                            </td>
                                            <td style={styles.td}>
                                                {item.temGPS ? (
                                                    <div style={styles.locationCompact}>
                                                        <div style={styles.cityName}>
                                                            <MapPin size={12} />
                                                            <strong>{item.cidade}</strong>
                                                        </div>
                                                        <div style={styles.coords}>
                                                            {item.localizacao?.latitude?.toFixed(4)}°, {item.localizacao?.longitude?.toFixed(4)}°
                                                        </div>
                                                        <div style={styles.timeAgo}>
                                                            <Clock size={10} />
                                                            {item.ultimaAtualizacao !== '—' ? item.ultimaAtualizacao.substring(0, 16) : '—'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={styles.offlineText}>
                                                        <WifiOff size={14} />
                                                        <span>Offline</span>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}

                                {dadosFiltrados.length === 0 && (
                                    <tr>
                                        <td colSpan={11} style={styles.emptyState}>
                                            <AlertCircle size={42} color="#52525b" />
                                            <p>Nenhuma viagem ativa encontrada com os filtros aplicados</p>
                                            <button onClick={limparFiltros} style={styles.resetBtn}>Limpar todos os filtros</button>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {modalVisible && motoristaSelecionado && (
                <div style={styles.modalOverlay} onClick={fecharModal}>
                    <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <div style={styles.modalTitle}>
                                <MapPin size={20} color="#FFD700" />
                                Localização - {motoristaSelecionado.motoristaNome}
                            </div>
                            <button style={styles.modalClose} onClick={fecharModal}>
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div style={styles.modalInfo}>
                            <div style={styles.modalInfoRow}>
                                <span style={styles.modalInfoLabel}>Cidade:</span>
                                <span style={styles.modalInfoValue}>{motoristaSelecionado.cidade}</span>
                            </div>
                            <div style={styles.modalInfoRow}>
                                <span style={styles.modalInfoLabel}>Data/Hora:</span>
                                <span style={styles.modalInfoValue}>{motoristaSelecionado.localizacao?.dataHora || 'Não disponível'}</span>
                            </div>
                            <div style={styles.modalInfoRow}>
                                <span style={styles.modalInfoLabel}>Coordenadas:</span>
                                <span style={styles.modalInfoValue}>
                                    {motoristaSelecionado.localizacao?.latitude?.toFixed(6)}°, 
                                    {motoristaSelecionado.localizacao?.longitude?.toFixed(6)}°
                                </span>
                            </div>
                            <div style={styles.modalInfoRow}>
                                <span style={styles.modalInfoLabel}>Status:</span>
                                <span style={styles.modalInfoValue}>{motoristaSelecionado.status}</span>
                            </div>
                            <div style={styles.modalInfoRow}>
                                <span style={styles.modalInfoLabel}>Placa:</span>
                                <span style={styles.modalInfoValue}>{motoristaSelecionado.placa}</span>
                            </div>
                            <div style={styles.modalInfoRow}>
                                <span style={styles.modalInfoLabel}>Cliente Coleta:</span>
                                <span style={styles.modalInfoValue}>{motoristaSelecionado.clienteColeta}</span>
                            </div>
                            <div style={styles.modalInfoRow}>
                                <span style={styles.modalInfoLabel}>Cliente Entrega:</span>
                                <span style={styles.modalInfoValue}>{motoristaSelecionado.clienteEntrega}</span>
                            </div>
                        </div>
                        
                        <div style={styles.modalMapContainer}>
                            {motoristaSelecionado.localizacao?.latitude && motoristaSelecionado.localizacao?.longitude ? (
                                <MapContainer
                                    center={[motoristaSelecionado.localizacao.latitude, motoristaSelecionado.localizacao.longitude]}
                                    zoom={15}
                                    style={{ height: '320px', width: '100%', borderRadius: '16px' }}
                                >
                                    <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
                                    <Marker 
                                        position={[motoristaSelecionado.localizacao.latitude, motoristaSelecionado.localizacao.longitude]} 
                                        icon={caminhaoIcon}
                                    >
                                        <Popup>
                                            <strong>{motoristaSelecionado.motoristaNome}</strong><br />
                                            {motoristaSelecionado.cidade}
                                        </Popup>
                                    </Marker>
                                </MapContainer>
                            ) : (
                                <div style={styles.modalNoMap}>
                                    <AlertCircle size={48} color="#ef4444" />
                                    <p>Coordenadas não disponíveis para este motorista</p>
                                </div>
                            )}
                        </div>
                        
                        <div style={styles.modalFooter}>
                            <button style={styles.modalButton} onClick={fecharModal}>
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .fade-in {
                    animation: fadeInUp 0.4s ease-out forwards;
                }
                tr:hover {
                    background: #1a1a1a !important;
                }
                ::-webkit-scrollbar { width: 6px; height: 6px; }
                ::-webkit-scrollbar-track { background: #111; }
                ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
                ::-webkit-scrollbar-thumb:hover { background: #FFD700; }
            `}</style>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: { minHeight: '100vh', background: '#050505', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
    bgGradient: { position: 'fixed', top: 0, left: 0, right: 0, height: '460px', background: 'radial-gradient(ellipse at 25% 25%, rgba(255,215,0,0.13), transparent 65%)', pointerEvents: 'none' },
    content: { maxWidth: '1680px', margin: '0 auto', padding: '32px 24px', position: 'relative', zIndex: 1 },

    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px', flexWrap: 'wrap', gap: '24px' },
    headerBadge: { display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,215,0,0.12)', padding: '6px 16px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', color: '#FFD700', border: '1px solid rgba(255,215,0,0.25)', letterSpacing: '0.6px' },
    title: { fontSize: '32px', fontWeight: '800', margin: '8px 0 6px 0', letterSpacing: '-0.5px', color: '#fff' },
    highlight: { background: 'linear-gradient(90deg, #FFD700, #FFAA00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    subtitle: { fontSize: '14.5px', color: '#71717a', margin: 0 },

    statsContainer: { display: 'flex', gap: '16px', flexWrap: 'wrap' },
    statCard: { background: '#0f0f0f', border: '1px solid #1f1f1f', borderRadius: '18px', padding: '16px 22px', display: 'flex', alignItems: 'center', gap: '16px', minWidth: '170px', transition: 'all 0.2s' },
    statValue: { fontSize: '26px', fontWeight: '700', color: '#fff' },
    statLabel: { fontSize: '11.5px', color: '#71717a', fontWeight: '500' },

    filterBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' },
    filterGroup: { display: 'flex', gap: '12px', alignItems: 'center' },
    filterBtn: { background: '#0f0f0f', border: '1px solid #27272a', borderRadius: '14px', padding: '11px 20px', color: '#e5e7eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '500', transition: 'all 0.2s' },
    filterBtnActive: { borderColor: '#FFD700', color: '#FFD700', background: 'rgba(255,215,0,0.07)' },
    clearBtn: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '14px', padding: '11px 18px', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' },
    
    searchBox: { display: 'flex', alignItems: 'center', background: '#0f0f0f', border: '1px solid #27272a', borderRadius: '14px', padding: '0 18px', height: '48px', minWidth: '340px' },
    searchInput: { background: 'none', border: 'none', paddingLeft: '12px', fontSize: '14.5px', color: '#fff', outline: 'none', width: '100%' },

    filtersPanel: { background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: '18px', marginBottom: '28px', padding: '18px 22px' },
    filtersRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' },
    filterSelect: { background: '#111', border: '1px solid #27272a', borderRadius: '12px', padding: '10px 16px', fontSize: '13px', color: '#e5e7eb', outline: 'none', minWidth: '180px' },
    filterInput: { background: '#111', border: '1px solid #27272a', borderRadius: '12px', padding: '10px 16px', fontSize: '13px', color: '#e5e7eb', outline: 'none', minWidth: '170px' },
    gpsFilter: { display: 'flex', gap: '20px', marginLeft: 'auto' },
    gpsLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#a1a1aa', cursor: 'pointer' },

    mapCard: { background: '#0f0f0f', borderRadius: '22px', border: '1px solid #1f1f1f', overflow: 'hidden', marginBottom: '32px', boxShadow: '0 10px 30px -15px rgba(0,0,0,0.7)' },
    mapHeader: { padding: '16px 24px', borderBottom: '1px solid #1f1f1f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    mapTitle: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14.5px', fontWeight: '600', color: '#fff' },
    mapStatus: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#71717a' },
    mapDot: { width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 0 3px rgba(16,185,129,0.25)' },
    mapContainer: { height: '420px', width: '100%' },

    tableCard: { background: '#0f0f0f', borderRadius: '22px', border: '1px solid #1f1f1f', overflow: 'hidden', boxShadow: '0 10px 30px -15px rgba(0,0,0,0.7)' },
    tableHeader: { padding: '16px 24px', borderBottom: '1px solid #1f1f1f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    tableTitle: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14.5px', fontWeight: '600', color: '#fff' },
    tableInfo: { fontSize: '12.5px', color: '#71717a' },
    tableContainer: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '1400px', fontSize: '13px' },
    th: { padding: '16px 14px', textAlign: 'left', fontSize: '10.5px', fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.6px', borderBottom: '1px solid #1f1f1f', background: '#0a0a0a' },
    tr: { borderBottom: '1px solid #1a1a1a', transition: 'background 0.2s' },
    td: { padding: '16px 14px', verticalAlign: 'middle', color: '#d1d5db' },
    tdAction: { padding: '16px 14px', textAlign: 'center', width: '52px' },

    driverInfo: { display: 'flex', alignItems: 'center', gap: '12px' },
    avatar: { width: '38px', height: '38px', background: 'linear-gradient(135deg, #FFD700, #FFAA00)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: '700', color: '#000' },
    driverName: { fontSize: '14.5px', fontWeight: '600', color: '#fff' },
    driverDetail: { fontSize: '11.5px', color: '#71717a', fontFamily: 'monospace' },

    statusChip: { display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '6px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: '500' },
    progressBar: { width: '100%', height: '3px', background: '#27272a', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' },
    progressFill: { height: '100%', background: 'linear-gradient(to right, #FFD700, #FFAA00)', transition: 'width 0.4s ease' },

    locationCell: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' },
    dateCell: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#a1a1aa' },
    emptyValue: { color: '#52525b', fontSize: '13px' },

    checkinSuccess: { display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: '#10b981' },
    checkinPending: { display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: '#71717a' },

    plateChip: { fontSize: '12.5px', fontWeight: '600', color: '#FFD700', background: 'rgba(255,215,0,0.12)', padding: '4px 12px', borderRadius: '10px', fontFamily: 'monospace', letterSpacing: '0.6px' },

    locationCompact: { display: 'flex', flexDirection: 'column', gap: '4px' },
    cityName: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#10b981' },
    coords: { fontSize: '10.5px', color: '#52525b', fontFamily: 'monospace' },
    timeAgo: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: '#52525b' },

    offlineText: { display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: '#ef4444' },
    offlineIcon: { color: '#52525b' },
    mapBtn: { background: '#18181b', border: '1px solid #3f3f46', padding: '8px', borderRadius: '10px', cursor: 'pointer', color: '#FFD700', transition: 'all 0.2s' },

    emptyState: { textAlign: 'center', padding: '60px 20px', color: '#71717a' },
    resetBtn: { marginTop: '16px', background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: '12px', padding: '10px 24px', color: '#FFD700', cursor: 'pointer', fontSize: '13.5px' },

    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)' },
    modalContent: { background: '#111', borderRadius: '24px', width: '92%', maxWidth: '680px', border: '1px solid #FFD70033', overflow: 'hidden', boxShadow: '0 25px 60px -15px rgba(0,0,0,0.9)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 28px', borderBottom: '1px solid #1f1f1f', background: '#0a0a0a' },
    modalTitle: { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '19px', fontWeight: '600', color: '#fff' },
    modalClose: { background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: '6px', borderRadius: '8px', transition: 'all 0.2s' },
    modalInfo: { padding: '24px 28px', background: '#0a0a0a', borderBottom: '1px solid #1f1f1f' },
    modalInfoRow: { display: 'flex', marginBottom: '14px', fontSize: '14px' },
    modalInfoLabel: { width: '130px', color: '#71717a', fontWeight: '500' },
    modalInfoValue: { color: '#e5e7eb', flex: 1 },
    modalMapContainer: { padding: '24px 28px', background: '#0a0a0a' },
    modalNoMap: { height: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: '#71717a', textAlign: 'center' },
    modalFooter: { padding: '18px 28px', borderTop: '1px solid #1f1f1f', display: 'flex', justifyContent: 'flex-end' },
    modalButton: { background: '#FFD700', color: '#000', border: 'none', padding: '12px 32px', borderRadius: '14px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' },
};

export default ProgramacaoMapa;