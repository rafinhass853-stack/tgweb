import React from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

interface MotoristaMapaModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista: {
    id: string;
    nome: string;
    placa?: string;
    veiculoId?: string;
    coordenadas?: { lat: number; lng: number };
    ultimaLocalizacao?: string;
    ultimoEndereco?: string;
    ultimaAtualizacao?: any;
    status?: string;
    ultimaMacro?: string;
    velocidade?: number;
    ignicao?: string;
  } | null;
}

const containerStyle = {
  width: '100%',
  height: '550px',
  borderRadius: '12px'
};

const libraries: ("places")[] = ["places"];

const mapTypes = [
  { id: 'roadmap', name: '🗺️ Mapa', icon: '🗺️' },
  { id: 'satellite', name: '📷 Satélite', icon: '📷' },
  { id: 'hybrid', name: '🛰️ Híbrido', icon: '🛰️' }
];

// Função para criar URL de ícone de caminhão baseado no status
const getTruckIconUrl = (status: string | undefined, velocidade: number = 0) => {
  const isOnline = status === 'online';
  const cor = isOnline ? 'green' : 'red';
  
  // Usando SVG inline como URL codificada
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48">
      <!-- Círculo de fundo -->
      <circle cx="32" cy="32" r="28" fill="${isOnline ? '#22C55E' : '#EF4444'}" stroke="white" stroke-width="3"/>
      
      <!-- Caminhão -->
      <g transform="translate(16, 16)">
        <!-- Cabine -->
        <rect x="16" y="8" width="16" height="16" rx="2" fill="white" opacity="0.9"/>
        <!-- Carroceria -->
        <rect x="0" y="12" width="20" height="12" rx="2" fill="white" opacity="0.9"/>
        <!-- Roda traseira -->
        <circle cx="6" cy="26" r="4" fill="#333" stroke="white" stroke-width="1.5"/>
        <circle cx="6" cy="26" r="2" fill="#666"/>
        <!-- Roda dianteira -->
        <circle cx="22" cy="26" r="4" fill="#333" stroke="white" stroke-width="1.5"/>
        <circle cx="22" cy="26" r="2" fill="#666"/>
        <!-- Janela -->
        <rect x="20" y="10" width="8" height="6" rx="1" fill="#4facfe"/>
        <!-- Detalhe do caminhão -->
        <rect x="2" y="14" width="16" height="2" rx="1" fill="${cor}"/>
      </g>
      
      <!-- Velocidade se > 0 -->
      ${velocidade > 0 ? `
        <text x="32" y="58" text-anchor="middle" font-size="10" font-weight="bold" fill="white" stroke="#333" stroke-width="0.5">
          ${velocidade} km/h
        </text>
      ` : ''}
    </svg>
  `;
  
  // Converter SVG para URL
  const encodedSvg = encodeURIComponent(svg);
  return `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
};

// Componente que cria o ícone do caminhão
const TruckMarker: React.FC<{
  position: { lat: number; lng: number };
  title: string;
  status?: string;
  velocidade?: number;
}> = ({ position, title, status, velocidade }) => {
  const [iconUrl, setIconUrl] = React.useState<string>('');
  
  React.useEffect(() => {
    // Criar ícone quando o componente montar
    const url = getTruckIconUrl(status, velocidade);
    setIconUrl(url);
  }, [status, velocidade]);
  
  if (!iconUrl) return null;
  
  return (
    <Marker
      position={position}
      title={title}
      icon={{
        url: iconUrl,
        scaledSize: new google.maps.Size(48, 48),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(24, 48)
      }}
    />
  );
};

const MotoristaMapaModal: React.FC<MotoristaMapaModalProps> = ({ isOpen, onClose, motorista }) => {
  const [mapKey, setMapKey] = React.useState(0);
  const [currentMapType, setCurrentMapType] = React.useState<string>('roadmap');
  const [mapInstance, setMapInstance] = React.useState<google.maps.Map | null>(null);
  const [scriptLoaded, setScriptLoaded] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && motorista) {
      setMapKey(prev => prev + 1);
      setScriptLoaded(false);
    }
  }, [isOpen, motorista]);

  if (!isOpen || !motorista) return null;

  const hasCoordenadas = motorista.coordenadas && 
    motorista.coordenadas.lat !== null && 
    motorista.coordenadas.lng !== null &&
    !isNaN(motorista.coordenadas.lat) && 
    !isNaN(motorista.coordenadas.lng);

  const getMapCenter = () => {
    if (motorista?.coordenadas?.lat && motorista?.coordenadas?.lng) {
      return { lat: motorista.coordenadas.lat, lng: motorista.coordenadas.lng };
    }
    return { lat: -23.5505, lng: -46.6333 };
  };

  const center = getMapCenter();

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '--/--/---- --:--';
    if (timestamp?.toDate) {
      return timestamp.toDate().toLocaleString('pt-BR');
    }
    if (timestamp?.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleString('pt-BR');
    }
    if (typeof timestamp === 'string') {
      return new Date(timestamp).toLocaleString('pt-BR');
    }
    return '--/--/---- --:--';
  };

  const getMacroInfo = (macro: string) => {
    const macroLower = macro?.toLowerCase() || '';
    if (macroLower.includes('pernoite')) return { icon: '🛌', color: '#FF9500', bg: '#FF950020', label: 'Pernoite' };
    if (macroLower.includes('chegada cliente')) return { icon: '🏁', color: '#22C55E', bg: '#22C55E20', label: 'Chegada ao Cliente' };
    if (macroLower.includes('fim de jornada')) return { icon: '🏠', color: '#EF4444', bg: '#EF444420', label: 'Fim de Jornada' };
    if (macroLower.includes('inicio de viagem')) return { icon: '🚀', color: '#3B82F6', bg: '#3B82F620', label: 'Início de Viagem' };
    if (macroLower.includes('carregamento')) return { icon: '📦', color: '#8B5CF6', bg: '#8B5CF620', label: 'Carregamento' };
    if (macroLower.includes('refeição')) return { icon: '🍽️', color: '#F59E0B', bg: '#F59E0B20', label: 'Refeição' };
    if (macroLower.includes('manutenção')) return { icon: '🔧', color: '#EF4444', bg: '#EF444420', label: 'Manutenção' };
    return { icon: '📍', color: '#888', bg: '#888820', label: macro || 'Status não informado' };
  };

  const getVelocidadeColor = () => {
    const vel = motorista.velocidade ?? 0;
    if (vel === 0) return '#666';
    if (vel < 60) return '#22C55E';
    if (vel <= 80) return '#FFD700';
    return '#EF4444';
  };

  const getVelocidadeIcon = () => {
    const vel = motorista.velocidade ?? 0;
    if (vel === 0) return '🛑';
    if (vel < 30) return '🐢';
    if (vel < 60) return '🚚';
    if (vel < 80) return '💨';
    return '⚡';
  };

  const getIgnicaoInfo = () => {
    if (motorista.ignicao === 'LIGADO') return { icon: '🟢', color: '#22C55E', text: 'LIGADO' };
    if (motorista.ignicao === 'DESLIGADO') return { icon: '🔴', color: '#EF4444', text: 'DESLIGADO' };
    return { icon: '⚪', color: '#888', text: 'DESCONHECIDO' };
  };

  const macroInfo = motorista.ultimaMacro ? getMacroInfo(motorista.ultimaMacro) : null;
  const ignicaoInfo = getIgnicaoInfo();

  const changeMapType = (mapTypeId: string) => {
    setCurrentMapType(mapTypeId);
    if (mapInstance) {
      mapInstance.setMapTypeId(mapTypeId as google.maps.MapTypeId);
    }
  };

  const onMapLoad = (map: google.maps.Map) => {
    setMapInstance(map);
    setScriptLoaded(true);
  };

  const onScriptLoad = () => {
    console.log('Script carregado');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.95)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0A0A0A',
          borderRadius: '24px',
          maxWidth: '1200px',
          width: '90%',
          border: '1px solid #FFD70030',
          overflow: 'hidden',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            background: 'linear-gradient(135deg, #1A1A1A, #0A0A0A)',
            borderBottom: '1px solid #FFD70030',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            <h2 style={{ color: '#FFD700', margin: 0, fontSize: '22px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              📍 Localização - {motorista.nome}
              {motorista.ignicao && (
                <span style={{ 
                  fontSize: '13px', 
                  background: `${ignicaoInfo.color}20`, 
                  padding: '4px 12px', 
                  borderRadius: '20px',
                  color: ignicaoInfo.color
                }}>
                  {ignicaoInfo.icon} {ignicaoInfo.text}
                </span>
              )}
            </h2>
            {motorista.placa && (
              <div style={{ 
                fontSize: '13px', 
                color: '#AAA', 
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                <span>🚛 Veículo: <strong style={{ color: '#4facfe' }}>{motorista.placa}</strong></span>
                {motorista.velocidade !== undefined && (
                  <span style={{ color: getVelocidadeColor() }}>
                    {getVelocidadeIcon()} {motorista.velocidade > 0 ? `${motorista.velocidade} km/h` : 'Parado'}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(239,68,68,0.2)',
              border: 'none',
              color: '#EF4444',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '12px',
              transition: 'all 0.2s',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#EF4444';
              e.currentTarget.style.color = '#FFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
              e.currentTarget.style.color = '#EF4444';
            }}
          >
            ✕ Fechar
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Informações do Motorista em Grid */}
          <div
            style={{
              background: '#1A1A1A',
              padding: '20px',
              borderRadius: '16px',
              marginBottom: '20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              border: '1px solid #333'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>
                📍 LOCALIZAÇÃO
              </div>
              <div style={{ color: '#22C55E', fontSize: '13px', fontWeight: 500 }}>
                {motorista.ultimaLocalizacao || motorista.ultimoEndereco || 'Localização não disponível'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>
                🕐 ÚLTIMA ATUALIZAÇÃO
              </div>
              <div style={{ color: '#AAA', fontSize: '12px' }}>
                {formatDate(motorista.ultimaAtualizacao)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>
                📊 STATUS
              </div>
              <div style={{ 
                color: motorista.status === 'online' ? '#22C55E' : motorista.status === 'offline' ? '#EF4444' : '#FF9500', 
                fontSize: '13px',
                fontWeight: 'bold'
              }}>
                {motorista.status === 'online' ? '● ONLINE' : motorista.status === 'offline' ? '○ OFFLINE' : '⏹️ PARADO'}
              </div>
            </div>
            {motorista.velocidade !== undefined && (
              <div>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>
                  🏎️ VELOCIDADE
                </div>
                <div style={{ color: getVelocidadeColor(), fontSize: '16px', fontWeight: 'bold' }}>
                  {getVelocidadeIcon()} {(motorista.velocidade ?? 0) > 0 ? `${motorista.velocidade} km/h` : 'Parado'}
                </div>
              </div>
            )}
            {motorista.coordenadas?.lat && motorista.coordenadas?.lng && (
              <div>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>
                  🗺️ COORDENADAS
                </div>
                <div style={{ color: '#AAA', fontSize: '12px', fontFamily: 'monospace' }}>
                  {motorista.coordenadas.lat.toFixed(6)}, {motorista.coordenadas.lng.toFixed(6)}
                </div>
              </div>
            )}
          </div>

          {/* Bloco da Macro */}
          {macroInfo && (
            <div
              style={{
                background: macroInfo.bg,
                padding: '14px 18px',
                borderRadius: '12px',
                marginBottom: '20px',
                borderLeft: `4px solid ${macroInfo.color}`,
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '28px' }}>{macroInfo.icon}</span>
              <div>
                <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🏷️ ÚLTIMA MACRO
                </div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: macroInfo.color }}>
                  {macroInfo.label}
                </div>
                {motorista.ultimaMacro && motorista.ultimaMacro !== macroInfo.label && (
                  <div style={{ fontSize: '11px', color: '#AAA', marginTop: '4px' }}>
                    {motorista.ultimaMacro}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botões de Controle do Mapa */}
          {hasCoordenadas && (
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              marginBottom: '12px', 
              flexWrap: 'wrap',
              justifyContent: 'flex-start'
            }}>
              {mapTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => changeMapType(type.id)}
                  style={{
                    padding: '8px 16px',
                    background: currentMapType === type.id ? '#4facfe' : '#1A1A1A',
                    color: currentMapType === type.id ? '#000' : '#FFF',
                    border: currentMapType === type.id ? 'none' : '1px solid #333',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {type.icon} {type.name}
                </button>
              ))}
            </div>
          )}

          {/* Mapa */}
          {hasCoordenadas ? (
            <LoadScript 
              googleMapsApiKey="AIzaSyDqYNm42SD-colKf7VAHqlTmLlIwHc6fWw" 
              libraries={libraries}
              onLoad={onScriptLoad}
            >
              <GoogleMap
                key={mapKey}
                mapContainerStyle={containerStyle}
                center={center}
                zoom={16}
                options={{
                  zoomControl: true,
                  streetViewControl: true,
                  mapTypeControl: false,
                  fullscreenControl: true,
                  mapTypeId: currentMapType as google.maps.MapTypeId
                }}
                onLoad={onMapLoad}
              >
                {scriptLoaded && (
                  <TruckMarker
                    position={center}
                    title={`${motorista.nome} - ${motorista.placa || ''}`}
                    status={motorista.status}
                    velocidade={motorista.velocidade}
                  />
                )}
              </GoogleMap>
            </LoadScript>
          ) : (
            <div
              style={{
                height: '550px',
                background: '#1A1A1A',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '16px',
                border: '1px solid #333'
              }}
            >
              <div style={{ fontSize: '64px', opacity: 0.5 }}>🗺️</div>
              <div style={{ color: '#888', textAlign: 'center', fontSize: '16px' }}>
                Coordenadas não disponíveis para este motorista
              </div>
              <div style={{ color: '#666', fontSize: '12px', textAlign: 'center' }}>
                O veículo associado pode não ter rastreador ou estar offline
              </div>
              <div style={{ color: '#444', fontSize: '11px', textAlign: 'center' }}>
                Última atualização: {formatDate(motorista.ultimaAtualizacao)}
              </div>
            </div>
          )}

          {/* Botões */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
            {hasCoordenadas && (
              <a
                href={`https://www.google.com/maps?q=${motorista.coordenadas?.lat},${motorista.coordenadas?.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '12px 24px',
                  background: '#3B82F6',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
              >
                🌍 Abrir no Google Maps
              </a>
            )}
            <button
              onClick={onClose}
              style={{
                padding: '12px 24px',
                background: '#333',
                color: '#FFF',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(MotoristaMapaModal);