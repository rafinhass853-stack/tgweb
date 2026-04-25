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
  } | null;
}

const containerStyle = {
  width: '100%',
  height: '400px'
};

const mapOptions = {
  zoomControl: true,
  streetViewControl: true,
  mapTypeControl: true,
  fullscreenControl: true
};

const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ["places", "drawing", "geometry", "visualization"];

const MotoristaMapaModal: React.FC<MotoristaMapaModalProps> = ({ isOpen, onClose, motorista }) => {
  const [mapKey, setMapKey] = React.useState(0);

  React.useEffect(() => {
    if (isOpen && motorista) {
      setMapKey(prev => prev + 1);
    }
  }, [isOpen, motorista]);

  if (!isOpen || !motorista) return null;

  const hasCoordenadas = motorista.coordenadas && 
    motorista.coordenadas.lat !== null && 
    motorista.coordenadas.lng !== null &&
    !isNaN(motorista.coordenadas.lat) && 
    !isNaN(motorista.coordenadas.lng);

  // CORREÇÃO: usar 'motorista' ao invés de 'motoristaSelecionado'
  const getMapCenter = () => {
    if (motorista?.coordenadas?.lat && motorista?.coordenadas?.lng) {
      return { lat: motorista.coordenadas.lat, lng: motorista.coordenadas.lng };
    }
    return { lat: -23.5505, lng: -46.6333 }; // Centro padrão (São Paulo)
  };

  const center = getMapCenter();

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '--/--/----';
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleString('pt-BR');
    }
    return timestamp;
  };

  // Mapear macro para cor e ícone
  const getMacroInfo = (macro: string) => {
    const macroLower = macro?.toLowerCase() || '';
    if (macroLower.includes('pernoite')) {
      return { icon: '🛌', color: '#FF9500', bg: '#FF950020', label: 'Pernoite' };
    }
    if (macroLower.includes('chegada cliente')) {
      return { icon: '🏁', color: '#22C55E', bg: '#22C55E20', label: 'Chegada ao Cliente' };
    }
    if (macroLower.includes('fim de jornada')) {
      return { icon: '🏠', color: '#EF4444', bg: '#EF444420', label: 'Fim de Jornada' };
    }
    if (macroLower.includes('inicio de viagem')) {
      return { icon: '🚀', color: '#3B82F6', bg: '#3B82F620', label: 'Início de Viagem' };
    }
    if (macroLower.includes('carregamento')) {
      return { icon: '📦', color: '#8B5CF6', bg: '#8B5CF620', label: 'Carregamento' };
    }
    if (macroLower.includes('refeição')) {
      return { icon: '🍽️', color: '#F59E0B', bg: '#F59E0B20', label: 'Refeição' };
    }
    if (macroLower.includes('manutenção')) {
      return { icon: '🔧', color: '#EF4444', bg: '#EF444420', label: 'Manutenção' };
    }
    return { icon: '📍', color: '#888', bg: '#888820', label: macro || 'Status não informado' };
  };

  const macroInfo = motorista.ultimaMacro ? getMacroInfo(motorista.ultimaMacro) : null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.9)',
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
          maxWidth: '900px',
          width: '90%',
          border: '1px solid #333',
          overflow: 'hidden',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            background: '#1A1A1A',
            borderBottom: '1px solid #333',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <h2 style={{ color: '#FFD700', margin: 0, fontSize: '20px' }}>
              📍 Localização - {motorista.nome}
            </h2>
            {motorista.placa && (
              <span style={{ 
                fontSize: '12px', 
                color: '#888', 
                marginTop: '4px', 
                display: 'inline-block' 
              }}>
                🚛 Veículo: {motorista.placa}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#FFF',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '8px',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Informações do Motorista */}
          <div
            style={{
              background: '#1A1A1A',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#888' }}>📍 Localização</div>
              <div style={{ color: '#FFF', fontSize: '14px' }}>
                {motorista.ultimaLocalizacao || motorista.ultimoEndereco || 'Localização não disponível'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#888' }}>🕐 Última atualização</div>
              <div style={{ color: '#FFF', fontSize: '14px' }}>
                {formatDate(motorista.ultimaAtualizacao)}
              </div>
            </div>
            {motorista.status && (
              <div>
                <div style={{ fontSize: '12px', color: '#888' }}>📊 Status</div>
                <div style={{ 
                  color: motorista.status === 'online' ? '#22C55E' : '#EF4444', 
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}>
                  {motorista.status === 'online' ? '● ONLINE' : motorista.status === 'offline' ? '○ OFFLINE' : '⏹️ PARADO'}
                </div>
              </div>
            )}
          </div>

          {/* NOVO BLOCO: MACRO DO VEÍCULO */}
          {macroInfo && (
            <div
              style={{
                background: macroInfo.bg,
                padding: '12px 16px',
                borderRadius: '12px',
                marginBottom: '20px',
                borderLeft: `4px solid ${macroInfo.color}`,
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '24px' }}>{macroInfo.icon}</span>
              <div>
                <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase' }}>ÚLTIMA MACRO</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: macroInfo.color }}>
                  {macroInfo.label}
                </div>
                {motorista.ultimaMacro && motorista.ultimaMacro !== macroInfo.label && (
                  <div style={{ fontSize: '11px', color: '#AAA', marginTop: '2px' }}>
                    {motorista.ultimaMacro}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mapa */}
          {hasCoordenadas ? (
            <LoadScript 
              key={`script-${mapKey}`}
              googleMapsApiKey="AIzaSyDqYNm42SD-colKf7VAHqlTmLlIwHc6fWw" 
              libraries={libraries}
              onLoad={() => console.log('Script carregado')}
              onError={(error) => console.error('Erro ao carregar Google Maps:', error)}
            >
              <GoogleMap
                key={`map-${mapKey}`}
                mapContainerStyle={containerStyle}
                center={center}
                zoom={15}
                options={mapOptions}
              >
                <Marker
                  position={center}
                  title={`${motorista.nome} - ${motorista.placa || ''}`}
                />
              </GoogleMap>
            </LoadScript>
          ) : (
            <div
              style={{
                height: '400px',
                background: '#1A1A1A',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              <div style={{ fontSize: '48px' }}>🗺️</div>
              <div style={{ color: '#888', textAlign: 'center' }}>
                Coordenadas não disponíveis para este motorista
              </div>
              <div style={{ color: '#666', fontSize: '12px', textAlign: 'center' }}>
                O veículo associado pode não ter rastreador ou estar offline
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
                  padding: '10px 20px',
                  background: '#3B82F6',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                🌍 Abrir no Google Maps
              </a>
            )}
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: '#333',
                color: '#FFF',
                border: 'none',
                borderRadius: '10px',
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