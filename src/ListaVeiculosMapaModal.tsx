import React, { useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

interface MapaModalProps {
  isOpen: boolean;
  onClose: () => void;
  veiculo: {
    placa: string;
    coordenadas?: { lat: number; lng: number };
    ultimaLocalizacao?: string;
    ultimaMacro?: string;
    ultimaAtualizacaoRastreador?: any;
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

const MapaModal: React.FC<MapaModalProps> = ({ isOpen, onClose, veiculo }) => {
  const [mapKey, setMapKey] = useState(0);

  // Forçar recriação do mapa quando o modal abrir com um veículo diferente
  useEffect(() => {
    if (isOpen && veiculo) {
      setMapKey(prev => prev + 1);
    }
  }, [isOpen, veiculo]);

  if (!isOpen || !veiculo) return null;

  const hasCoordenadas = veiculo.coordenadas && 
    veiculo.coordenadas.lat !== null && 
    veiculo.coordenadas.lng !== null &&
    !isNaN(veiculo.coordenadas.lat) && 
    !isNaN(veiculo.coordenadas.lng);

  // CORREÇÃO: usar 'veiculo' ao invés de 'veiculoSelecionado'
  const getMapCenter = () => {
    if (veiculo?.coordenadas?.lat && veiculo?.coordenadas?.lng) {
      return { lat: veiculo.coordenadas.lat, lng: veiculo.coordenadas.lng };
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
              📍 Localização - {veiculo.placa}
            </h2>
            {veiculo.ultimaMacro && (
              <span style={{ 
                fontSize: '12px', 
                color: '#FFD700', 
                marginTop: '4px', 
                display: 'inline-block', 
                background: '#FFD70020', 
                padding: '2px 8px', 
                borderRadius: '12px' 
              }}>
                🔍 {veiculo.ultimaMacro}
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
          {/* Informações do Veículo */}
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
                {veiculo.ultimaLocalizacao || 'Localização não disponível'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#888' }}>🕐 Última atualização</div>
              <div style={{ color: '#FFF', fontSize: '14px' }}>
                {formatDate(veiculo.ultimaAtualizacaoRastreador)}
              </div>
            </div>
          </div>

          {/* Mapa - com key para forçar recriação */}
          {hasCoordenadas ? (
            <LoadScript 
              key={`script-${mapKey}`}
              googleMapsApiKey="AIzaSyDqYNm42SD-colKf7VAHqlTmLlIwHc6fWw" 
              libraries={libraries}
              onLoad={() => console.log('Script carregado')}
              onError={(error) => console.error('Erro ao carregar script do Google Maps:', error)}
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
                  title={`${veiculo.placa} - ${veiculo.ultimaMacro || ''}`}
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
                Coordenadas não disponíveis para este veículo
              </div>
              <div style={{ color: '#666', fontSize: '12px', textAlign: 'center' }}>
                Aguardando atualização do rastreador
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

export default React.memo(MapaModal);