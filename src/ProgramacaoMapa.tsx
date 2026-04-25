import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import { 
  Eye, Search, MapPin, Truck, Package, AlertCircle, Clock, X, Filter, ChevronDown, 
  Calendar, CheckCircle, Circle, WifiOff, Compass, Smartphone, Activity, 
  Download, Maximize2, Phone, MessageCircle, RefreshCw, Signal
} from 'lucide-react';
import L from 'leaflet';
import { db } from "./firebase";
import { collection, onSnapshot, query, orderBy, limit, where } from "firebase/firestore";

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
        if (center[0] !== 0 && center[1] !== 0) {
            map.flyTo(center, zoom, { duration: 1.2 });
        }
    }, [center, zoom, map]);
    return null;
};

// Cache persistente de geocoding (localStorage)
const GEOCACHE_KEY = 'geocoding_cache_v2';
const loadGeocodingCache = (): Record<string, { lat: number; lng: number; timestamp: number }> => {
    try {
        const cached = localStorage.getItem(GEOCACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            // Limpar cache com mais de 30 dias
            const now = Date.now();
            const validCache: Record<string, any> = {};
            Object.entries(parsed).forEach(([key, value]: [string, any]) => {
                if (now - value.timestamp < 30 * 24 * 60 * 60 * 1000) {
                    validCache[key] = value;
                }
            });
            return validCache;
        }
    } catch (e) {}
    return {};
};

const saveGeocodingCache = (cache: Record<string, { lat: number; lng: number; timestamp: number }>) => {
    try {
        localStorage.setItem(GEOCACHE_KEY, JSON.stringify(cache));
    } catch (e) {}
};

// Geocoding otimizado com cache e batch
const geocodeAddress = async (address: string, cache: Record<string, any>): Promise<{ lat: number; lng: number } | null> => {
    if (!address || address === '—' || address === 'Localização não disponível') return null;
    
    // Verificar cache primeiro
    if (cache[address]) {
        return cache[address];
    }
    
    try {
        let searchAddress = address;
        if (address.includes('SP -')) searchAddress = address.replace('SP -', '') + ', SP, Brasil';
        else if (address.includes('RJ -')) searchAddress = address.replace('RJ -', '') + ', RJ, Brasil';
        else if (address.includes('MG -')) searchAddress = address.replace('MG -', '') + ', MG, Brasil';
        
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&limit=1&countrycodes=BR`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
            const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            return coords;
        }
        return null;
    } catch (error) {
        console.error('Erro no geocoding:', error);
        return null;
    }
};

// Batch geocoding com delay para evitar rate limit
const batchGeocode = async (
    addresses: string[], 
    onProgress?: (current: number, total: number) => void
): Promise<Map<string, { lat: number; lng: number }>> => {
    const results = new Map();
    const cache = loadGeocodingCache();
    
    // Primeiro, pegar do cache
    const uncachedAddresses: string[] = [];
    addresses.forEach(addr => {
        if (cache[addr]) {
            results.set(addr, cache[addr]);
        } else if (addr && addr !== '—') {
            uncachedAddresses.push(addr);
        }
    });
    
    // Processar endereços não cacheados com delay
    for (let i = 0; i < uncachedAddresses.length; i++) {
        const addr = uncachedAddresses[i];
        const coords = await geocodeAddress(addr, {});
        if (coords) {
            results.set(addr, coords);
            cache[addr] = { ...coords, timestamp: Date.now() };
        }
        // Delay para evitar rate limit do Nominatim
        await new Promise(resolve => setTimeout(resolve, 200));
        if (onProgress) onProgress(i + 1, uncachedAddresses.length);
    }
    
    saveGeocodingCache(cache);
    return results;
};

// MESMOS STATUS DO APP
const STATUS_ATIVOS = ['programada', 'aguardando_carregamento', 'seguindo_para_entrega', 'chegou_entrega'];

const getStatusFromCheckin = (tipo?: string) => {
    const statusMap: any = {
        'chegada_coleta':   { label: 'Chegada na Coleta',   color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', icon: '📍', step: 1, order: 1 },
        'saida_coleta':     { label: 'Saída da Coleta',     color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: '🚚', step: 2, order: 2 },
        'chegada_entrega':  { label: 'Chegada na Entrega',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', icon: '🏭', step: 3, order: 3 },
        'saida_entrega':    { label: 'Saída da Entrega',    color: '#059669', bg: 'rgba(5,150,105,0.15)', icon: '✅', step: 4, order: 4 },
        'inicio_viagem':    { label: 'Início da Viagem',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: '🚛', step: 0, order: 0 },
    };
    return statusMap[tipo?.toLowerCase() || ''];
};

const getStatusFromCarga = (status?: string) => {
    const statusMap: any = {
        'programada':               { label: 'Programada', color: '#FFD700', bg: 'rgba(255,215,0,0.15)', icon: '📋', step: 0, order: 0 },
        'aguardando_carregamento':  { label: 'Aguardando Carregamento', color: '#FF9500', bg: 'rgba(255,149,0,0.15)', icon: '⏳', step: 1, order: 1 },
        'seguindo_para_entrega':    { label: 'Seguindo para Entrega', color: '#22C55E', bg: 'rgba(34,197,94,0.15)', icon: '🚛', step: 2, order: 2 },
        'chegou_entrega':           { label: 'Chegou na Entrega', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', icon: '📍', step: 3, order: 3 },
        'finalizada':               { label: 'Finalizada', color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: '🏁', step: 5, order: 5 },
        'cancelada':                { label: 'Cancelada', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: '❌', step: -1, order: -1 },
    };
    return statusMap[status?.toLowerCase() || ''] || { label: 'Aguardando', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: '⏳', step: 0, order: 0 };
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

interface VeiculoData {
    placa: string;
    ultimaLocalizacao?: string;
    ultimaAtualizacaoRastreador?: any;
    statusRastreador?: string;
    velocidade?: number;
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

interface VeiculoComCoordenadas {
    placa: string;
    localizacao: string;
    velocidade: number;
    lat: number;
    lng: number;
    ultimaAtualizacao: string;
    motoristaNome?: string;
}

// Componente do Modal do WhatsApp
const WhatsAppModal = ({ isOpen, onClose, phoneNumber, motoristaNome }: { isOpen: boolean; onClose: () => void; phoneNumber: string; motoristaNome: string }) => {
    const [message, setMessage] = useState('');
    
    const sendWhatsApp = () => {
        const formattedPhone = phoneNumber.replace(/\D/g, '');
        const url = `https://wa.me/55${formattedPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        onClose();
    };
    
    if (!isOpen) return null;
    
    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.whatsappModalContent} onClick={(e) => e.stopPropagation()}>
                <div style={styles.modalHeader}>
                    <div style={styles.modalTitle}>
                        <MessageCircle size={20} color="#25D366" />
                        WhatsApp - {motoristaNome}
                    </div>
                    <button style={styles.modalClose} onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>
                <div style={styles.whatsappModalBody}>
                    <textarea
                        style={styles.whatsappTextarea}
                        placeholder="Digite sua mensagem para o motorista..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={5}
                    />
                    <button style={styles.whatsappSendBtn} onClick={sendWhatsApp}>
                        <MessageCircle size={18} /> Enviar via WhatsApp
                    </button>
                </div>
            </div>
        </div>
    );
};

const ProgramacaoMapa = () => {
    const [motoristas, setMotoristas] = useState<MotoristaData[]>([]);
    const [cargas, setCargas] = useState<Record<string, CargaData>>({});
    const [localizacoes, setLocalizacoes] = useState<Record<string, LocalizacaoData>>({});
    const [veiculos, setVeiculos] = useState<Record<string, VeiculoData>>({});
    const [veiculosMapa, setVeiculosMapa] = useState<VeiculoComCoordenadas[]>([]);
    const [ultimoCheckin, setUltimoCheckin] = useState<Record<string, HistoricoCheckinData>>({});
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [geocodingProgress, setGeocodingProgress] = useState(0);
    const [filtros, setFiltros] = useState<FiltrosState>({
        motorista: '', status: '', coletaCliente: '', entregaCliente: '', placa: '', cidade: '', comGPS: false, semGPS: false
    });
    const [filtrosAbertos, setFiltrosAbertos] = useState(false);
    const [mapFocus, setMapFocus] = useState({ center: [-21.78, -48.17] as [number, number], zoom: 6 });
    const [modalVisible, setModalVisible] = useState(false);
    const [motoristaSelecionado, setMotoristaSelecionado] = useState<any>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
    const [whatsappData, setWhatsappData] = useState({ phone: '', name: '' });
    const geocodingInProgress = useRef(false);

    // Buscar motoristas (otimizado)
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

    // Buscar dados dos veículos
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "veiculos"), (snap) => {
            const veiculosMap: Record<string, VeiculoData> = {};
            snap.forEach(doc => {
                const data = doc.data();
                veiculosMap[data.placa] = {
                    placa: data.placa,
                    ultimaLocalizacao: data.ultimaLocalizacao || '—',
                    ultimaAtualizacaoRastreador: data.ultimaAtualizacaoRastreador,
                    statusRastreador: data.statusRastreador || 'offline',
                    velocidade: data.velocidade || 0
                };
            });
            setVeiculos(veiculosMap);
        });
        return () => unsub();
    }, []);

    // Geocoding otimizado em lote com nomes dos motoristas
    useEffect(() => {
        const processarGeocoding = async () => {
            if (geocodingInProgress.current) return;
            
            const veiculosComLocalizacao = Object.values(veiculos).filter(v => 
                v.ultimaLocalizacao && v.ultimaLocalizacao !== '—' && v.ultimaLocalizacao !== 'Localização não disponível'
            );
            
            if (veiculosComLocalizacao.length === 0) return;
            
            geocodingInProgress.current = true;
            setIsGeocoding(true);
            
            const uniqueAddresses = [...new Set(veiculosComLocalizacao.map(v => v.ultimaLocalizacao!))];
            const geocodedMap = await batchGeocode(uniqueAddresses, (current, total) => {
                setGeocodingProgress(Math.round((current / total) * 100));
            });
            
            const resultados: VeiculoComCoordenadas[] = [];
            for (const veiculo of veiculosComLocalizacao) {
                const coords = geocodedMap.get(veiculo.ultimaLocalizacao!);
                if (coords) {
                    // Buscar motorista associado ao veículo
                    const cargaComVeiculo = Object.values(cargas).find(c => c.placa === veiculo.placa);
                    const motoristaInfo = motoristas.find(m => m.id === cargaComVeiculo?.motoristaId);
                    
                    resultados.push({
                        placa: veiculo.placa,
                        localizacao: veiculo.ultimaLocalizacao!,
                        velocidade: veiculo.velocidade || 0,
                        lat: coords.lat,
                        lng: coords.lng,
                        ultimaAtualizacao: veiculo.ultimaAtualizacaoRastreador?.toDate?.().toLocaleString('pt-BR') || new Date().toLocaleString('pt-BR'),
                        motoristaNome: motoristaInfo?.nome || 'Motorista não identificado'
                    });
                }
            }
            
            setVeiculosMapa(resultados);
            setIsGeocoding(false);
            geocodingInProgress.current = false;
        };
        
        processarGeocoding();
    }, [veiculos, cargas, motoristas]);

    // Buscar cargas ATIVAS (otimizado com useCallback)
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

    // Buscar localizações dos motoristas
    useEffect(() => {
        if (motoristas.length === 0) return;
        const unsubs: (() => void)[] = [];
        
        motoristas.forEach(motorista => {
            const localizacaoAtualRef = collection(db, `motoristas/${motorista.id}/localizacoes`);
            const unsub = onSnapshot(localizacaoAtualRef, (snap) => {
                snap.forEach(doc => {
                    if (doc.id === 'atual' || doc.id.startsWith('pos_')) {
                        const data = doc.data() as LocalizacaoData;
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
            });
            unsubs.push(unsub);
        });
        
        return () => unsubs.forEach(u => u());
    }, [motoristas]);

    // Buscar último check-in
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
                }
            });
            unsubs.push(unsub);
        });
        
        return () => unsubs.forEach(u => u());
    }, [motoristas]);

    // Combinar dados (memoizado)
    const dadosCombinados = useMemo(() => {
        const motoristasComCargaAtiva = motoristas.filter(motorista => {
            return Object.values(cargas).some(c => c.motoristaId === motorista.id);
        });

        return motoristasComCargaAtiva.map(motorista => {
            const cargaAtiva = Object.values(cargas).find(c => c.motoristaId === motorista.id);
            const checkin = ultimoCheckin[motorista.id];
            const loc = localizacoes[motorista.id];
            
            const placaVeiculo = cargaAtiva?.placa || '—';
            const veiculoData = veiculos[placaVeiculo];
            
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

            const temCheckinColeta = checkin?.tipo === 'chegada_coleta' || checkin?.tipo === 'saida_coleta';
            const temCheckinEntrega = checkin?.tipo === 'chegada_entrega' || checkin?.tipo === 'saida_entrega';

            const clienteColetaDisplay = cargaAtiva?.coletaCidade && cargaAtiva?.coletaLocal 
                ? `${cargaAtiva.coletaCidade} - ${cargaAtiva.coletaLocal}`
                : cargaAtiva?.coletaLocal || '—';
            
            const clienteEntregaDisplay = cargaAtiva?.entregaCidade && cargaAtiva?.entregaLocal
                ? `${cargaAtiva.entregaCidade} - ${cargaAtiva.entregaLocal}`
                : cargaAtiva?.entregaLocal || '—';

            const localizacaoDisplay = veiculoData?.ultimaLocalizacao || loc?.cidadeNome || motorista.cidade || '—';
            const temGPS = !!(loc?.latitude && loc?.longitude);

            // Calcular tempo desde última atualização
            let updateTimeText = '';
            let updateColor = '#71717a';
            if (loc?.dataHora && loc.dataHora !== '—') {
                const updateDate = new Date(loc.dataHora);
                const now = new Date();
                const diffMinutes = Math.floor((now.getTime() - updateDate.getTime()) / 60000);
                if (diffMinutes < 5) {
                    updateColor = '#10b981';
                    updateTimeText = `${diffMinutes} min atrás`;
                } else if (diffMinutes < 30) {
                    updateColor = '#f59e0b';
                    updateTimeText = `${diffMinutes} min atrás`;
                } else {
                    updateColor = '#ef4444';
                    updateTimeText = `${diffMinutes} min atrás`;
                }
            }

            return {
                id: motorista.id,
                motoristaNome: motorista.nome,
                motoristaCpf: motorista.cpf,
                motoristaTelefone: motorista.telefone,
                motoristaWhatsapp: motorista.whatsapp,
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
                cidade: localizacaoDisplay,
                localizacaoRastreador: veiculoData?.ultimaLocalizacao || '—',
                velocidade: veiculoData?.velocidade || 0,
                statusRastreador: veiculoData?.statusRastreador || 'offline',
                statusRastreadorOnline: veiculoData?.statusRastreador === 'online',
                temGPS: temGPS,
                ultimaAtualizacao: loc?.dataHora || (veiculoData?.ultimaAtualizacaoRastreador?.toDate?.().toLocaleString('pt-BR') || '—'),
                ultimaAtualizacaoColor: updateColor,
                ultimaAtualizacaoTexto: updateTimeText,
                cargaId: cargaAtiva?.id,
                latitude: loc?.latitude,
                longitude: loc?.longitude,
            };
        }).sort((a, b) => a.statusStep - b.statusStep);
    }, [motoristas, cargas, localizacoes, ultimoCheckin, veiculos]);

    // Aplicar filtros (agora também filtra o mapa)
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

    // Veículos filtrados para o mapa (baseado nos filtros atuais)
    const veiculosFiltradosMapa = useMemo(() => {
        const placasFiltradas = new Set(dadosFiltrados.map(d => d.placa).filter(p => p !== '—'));
        return veiculosMapa.filter(v => placasFiltradas.has(v.placa));
    }, [veiculosMapa, dadosFiltrados]);

    const limparFiltros = () => setFiltros({ motorista: '', status: '', coletaCliente: '', entregaCliente: '', placa: '', cidade: '', comGPS: false, semGPS: false });
    const temFiltrosAtivos = () => Object.values(filtros).some(v => v !== '' && v !== false);
    const ativosComGPS = dadosFiltrados.filter(d => d.temGPS).length;
    const veiculosNoMapa = veiculosFiltradosMapa;

    const abrirModal = (motorista: any) => { setMotoristaSelecionado(motorista); setModalVisible(true); };
    const fecharModal = () => { setModalVisible(false); setMotoristaSelecionado(null); };
    
    const abrirWhatsAppModal = (phone: string, name: string) => {
        setWhatsappData({ phone, name });
        setWhatsappModalOpen(true);
    };
    
    const toggleExpandRow = (id: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };
    
    const expandAll = () => {
        if (expandedRows.size === dadosFiltrados.length) {
            setExpandedRows(new Set());
        } else {
            setExpandedRows(new Set(dadosFiltrados.map(d => d.id)));
        }
    };
    
    const exportToCSV = () => {
        const headers = ['Motorista', 'CPF', 'Status', 'Cliente Coleta', 'Cliente Entrega', 'Placa', 'Localização', 'Última Atualização', 'DT'];
        const rows = dadosFiltrados.map(item => [
            item.motoristaNome,
            item.motoristaCpf,
            item.status,
            item.clienteColeta,
            item.clienteEntrega,
            item.placa,
            item.localizacaoRastreador,
            item.ultimaAtualizacao,
            item.dt
        ]);
        
        const csvContent = [headers, ...rows].map(row => row.join(';')).join('\n');
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', `viagens_ativas_${new Date().toISOString().slice(0,19)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Função para centralizar o mapa nas coordenadas do motorista
    const centralizarMapa = (latitude: number, longitude: number) => {
        if (latitude && longitude) {
            setMapFocus({ center: [latitude, longitude], zoom: 13 });
        }
    };

    const getProgresso = (step: number) => {
        if (step < 0) return 0;
        if (step >= 4) return 100;
        return (step / 4) * 100;
    };
    
    const getStepLabel = (step: number) => {
        const steps = ['🟡 Início', '📍 Coleta', '🚚 Transporte', '🏭 Entrega', '✅ Finalizada'];
        return steps[Math.min(step, 4)] || steps[0];
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
                                <div style={styles.statValue}>{veiculosNoMapa.length}</div>
                                <div style={styles.statLabel}>Veículos no Mapa</div>
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
                        <button style={styles.clearBtn} onClick={expandAll}>
                            <Maximize2 size={14} /> {expandedRows.size === dadosFiltrados.length ? 'Recolher' : 'Expandir'} Tudo
                        </button>
                        <button style={styles.clearBtn} onClick={exportToCSV}>
                            <Download size={14} /> Exportar CSV
                        </button>
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
                        {isGeocoding && (
                            <div style={{marginTop: '12px', fontSize: '11px', color: '#FFD700'}}>
                                <RefreshCw size={12} style={{animation: 'spin 1s linear infinite', display: 'inline', marginRight: '8px'}} />
                                Carregando coordenadas: {geocodingProgress}%
                            </div>
                        )}
                    </div>
                )}

                {/* Mapa */}
                <div style={styles.mapCard}>
                    <div style={styles.mapHeader}>
                        <div style={styles.mapTitle}>
                            <Compass size={18} color="#FFD700" /> Mapa de Localização em Tempo Real
                        </div>
                        <div style={styles.mapStatus}>
                            <div style={styles.mapDot}></div> {veiculosNoMapa.length} veículos no mapa
                        </div>
                    </div>
                    <div style={styles.mapContainer}>
                        <MapContainer center={mapFocus.center} zoom={mapFocus.zoom} style={{ height: '100%', width: '100%' }}>
                            <ChangeView center={mapFocus.center} zoom={mapFocus.zoom} />
                            <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
                            <MarkerClusterGroup chunkedLoading>
                                {veiculosNoMapa.map(veiculo => (
                                    <Marker key={veiculo.placa} position={[veiculo.lat, veiculo.lng]} icon={caminhaoIcon}>
                                        <Popup>
                                            <div style={{ padding: '10px', minWidth: '220px' }}>
                                                <strong style={{ fontSize: '15px', color: '#FFD700' }}>👤 {veiculo.motoristaNome}</strong><br />
                                                <strong style={{ fontSize: '14px' }}>🚛 Placa: {veiculo.placa}</strong><br />
                                                <span style={{ fontSize: '12px', color: '#aaa' }}>📍 {veiculo.localizacao}</span><br />
                                                <span style={{ fontSize: '11px', color: '#666' }}>🕒 {veiculo.ultimaAtualizacao}</span>
                                                {veiculo.velocidade > 0 && (
                                                    <span style={{ fontSize: '11px', color: '#22C55E', display: 'block' }}>🏎️ {veiculo.velocidade} km/h</span>
                                                )}
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
                                    <th style={styles.th}>VEÍCULO</th>
                                    <th style={styles.th}>LOCALIZAÇÃO</th>
                                    <th style={styles.th}>DT</th>
                                    <th style={styles.th}>AÇÕES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dadosFiltrados.map((item, idx) => {
                                    const progresso = getProgresso(item.statusStep);
                                    const isExpanded = expandedRows.has(item.id);
                                    
                                    return (
                                        <React.Fragment key={item.id}>
                                            <tr style={{...styles.tr, animationDelay: `${idx * 0.035}s`}} className="fade-in">
                                                <td style={styles.tdAction}>
                                                    <button onClick={() => toggleExpandRow(item.id)} style={styles.expandBtn}>
                                                        <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                                    </button>
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
                                                        <div style={styles.progressBar}>
                                                            <div style={{...styles.progressFill, width: `${progresso}%`, background: `linear-gradient(90deg, ${item.statusColor}, ${item.statusColor}CC)`}}></div>
                                                        </div>
                                                        <div style={styles.stepText}>{getStepLabel(item.statusStep)}</div>
                                                    </div>
                                                </td>
                                                <td style={styles.td}>
                                                    <div style={styles.locationCell} title={item.clienteColeta}>
                                                        <MapPin size={14} color="#10b981" />
                                                        <span>{item.clienteColeta.length > 35 ? item.clienteColeta.substring(0, 32) + '...' : item.clienteColeta}</span>
                                                    </div>
                                                </td>
                                                <td style={styles.td}>
                                                    <div style={styles.locationCell} title={item.clienteEntrega}>
                                                        <MapPin size={14} color="#f59e0b" />
                                                        <span>{item.clienteEntrega.length > 35 ? item.clienteEntrega.substring(0, 32) + '...' : item.clienteEntrega}</span>
                                                    </div>
                                                </td>
                                                <td style={styles.td}>
                                                    <span style={styles.plateChip}>{item.placa}</span>
                                                    {item.carreta !== '—' && item.carreta !== '' && item.carreta !== item.placa && (
                                                        <span style={{...styles.plateChip, background: 'rgba(255,215,0,0.08)', marginTop: '4px', display: 'inline-block'}}>
                                                            {item.carreta}
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={styles.td}>
                                                    {item.localizacaoRastreador !== '—' ? (
                                                        <div style={styles.locationCompact}>
                                                            <div style={styles.cityName}>
                                                                <MapPin size={12} />
                                                                <strong>{item.localizacaoRastreador.length > 25 ? item.localizacaoRastreador.substring(0, 22) + '...' : item.localizacaoRastreador}</strong>
                                                            </div>
                                                            <div style={{...styles.timeAgo, color: item.ultimaAtualizacaoColor}}>
                                                                <Clock size={10} />
                                                                {item.ultimaAtualizacao !== '—' ? item.ultimaAtualizacao : '—'}
                                                            </div>
                                                            {item.velocidade > 0 && (
                                                                <div style={styles.speedInfo}>🏎️ {item.velocidade} km/h</div>
                                                            )}
                                                            <div style={styles.signalStatus}>
                                                                <Signal size={10} color={item.statusRastreadorOnline ? '#10b981' : '#ef4444'} />
                                                                <span style={{fontSize: '9px', color: item.statusRastreadorOnline ? '#10b981' : '#ef4444'}}>
                                                                    {item.statusRastreadorOnline ? 'Online' : 'Offline'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={styles.offlineText}>
                                                            <WifiOff size={14} />
                                                            <span>Sem localização</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={styles.td}>
                                                    <div style={styles.dtCell}>
                                                        {item.dt !== '—' ? item.dt : '—'}
                                                    </div>
                                                </td>
                                                <td style={styles.td}>
    <div style={styles.actionButtons}>
        <button 
            onClick={() => centralizarMapa(item.latitude, item.longitude)} 
            style={styles.mapBtn} 
            title="Centralizar no mapa"
            disabled={!item.latitude || !item.longitude}
        >
            <MapPin size={16} />
        </button>
        <button onClick={() => abrirModal(item)} style={styles.mapBtn} title="Ver detalhes">
            <Eye size={16} />
        </button>
        {item.motoristaWhatsapp && item.motoristaWhatsapp !== '—' && (
            <button 
                onClick={() => abrirWhatsAppModal(item.motoristaWhatsapp || '', item.motoristaNome)} 
                style={styles.whatsappBtnSmall} 
                title="WhatsApp"
            >
                <MessageCircle size={16} />
            </button>
        )}
    </div>
</td>
                                            </tr>
                                            {isExpanded && (
                                                <tr style={styles.expandedRow}>
                                                    <td colSpan={9}>
                                                        <div style={styles.expandedContent}>
                                                            <div style={styles.expandedGrid}>
                                                                <div><strong>📅 Data Coleta:</strong> {item.coletaData}</div>
                                                                <div><strong>📅 Data Entrega:</strong> {item.entregaData}</div>
                                                                <div><strong>✅ Check-in Coleta:</strong> {item.checkinColeta}</div>
                                                                <div><strong>✅ Check-in Entrega:</strong> {item.checkinEntrega}</div>
                                                                <div><strong>📍 Cidade:</strong> {item.cidade}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}

                                {dadosFiltrados.length === 0 && (
                                    <tr>
                                        <td colSpan={9} style={styles.emptyState}>
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

            {/* Modal Detalhes */}
            {modalVisible && motoristaSelecionado && (
                <div style={styles.modalOverlay} onClick={fecharModal}>
                    <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <div style={styles.modalTitle}>
                                <MapPin size={20} color="#FFD700" />
                                Detalhes - {motoristaSelecionado.motoristaNome}
                            </div>
                            <button style={styles.modalClose} onClick={fecharModal}>
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div style={styles.modalInfo}>
                            <div style={styles.modalInfoRow}>
                                <span style={styles.modalInfoLabel}>Status:</span>
                                <span style={{...styles.modalInfoValue, color: motoristaSelecionado.statusColor}}>{motoristaSelecionado.status}</span>
                            </div>
                            <div style={styles.modalInfoRow}>
                                <span style={styles.modalInfoLabel}>Localização:</span>
                                <span style={styles.modalInfoValue}>{motoristaSelecionado.localizacaoRastreador || motoristaSelecionado.cidade}</span>
                            </div>
                            <div style={styles.modalInfoRow}>
                                <span style={styles.modalInfoLabel}>Última atualização:</span>
                                <span style={{...styles.modalInfoValue, color: motoristaSelecionado.ultimaAtualizacaoColor}}>{motoristaSelecionado.ultimaAtualizacao}</span>
                            </div>
                            <div style={styles.modalInfoRow}>
                                <span style={styles.modalInfoLabel}>Velocidade:</span>
                                <span style={styles.modalInfoValue}>{motoristaSelecionado.velocidade} km/h</span>
                            </div>
                            <div style={styles.modalInfoRow}>
                                <span style={styles.modalInfoLabel}>Placa / Carreta:</span>
                                <span style={styles.modalInfoValue}>{motoristaSelecionado.placa} {motoristaSelecionado.carreta !== '—' ? `/ ${motoristaSelecionado.carreta}` : ''}</span>
                            </div>
                            <div style={styles.modalInfoRow}>
                                <span style={styles.modalInfoLabel}>DT:</span>
                                <span style={styles.modalInfoValue}>{motoristaSelecionado.dt}</span>
                            </div>
                            <div style={styles.modalInfoRow}>
                                <span style={styles.modalInfoLabel}>Coleta:</span>
                                <span style={styles.modalInfoValue}>{motoristaSelecionado.clienteColeta}</span>
                            </div>
                            <div style={styles.modalInfoRow}>
                                <span style={styles.modalInfoLabel}>Entrega:</span>
                                <span style={styles.modalInfoValue}>{motoristaSelecionado.clienteEntrega}</span>
                            </div>
                            <div style={styles.modalInfoRow}>
                                <span style={styles.modalInfoLabel}>Check-ins:</span>
                                <span style={styles.modalInfoValue}>
                                    Coleta: {motoristaSelecionado.checkinColeta} | Entrega: {motoristaSelecionado.checkinEntrega}
                                </span>
                            </div>
                        </div>
                        
                        <div style={styles.modalMapContainer}>
                            {motoristaSelecionado.latitude && motoristaSelecionado.longitude ? (
                                <MapContainer
                                    center={[motoristaSelecionado.latitude, motoristaSelecionado.longitude]}
                                    zoom={15}
                                    style={{ height: '320px', width: '100%', borderRadius: '16px' }}
                                >
                                    <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
                                    <Marker 
                                        position={[motoristaSelecionado.latitude, motoristaSelecionado.longitude]} 
                                        icon={caminhaoIcon}
                                    >
                                        <Popup>
                                            <strong>{motoristaSelecionado.motoristaNome}</strong><br />
                                            {motoristaSelecionado.localizacaoRastreador || motoristaSelecionado.cidade}<br />
                                            🕒 {motoristaSelecionado.ultimaAtualizacao}
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
                            {motoristaSelecionado.motoristaWhatsapp && motoristaSelecionado.motoristaWhatsapp !== '—' && (
                                <button onClick={() => abrirWhatsAppModal(motoristaSelecionado.motoristaWhatsapp, motoristaSelecionado.motoristaNome)} style={styles.modalWhatsappBtn}>
                                    <MessageCircle size={16} /> WhatsApp
                                </button>
                            )}
                            {motoristaSelecionado.motoristaTelefone && motoristaSelecionado.motoristaTelefone !== '—' && (
                                <a href={`tel:${motoristaSelecionado.motoristaTelefone.replace(/\D/g, '')}`} style={styles.modalCallBtn}>
                                    <Phone size={16} /> Ligar
                                </a>
                            )}
                            <button style={styles.modalButton} onClick={fecharModal}>
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal WhatsApp */}
            <WhatsAppModal 
                isOpen={whatsappModalOpen}
                onClose={() => setWhatsappModalOpen(false)}
                phoneNumber={whatsappData.phone}
                motoristaNome={whatsappData.name}
            />

            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
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
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '1500px', fontSize: '13px' },
    th: { padding: '16px 14px', textAlign: 'left', fontSize: '10.5px', fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.6px', borderBottom: '1px solid #1f1f1f', background: '#0a0a0a' },
    tr: { borderBottom: '1px solid #1a1a1a', transition: 'background 0.2s' },
    td: { padding: '16px 14px', verticalAlign: 'middle', color: '#d1d5db' },
    tdAction: { padding: '16px 14px', textAlign: 'center', width: '40px' },

    driverInfo: { display: 'flex', alignItems: 'center', gap: '12px' },
    avatar: { width: '38px', height: '38px', background: 'linear-gradient(135deg, #FFD700, #FFAA00)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: '700', color: '#000' },
    driverName: { fontSize: '14.5px', fontWeight: '600', color: '#fff' },
    driverDetail: { fontSize: '11.5px', color: '#71717a', fontFamily: 'monospace' },

    statusChip: { display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '6px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: '500' },
    progressBar: { width: '100%', height: '3px', background: '#27272a', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' },
    progressFill: { height: '100%', transition: 'width 0.4s ease' },
    stepText: { fontSize: '9px', color: '#71717a', marginTop: '4px', textAlign: 'center' },

    locationCell: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' },
    dateCell: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#a1a1aa' },
    emptyValue: { color: '#52525b', fontSize: '13px' },

    checkinSuccess: { display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: '#10b981' },
    checkinPending: { display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: '#71717a' },

    plateChip: { fontSize: '12.5px', fontWeight: '600', color: '#FFD700', background: 'rgba(255,215,0,0.12)', padding: '4px 12px', borderRadius: '10px', fontFamily: 'monospace', letterSpacing: '0.6px', display: 'inline-block' },

    locationCompact: { display: 'flex', flexDirection: 'column', gap: '4px' },
    cityName: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#10b981' },
    timeAgo: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px' },
    speedInfo: { fontSize: '10.5px', color: '#22C55E', display: 'flex', alignItems: 'center', gap: '4px' },
    signalStatus: { display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' },
    dtCell: { fontSize: '12px', color: '#a1a1aa' },
    actionButtons: { display: 'flex', gap: '8px' },
    whatsappBtnSmall: { background: '#25D366', border: 'none', padding: '6px', borderRadius: '10px', cursor: 'pointer', color: '#fff', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    whatsappBtnSmallHover: { opacity: 0.9 },

    offlineText: { display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: '#ef4444' },
    offlineIcon: { color: '#52525b' },
    mapBtn: { background: '#18181b', border: '1px solid #3f3f46', padding: '8px', borderRadius: '10px', cursor: 'pointer', color: '#FFD700', transition: 'all 0.2s' },
    expandBtn: { background: '#18181b', border: '1px solid #3f3f46', padding: '6px', borderRadius: '8px', cursor: 'pointer', color: '#71717a', transition: 'all 0.2s' },

    expandedRow: { background: '#0a0a0a' },
    expandedContent: { padding: '20px 24px', borderTop: '1px solid #1f1f1f' },
    expandedGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '16px', fontSize: '13px', color: '#a1a1aa' },
    whatsappBtn: { display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#25D366', color: '#fff', padding: '8px 16px', borderRadius: '10px', textDecoration: 'none', fontSize: '13px', fontWeight: '500' },

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
    modalFooter: { padding: '18px 28px', borderTop: '1px solid #1f1f1f', display: 'flex', justifyContent: 'flex-end', gap: '12px' },
    modalButton: { background: '#FFD700', color: '#000', border: 'none', padding: '12px 32px', borderRadius: '14px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' },
    modalWhatsappBtn: { background: '#25D366', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '14px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' },
    modalCallBtn: { background: '#3b82f6', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '14px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' },
    whatsappModalContent: { background: '#111', borderRadius: '24px', width: '92%', maxWidth: '500px', border: '1px solid #25D36633', overflow: 'hidden', boxShadow: '0 25px 60px -15px rgba(0,0,0,0.9)' },
    whatsappModalBody: { padding: '24px 28px' },
    whatsappTextarea: { width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '12px', color: '#fff', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', marginBottom: '20px', outline: 'none' },
    whatsappSendBtn: { width: '100%', background: '#25D366', border: 'none', padding: '14px', borderRadius: '12px', color: '#fff', fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.2s' },
};

export default ProgramacaoMapa;