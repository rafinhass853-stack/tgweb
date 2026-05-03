// ListaVeiculosMapaModal.tsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// CORREÇÃO DOS ÍCONES DO MARKER NO LEAFLET
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const { BaseLayer } = LayersControl;

interface MapaModalProps {
  isOpen: boolean;
  onClose: () => void;
  veiculo: {
    placa: string;
    coordenadas?: { lat: number; lng: number };
    ultimaLocalizacao?: string;
    ultimaMacro?: string;
    ultimaAtualizacaoRastreador?: any;
    velocidade?: number;
    ignicao?: string;
  } | null;
}

// Componente para centralizar o mapa no veículo
const MapController = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 16);
  }, [center, map]);
  return null;
};

// Criar ícone customizado baseado no status da ignição
const createCustomIcon = (ignicao: string | undefined) => {
  const isOnline = ignicao === 'LIGADO';
  
  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: 40px;
        height: 40px;
      ">
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          width: 40px;
          height: 40px;
          background: ${isOnline ? '#22C55E' : '#EF4444'};
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        ">
          🚛
        </div>
        <div style="
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          background: ${isOnline ? '#22C55E' : '#EF4444'};
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: bold;
          white-space: nowrap;
        ">
          ${isOnline ? '● ONLINE' : '○ OFFLINE'}
        </div>
      </div>
    `,
    className: 'custom-marker',
    iconSize: [40, 50],
    iconAnchor: [20, 40],
    popupAnchor: [0, -30]
  });
};

const MapaModal: React.FC<MapaModalProps> = ({ isOpen, onClose, veiculo }) => {
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    if (isOpen && veiculo) {
      setMapKey(prev => prev + 1);
    }
  }, [isOpen, veiculo]);

  if (!isOpen || !veiculo) return null;

  // Verifica se tem coordenadas válidas
  const hasCoordenadas = !!(veiculo.coordenadas?.lat && veiculo.coordenadas?.lng);

  const getMapCenter = (): [number, number] => {
    if (veiculo.coordenadas?.lat && veiculo.coordenadas?.lng) {
      return [veiculo.coordenadas.lat, veiculo.coordenadas.lng];
    }
    return [-23.5505, -46.6333]; // Centro de São Paulo como fallback
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

  const getIgnicaoIcon = () => {
    if (veiculo.ignicao === 'LIGADO') return '🔑🟢';
    if (veiculo.ignicao === 'DESLIGADO') return '🔑🔴';
    return '🔑⚪';
  };

  const getVelocidadeColor = () => {
    const vel = veiculo.velocidade ?? 0;
    if (vel === 0) return '#666';
    if (vel < 60) return '#22C55E';
    if (vel <= 80) return '#FFD700';
    return '#EF4444';
  };

  const getVelocidadeIcon = () => {
    const vel = veiculo.velocidade ?? 0;
    if (vel === 0) return '🛑';
    if (vel < 30) return '🐢';
    if (vel < 60) return '🚚';
    if (vel < 80) return '💨';
    return '⚡';
  };

  const customIcon = createCustomIcon(veiculo.ignicao);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.95)',
        backdropFilter: 'blur(4px)',
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
          border: '1px solid #FFD70020',
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
            alignItems: 'center'
          }}
        >
          <div>
            <h2 style={{ color: '#FFD700', margin: 0, fontSize: '22px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              📍 Localização - {veiculo.placa}
              <span style={{ 
                fontSize: '14px', 
                background: '#FFD70020', 
                padding: '4px 12px', 
                borderRadius: '20px',
                color: '#FFD700'
              }}>
                {getIgnicaoIcon()} {veiculo.ignicao || 'DESCONHECIDO'}
              </span>
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(239,68,68,0.2)',
              border: 'none',
              color: '#EF4444',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '8px 14px',
              borderRadius: '12px',
              transition: 'all 0.2s'
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
            ✕
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Informações do Veículo em Grid */}
          <div
            style={{
              background: '#1A1A1A',
              padding: '20px',
              borderRadius: '16px',
              marginBottom: '20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              border: '1px solid #333'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>
                📍 LOCALIZAÇÃO
              </div>
              <div style={{ color: '#22C55E', fontSize: '13px', fontWeight: 500 }}>
                {veiculo.ultimaLocalizacao || 'Localização não disponível'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>
                🏎️ VELOCIDADE
              </div>
              <div style={{ color: getVelocidadeColor(), fontSize: '18px', fontWeight: 'bold' }}>
                {getVelocidadeIcon()} {(veiculo.velocidade ?? 0) > 0 ? `${veiculo.velocidade} km/h` : 'Parado'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>
                🏷️ ÚLTIMA MACRO
              </div>
              <div style={{ color: '#FFD700', fontSize: '13px', fontWeight: 500 }}>
                {veiculo.ultimaMacro || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>
                🕐 ÚLTIMA ATUALIZAÇÃO
              </div>
              <div style={{ color: '#AAA', fontSize: '12px' }}>
                {formatDate(veiculo.ultimaAtualizacaoRastreador)}
              </div>
            </div>
            {veiculo.coordenadas?.lat && veiculo.coordenadas?.lng && (
              <div>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>
                  🗺️ COORDENADAS
                </div>
                <div style={{ color: '#AAA', fontSize: '12px', fontFamily: 'monospace' }}>
                  {veiculo.coordenadas.lat.toFixed(6)}, {veiculo.coordenadas.lng.toFixed(6)}
                </div>
              </div>
            )}
          </div>

          {/* Mapa com Leaflet */}
          {hasCoordenadas ? (
            <div style={{ 
              height: '500px', 
              borderRadius: '16px', 
              overflow: 'hidden',
              border: '1px solid #333'
            }}>
              <MapContainer
                key={mapKey}
                center={center}
                zoom={16}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
              >
                <MapController center={center} />
                
                <LayersControl position="topright">
                  
                  {/* HÍBRIDO: Satélite com Rótulos (Stadia Maps) */}
                  <BaseLayer checked name="🛰️ Satélite Híbrido">
                    <TileLayer
                      attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                      url="https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg"
                      maxZoom={18}
                    />
                  </BaseLayer>

                  {/* SATÉLITE PURO */}
                  <BaseLayer name="📷 Satélite">
                    <TileLayer
                      url='https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
                      maxZoom={20}
                      subdomains={['mt1', 'mt2', 'mt3']}
                      attribution='Imagens &copy; Google'
                    />
                  </BaseLayer>

                  {/* MAPA DE RUAS (OpenStreetMap) */}
                  <BaseLayer name="🗺️ Mapa de Ruas">
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      maxZoom={19}
                    />
                  </BaseLayer>

                  {/* MAPA ESCURO */}
                  <BaseLayer name="🌙 Modo Escuro">
                    <TileLayer
                      attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>'
                      url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
                      maxZoom={20}
                    />
                  </BaseLayer>

                  {/* TOPOGRÁFICO */}
                  <BaseLayer name="⛰️ Topográfico">
                    <TileLayer
                      attribution='&copy; <a href="https://www.opentopomap.org">OpenTopoMap</a> contributors'
                      url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                      maxZoom={17}
                    />
                  </BaseLayer>

                </LayersControl>

                {/* Marker do Veículo */}
                <Marker 
                  position={center}
                  icon={customIcon}
                >
                  <Popup>
                    <div style={{ textAlign: 'center', minWidth: '200px' }}>
                      <strong style={{ fontSize: '14px', color: '#FFD700' }}>🚛 {veiculo.placa}</strong>
                      <hr style={{ margin: '8px 0', borderColor: '#333' }} />
                      <div><strong>📍 Local:</strong> {veiculo.ultimaLocalizacao || '—'}</div>
                      <div><strong>🏷️ Macro:</strong> {veiculo.ultimaMacro || '—'}</div>
                      <div><strong>🏎️ Velocidade:</strong> {(veiculo.velocidade ?? 0) > 0 ? `${veiculo.velocidade} km/h` : 'Parado'}</div>
                      <div><strong>🔑 Ignição:</strong> {veiculo.ignicao || 'DESCONHECIDO'}</div>
                      <div><strong>🕐 Atualização:</strong> {formatDate(veiculo.ultimaAtualizacaoRastreador)}</div>
                      <hr style={{ margin: '8px 0', borderColor: '#333' }} />
                      <a 
                        href={`https://www.google.com/maps?q=${center[0]},${center[1]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#3B82F6', textDecoration: 'none' }}
                      >
                        🌍 Abrir no Google Maps
                      </a>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          ) : (
            <div
              style={{
                height: '500px',
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
                Coordenadas não disponíveis para este veículo
              </div>
              <div style={{ color: '#666', fontSize: '12px', textAlign: 'center' }}>
                Aguardando atualização do rastreador SIGHRA
              </div>
              <div style={{ color: '#444', fontSize: '11px', textAlign: 'center' }}>
                Última atualização: {formatDate(veiculo.ultimaAtualizacaoRastreador)}
              </div>
            </div>
          )}

          {/* Botões */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
            {hasCoordenadas && (
              <a
                href={`https://www.google.com/maps?q=${veiculo.coordenadas?.lat},${veiculo.coordenadas?.lng}`}
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
                onMouseEnter={(e) => { e.currentTarget.style.background = '#2563EB'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#3B82F6'; }}
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
                fontWeight: 'bold',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#333'; }}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(MapaModal);