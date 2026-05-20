// ListaVeiculos.tsx (VERSÃO MELHORADA - COM MELHOR GESTÃO E UX)
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  Timestamp 
} from 'firebase/firestore';
import MapaModal from './ListaVeiculosMapaModal';
import VisaoMapaLV from './VisaoMapaLV';
import { BarChart3, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// ============ TIPOS E INTERFACES ============
interface CargaProgramada {
  id: string;
  dt: string;
  coletaCidade: string;
  coletaLocal: string;
  coletaData: string;
  entregaCidade: string;
  entregaLocal: string;
  entregaData: string;
  status: string;
  motorista: string;
  peso: string;
  placa: string;
  carreta?: string;
  veiculo?: string;
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

interface NotificacaoState {
  mensagem: string;
  tipo: 'success' | 'error';
  visivel: boolean;
}

// ============ TIPOS DE ESTADO ============
type FilterStatus = 'todos' | 'comProgramacao' | 'semProgramacao';
type MotivoType = 'manutencao' | 'folga_motorista' | 'aguardando_programacao';

// ============ CONSTANTES ============
const INTERVALO_ATUALIZACAO_CARGAS = 360000; // 6 minutos
const DURACAO_NOTIFICACAO = 3600; // 1 hora em ms

const TIPOS_VEICULO = {
  toco: 'Toco (2 eixos)',
  trucado: 'Trucado (3 eixos)',
  truck: 'Truck (Cavalo)'
} as const;

const MOTIVOS_INDISPONIBILIDADE = {
  manutencao: { label: 'Em Manutenção', icon: '🔧', color: '#FF9500' },
  folga_motorista: { label: 'Aguardando Motorista', icon: '😴', color: '#8B5CF6' },
  aguardando_programacao: { label: 'Aguardando Programação', icon: '⏳', color: '#3B82F6' }
} as const;

const STATUS_CARGA = {
  programada: { label: 'PROGRAMADA', color: '#FFD700', bg: '#FFD70020', icon: '⏳' },
  aguardando_carregamento: { label: 'AGUARDANDO CARREGAMENTO', color: '#FF9500', bg: '#FF950020', icon: '📦' },
  seguindo_para_entrega: { label: 'EM ROTA', color: '#22C55E', bg: '#22C55E20', icon: '🚛' },
  chegou_entrega: { label: 'CHEGOU NA ENTREGA', color: '#3B82F6', bg: '#3B82F620', icon: '📍' }
} as const;

// ============ COMPONENTES AUXILIARES ============

/**
 * Componente de Notificação Toast
 */
const NotificacaoToast: React.FC<NotificacaoState> = ({ mensagem, tipo, visivel }) => {
  if (!visivel) return null;

  const bgColor = tipo === 'success' ? '#10b981' : '#ef4444';
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: bgColor,
      color: 'white',
      padding: '12px 24px',
      borderRadius: '12px',
      zIndex: 1000,
      fontWeight: 'bold',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      animation: 'slideIn 0.3s ease-out'
    }}>
      {mensagem}
    </div>
  );
};

/**
 * Componente de Filtros
 */
interface FiltrosProps {
  searchTerm: string;
  filterTipo: string;
  filterStatus: FilterStatus;
  onSearchChange: (term: string) => void;
  onTipoChange: (tipo: string) => void;
  onStatusChange: (status: FilterStatus) => void;
}

const Filtros: React.FC<FiltrosProps> = ({
  searchTerm,
  filterTipo,
  filterStatus,
  onSearchChange,
  onTipoChange,
  onStatusChange
}) => {
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '30px', flexWrap: 'wrap' }}>
      <input
        type="text"
        placeholder="🔍 Buscar por placa..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{
          flex: 1,
          minWidth: '200px',
          padding: '12px 16px',
          backgroundColor: '#1A1A1A',
          border: '1px solid #333',
          borderRadius: '10px',
          color: '#FFF',
          fontSize: '14px',
          transition: 'border-color 0.2s'
        }}
        onFocus={(e) => e.target.style.borderColor = '#4facfe'}
        onBlur={(e) => e.target.style.borderColor = '#333'}
      />
      
      <select 
        value={filterTipo} 
        onChange={(e) => onTipoChange(e.target.value)}
        style={{
          padding: '12px 16px',
          backgroundColor: '#1A1A1A',
          border: '1px solid #333',
          borderRadius: '10px',
          color: '#FFF',
          fontSize: '14px',
          cursor: 'pointer'
        }}
      >
        <option value="todos">📦 Todos os tipos</option>
        <option value="toco">Toco</option>
        <option value="trucado">Trucado</option>
        <option value="truck">Truck</option>
      </select>
      
      <select 
        value={filterStatus} 
        onChange={(e) => onStatusChange(e.target.value as FilterStatus)}
        style={{
          padding: '12px 16px',
          backgroundColor: '#1A1A1A',
          border: '1px solid #333',
          borderRadius: '10px',
          color: '#FFF',
          fontSize: '14px',
          cursor: 'pointer'
        }}
      >
        <option value="todos">📊 Todos os status</option>
        <option value="comProgramacao">✅ Com Programação</option>
        <option value="semProgramacao">⭕ Sem Programação</option>
      </select>
    </div>
  );
};

/**
 * Componente de Estatísticas
 */
interface EstatisticasProps {
  stats: ReturnType<typeof calcularEstatisticas>;
}

const Estatisticas: React.FC<EstatisticasProps> = ({ stats }) => {
  const items = [
    { label: 'Total', valor: stats.total, icon: '🚛', color: '#4facfe' },
    { label: 'Com Programação', valor: stats.comProgramacao, icon: '✅', color: '#22C55E' },
    { label: 'Sem Programação', valor: stats.semProgramacao, icon: '⭕', color: '#FF9500' },
    { label: 'Em Manutenção', valor: stats.emManutencao, icon: '🔧', color: '#FF9500' },
    { label: 'Aguardando Motorista', valor: stats.aguardandoMotorista, icon: '😴', color: '#8B5CF6' },
    { label: 'Aguardando Programação', valor: stats.aguardandoProgramacao, icon: '⏳', color: '#3B82F6' },
    { label: 'Realmente Disponíveis', valor: stats.realmenteDisponiveis, icon: '✅', color: '#22C55E' }
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      marginBottom: '30px'
    }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            background: '#1A1A1A',
            padding: '16px',
            borderRadius: '12px',
            borderLeft: `4px solid ${item.color}`,
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = `0 4px 12px ${item.color}20`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: item.color }}>
                {item.valor}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>{item.label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Componente Modal - Motivo de Indisponibilidade
 */
interface ModalMotivoProps {
  veiculo: Veiculo;
  motivoSelecionado: MotivoType;
  descricaoMotivo: string;
  onMotivoChange: (motivo: MotivoType) => void;
  onDescricaoChange: (descricao: string) => void;
  onSalvar: () => void;
  onFechar: () => void;
  carregando?: boolean;
}

const ModalMotivo: React.FC<ModalMotivoProps> = ({
  veiculo,
  motivoSelecionado,
  descricaoMotivo,
  onMotivoChange,
  onDescricaoChange,
  onSalvar,
  onFechar,
  carregando = false
}) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={onFechar}>
      <div style={{
        background: '#0A0A0A',
        padding: '32px',
        borderRadius: '24px',
        maxWidth: '450px',
        width: '90%',
        border: '1px solid #1A1A1A'
      }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ color: '#FFD700', marginBottom: '20px' }}>⚠️ Motivo da Indisponibilidade</h2>
        
        <p style={{ color: '#888', marginBottom: '20px' }}>
          Veículo: <strong style={{ color: '#FFF' }}>{veiculo.placa}</strong>
        </p>
        
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#AAA' }}>
          Tipo de Motivo
        </label>
        <select 
          value={motivoSelecionado} 
          onChange={(e) => onMotivoChange(e.target.value as MotivoType)}
          disabled={carregando}
          style={{
            width: '100%',
            padding: '12px',
            marginBottom: '20px',
            backgroundColor: '#1A1A1A',
            border: '1px solid #333',
            borderRadius: '10px',
            color: '#FFF',
            cursor: carregando ? 'not-allowed' : 'pointer',
            opacity: carregando ? 0.6 : 1
          }}
        >
          <option value="manutencao">🔧 Em Manutenção</option>
          <option value="folga_motorista">😴 Aguardando Motorista (Folga)</option>
          <option value="aguardando_programacao">⏳ Aguardando Programação</option>
        </select>

        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#AAA' }}>
          Descrição (opcional)
        </label>
        <textarea 
          value={descricaoMotivo} 
          onChange={(e) => onDescricaoChange(e.target.value)}
          placeholder="Ex: Troca de óleo, pneus, aguardando rota..."
          disabled={carregando}
          style={{
            width: '100%',
            padding: '12px',
            marginBottom: '20px',
            backgroundColor: '#1A1A1A',
            border: '1px solid #333',
            borderRadius: '10px',
            color: '#FFF',
            minHeight: '80px',
            resize: 'vertical',
            cursor: carregando ? 'not-allowed' : 'text',
            opacity: carregando ? 0.6 : 1
          }}
        />
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={onFechar}
            disabled={carregando}
            style={{
              flex: 1,
              padding: '12px',
              background: '#333',
              color: '#FFF',
              border: 'none',
              borderRadius: '10px',
              cursor: carregando ? 'not-allowed' : 'pointer',
              opacity: carregando ? 0.6 : 1
            }}
          >
            Cancelar
          </button>
          <button 
            onClick={onSalvar}
            disabled={carregando}
            style={{
              flex: 1,
              padding: '12px',
              background: '#FFD700',
              color: '#000',
              border: 'none',
              borderRadius: '10px',
              cursor: carregando ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: carregando ? 0.6 : 1
            }}
          >
            {carregando ? '⏳ Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Componente Modal - Editar Veículo
 */
interface ModalEditarProps {
  veiculo: Veiculo;
  onSalvar: (veiculo: Veiculo) => void;
  onFechar: () => void;
  carregando?: boolean;
}

const ModalEditar: React.FC<ModalEditarProps> = ({
  veiculo: veiculoInicial,
  onSalvar,
  onFechar,
  carregando = false
}) => {
  const [veiculo, setVeiculo] = useState(veiculoInicial);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSalvar(veiculo);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={onFechar}>
      <div style={{
        background: '#0A0A0A',
        padding: '32px',
        borderRadius: '24px',
        maxWidth: '450px',
        width: '90%',
        border: '1px solid #1A1A1A'
      }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ color: '#FFD700', marginBottom: '20px' }}>✏️ Editar Veículo</h2>
        
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#AAA' }}>
            Placa
          </label>
          <input 
            value={veiculo.placa} 
            onChange={e => setVeiculo({...veiculo, placa: e.target.value})}
            disabled={carregando}
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '16px',
              backgroundColor: '#1A1A1A',
              border: '1px solid #333',
              borderRadius: '10px',
              color: '#FFF',
              cursor: carregando ? 'not-allowed' : 'text',
              opacity: carregando ? 0.6 : 1
            }}
            required
          />
          
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#AAA' }}>
            Tipo de Veículo
          </label>
          <select 
            value={veiculo.tipo} 
            onChange={e => setVeiculo({
              ...veiculo,
              tipo: e.target.value,
              capacidade: e.target.value !== 'truck' ? undefined : veiculo.capacidade
            })}
            disabled={carregando}
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '16px',
              backgroundColor: '#1A1A1A',
              border: '1px solid #333',
              borderRadius: '10px',
              color: '#FFF',
              cursor: carregando ? 'not-allowed' : 'pointer',
              opacity: carregando ? 0.6 : 1
            }}
          >
            <option value="toco">Toco (2 eixos)</option>
            <option value="trucado">Trucado (3 eixos)</option>
            <option value="truck">Truck (Cavalo)</option>
          </select>
          
          {veiculo.tipo === 'truck' && (
            <>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#AAA' }}>
                Capacidade de Paletes
              </label>
              <input 
                value={veiculo.capacidade || ''} 
                onChange={e => setVeiculo({...veiculo, capacidade: parseInt(e.target.value) || 0})}
                disabled={carregando}
                style={{
                  width: '100%',
                  padding: '12px',
                  marginBottom: '16px',
                  backgroundColor: '#1A1A1A',
                  border: '1px solid #333',
                  borderRadius: '10px',
                  color: '#FFF',
                  cursor: carregando ? 'not-allowed' : 'text',
                  opacity: carregando ? 0.6 : 1
                }}
                type="number"
                required
              />
            </>
          )}
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button 
              type="button" 
              onClick={onFechar}
              disabled={carregando}
              style={{
                flex: 1,
                padding: '12px',
                background: '#333',
                color: '#FFF',
                border: 'none',
                borderRadius: '10px',
                cursor: carregando ? 'not-allowed' : 'pointer',
                opacity: carregando ? 0.6 : 1
              }}
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={carregando}
              style={{
                flex: 1,
                padding: '12px',
                background: '#FFD700',
                color: '#000',
                border: 'none',
                borderRadius: '10px',
                cursor: carregando ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                opacity: carregando ? 0.6 : 1
              }}
            >
              {carregando ? '⏳ Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Componente Modal - Confirmar Exclusão
 */
interface ModalConfirmacaoProps {
  veiculoId: string;
  placaVeiculo: string;
  onConfirmar: (id: string) => void;
  onCancelar: () => void;
  carregando?: boolean;
}

const ModalConfirmacao: React.FC<ModalConfirmacaoProps> = ({
  veiculoId,
  placaVeiculo,
  onConfirmar,
  onCancelar,
  carregando = false
}) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={onCancelar}>
      <div style={{
        background: '#0A0A0A',
        padding: '32px',
        borderRadius: '24px',
        maxWidth: '400px',
        width: '90%',
        textAlign: 'center',
        border: '1px solid #1A1A1A'
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: '48px', marginBottom: '10px' }}>⚠️</div>
        <h3 style={{ color: '#FFF', marginBottom: '12px' }}>Confirmar exclusão</h3>
        <p style={{ color: '#888', marginBottom: '12px' }}>
          Veículo: <strong style={{ color: '#FFF' }}>{placaVeiculo}</strong>
        </p>
        <p style={{ color: '#888', marginBottom: '20px' }}>
          Tem certeza que deseja excluir este veículo? Esta ação não poderá ser desfeita.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={onCancelar}
            disabled={carregando}
            style={{
              flex: 1,
              padding: '12px',
              background: '#333',
              color: '#FFF',
              border: 'none',
              borderRadius: '10px',
              cursor: carregando ? 'not-allowed' : 'pointer',
              opacity: carregando ? 0.6 : 1
            }}
          >
            Cancelar
          </button>
          <button 
            onClick={() => onConfirmar(veiculoId)}
            disabled={carregando}
            style={{
              flex: 1,
              padding: '12px',
              background: '#EF4444',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: carregando ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: carregando ? 0.6 : 1
            }}
          >
            {carregando ? '⏳ Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Componente Card de Veículo
 */
interface CardVeiculoProps {
  veiculo: Veiculo;
  carga: CargaProgramada | null | undefined;
  motivo: MotivoIndisponibilidade | null | undefined;
  onEditar: (veiculo: Veiculo) => void;
  onExcluir: (id: string) => void;
  onVerMapa: (veiculo: Veiculo) => void;
  onAdicionarMotivo: (veiculo: Veiculo) => void;
  onFinalizarIndisponibilidade: (veiculoId: string) => void;
}

const CardVeiculo: React.FC<CardVeiculoProps> = ({
  veiculo,
  carga,
  motivo,
  onEditar,
  onExcluir,
  onVerMapa,
  onAdicionarMotivo,
  onFinalizarIndisponibilidade
}) => {
  const temProgramacao = carga !== null && carga !== undefined;
  const motivoInfo = motivo ? MOTIVOS_INDISPONIBILIDADE[motivo.motivo] : null;
  const statusInfo = carga ? STATUS_CARGA[carga.status as keyof typeof STATUS_CARGA] : null;

  const borderColor = temProgramacao 
    ? '#22C55E' 
    : (motivo ? motivoInfo?.color : '#1A1A1A');
  
  const headerBg = temProgramacao 
    ? '#22C55E' 
    : (motivo ? motivoInfo?.color : '#4facfe');

  return (
    <div style={{
      background: '#0A0A0A',
      borderRadius: '16px',
      border: temProgramacao ? '2px solid #22C55E' : (motivo ? `2px solid ${motivoInfo?.color}` : '1px solid #1A1A1A'),
      overflow: 'hidden',
      transition: 'transform 0.2s, box-shadow 0.2s'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    }}>
      {/* Header do Card */}
      <div style={{
        background: headerBg,
        padding: '20px',
        color: 'white',
        position: 'relative'
      }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{veiculo.placa}</div>
        <div style={{ fontSize: '14px', marginTop: '5px', opacity: 0.9 }}>
          {TIPOS_VEICULO[veiculo.tipo as keyof typeof TIPOS_VEICULO]}
        </div>
        
        {/* Badge de Status */}
        {temProgramacao && statusInfo && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: statusInfo.bg,
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 'bold',
            color: statusInfo.color
          }}>
            {statusInfo.icon} {statusInfo.label}
          </div>
        )}
        
        {!temProgramacao && motivo && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: '#00000060',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 'bold',
            color: 'white'
          }}>
            {motivoInfo?.icon} {motivoInfo?.label}
          </div>
        )}
        
        {!temProgramacao && !motivo && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: '#EF444420',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 'bold',
            color: '#EF4444'
          }}>
            ⭕ DISPONÍVEL
          </div>
        )}
      </div>

      {/* Conteúdo do Card */}
      <div style={{ padding: '20px' }}>
        {/* Capacidade */}
        {veiculo.tipo === 'truck' && veiculo.capacidade && (
          <div style={{
            marginBottom: '16px',
            padding: '10px',
            background: '#1A1A1A',
            borderRadius: '10px',
            borderLeft: '4px solid #FFD700'
          }}>
            <strong style={{ color: '#FFD700' }}>📦 Capacidade:</strong>
            <span style={{ color: '#FFF', marginLeft: '8px' }}>{veiculo.capacidade} paletes</span>
          </div>
        )}

        {/* Rastreamento */}
        {(veiculo.ultimaLocalizacao || veiculo.ultimaAtualizacaoRastreador) && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: '#1A1A1A',
            borderRadius: '10px',
            borderLeft: `4px solid ${veiculo.velocidade && veiculo.velocidade > 0 ? '#22C55E' : '#FF9500'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#4facfe', fontWeight: 'bold' }}>
                📡 RASTREAMENTO
              </span>
              <span style={{
                fontSize: '10px',
                padding: '4px 10px',
                borderRadius: '12px',
                background: veiculo.statusRastreador === 'online' ? '#22C55E20' : '#EF444420',
                color: veiculo.statusRastreador === 'online' ? '#22C55E' : '#EF4444',
                fontWeight: 'bold'
              }}>
                {veiculo.statusRastreador === 'online' ? '● ONLINE' : veiculo.statusRastreador === 'parado' ? '⏹️ PARADO' : '○ OFFLINE'}
              </span>
            </div>
            
            {veiculo.ultimaMacro && (
              <div style={{
                fontSize: '12px',
                color: '#FFD700',
                marginBottom: '8px',
                padding: '4px 8px',
                background: '#FFD70020',
                borderRadius: '6px',
                display: 'inline-block'
              }}>
                🏷️ {veiculo.ultimaMacro}
              </div>
            )}
            
            <div style={{ fontSize: '13px', color: '#FFF', marginBottom: '8px' }}>
              <strong>📍 Local:</strong> {veiculo.ultimaLocalizacao || veiculo.ultimoEndereco || '---'}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888' }}>
              <div>
                ⏱️ {veiculo.ultimaAtualizacaoRastreador
                  ? new Date(veiculo.ultimaAtualizacaoRastreador.seconds * 1000).toLocaleTimeString('pt-PT')
                  : '--:--'}
              </div>
              <div style={{ color: veiculo.velocidade && veiculo.velocidade > 0 ? '#22C55E' : '#888' }}>
                🏎️ {veiculo.velocidade || 0} km/h
              </div>
            </div>
          </div>
        )}

        {/* Motivo de Indisponibilidade */}
        {!temProgramacao && motivo && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: `${motivoInfo?.color}20`,
            borderRadius: '10px',
            borderLeft: `4px solid ${motivoInfo?.color}`
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: motivoInfo?.color }}>
              {motivoInfo?.icon} {motivoInfo?.label}
            </div>
            {motivo.descricao && (
              <div style={{ fontSize: '12px', color: '#AAA', marginBottom: '8px' }}>
                📝 {motivo.descricao}
              </div>
            )}
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '12px' }}>
              Desde: {motivo.dataInicio}
            </div>
            <button
              onClick={() => onFinalizarIndisponibilidade(veiculo.id)}
              style={{
                width: '100%',
                padding: '8px',
                background: '#22C55E',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              ✅ Finalizar Indisponibilidade
            </button>
          </div>
        )}

        {/* Programação Atual */}
        {temProgramacao && carga && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: '#1A1A1A',
            borderRadius: '12px',
            borderLeft: `4px solid ${statusInfo?.color || '#3b82f6'}`
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '12px', color: '#FFD700', fontSize: '14px' }}>
              📋 CARGA ATUAL
            </div>
            
            <div style={{ fontSize: '13px', marginBottom: '8px', color: '#FFF' }}>
              <strong>🚛 DT:</strong> {carga.dt || '—'}
            </div>
            
            <div style={{ fontSize: '13px', marginBottom: '4px', color: '#FFF' }}>
              <strong>📍 Coleta:</strong> {carga.coletaCidade} - {carga.coletaLocal || ''}
            </div>
            <div style={{ fontSize: '12px', marginBottom: '10px', color: '#888', marginLeft: '15px' }}>
              📅 {carga.coletaData || '—'}
            </div>

            <div style={{ fontSize: '13px', marginBottom: '4px', color: '#FFF' }}>
              <strong>🎯 Entrega:</strong> {carga.entregaCidade} - {carga.entregaLocal || ''}
            </div>
            <div style={{ fontSize: '12px', marginBottom: '10px', color: '#888', marginLeft: '15px' }}>
              📅 {carga.entregaData || '—'}
            </div>

            <div style={{ fontSize: '13px', marginBottom: '8px', color: '#FFF' }}>
              <strong>👨‍✈️ Motorista:</strong> {carga.motorista || '—'}
            </div>
            
            <div style={{ fontSize: '13px', marginBottom: '8px', color: '#FFF' }}>
              <strong>⚖️ Peso:</strong> {carga.peso || '—'} kg
            </div>

            {carga.carreta && (
              <div style={{ fontSize: '13px', color: '#FFF' }}>
                <strong>🔗 Carreta:</strong> {carga.carreta}
              </div>
            )}
          </div>
        )}

        {/* Botão para adicionar motivo */}
        {!temProgramacao && !motivo && (
          <button
            onClick={() => onAdicionarMotivo(veiculo)}
            style={{
              width: '100%',
              marginTop: '16px',
              padding: '10px',
              background: '#FF9500',
              color: '#000',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            ⚠️ Informar Motivo de Indisponibilidade
          </button>
        )}
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', gap: '10px', padding: '16px', background: '#0A0A0A', borderTop: '1px solid #1A1A1A' }}>
        <button
          onClick={() => onEditar(veiculo)}
          style={{
            flex: 1,
            padding: '10px',
            background: '#FFD700',
            color: '#000',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          ✏️ Editar
        </button>
        
        <button
          onClick={() => onVerMapa(veiculo)}
          disabled={!veiculo.coordenadas?.lat || !veiculo.coordenadas?.lng}
          style={{
            flex: 1,
            padding: '10px',
            background: veiculo.coordenadas?.lat && veiculo.coordenadas?.lng ? '#3B82F6' : '#555',
            color: '#FFF',
            border: 'none',
            borderRadius: '10px',
            cursor: veiculo.coordenadas?.lat && veiculo.coordenadas?.lng ? 'pointer' : 'not-allowed',
            fontWeight: 'bold',
            opacity: veiculo.coordenadas?.lat && veiculo.coordenadas?.lng ? 1 : 0.5,
            transition: 'opacity 0.2s'
          }}
          title={!veiculo.coordenadas?.lat || !veiculo.coordenadas?.lng ? 'Coordenadas não disponíveis' : 'Ver no mapa'}
          onMouseEnter={(e) => {
            if (veiculo.coordenadas?.lat && veiculo.coordenadas?.lng) {
              e.currentTarget.style.opacity = '0.8';
            }
          }}
          onMouseLeave={(e) => {
            if (veiculo.coordenadas?.lat && veiculo.coordenadas?.lng) {
              e.currentTarget.style.opacity = '1';
            }
          }}
        >
          🗺️ Ver Localização
        </button>
        
        <button
          onClick={() => onExcluir(veiculo.id)}
          style={{
            flex: 1,
            padding: '10px',
            background: '#EF4444',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          🗑️ Excluir
        </button>
      </div>
    </div>
  );
};

// ============ FUNÇÕES UTILITÁRIAS ============

/**
 * Normaliza placas removendo espaços e hífens
 */
const normalizarPlaca = (placa: string): string => {
  if (!placa) return '';
  return placa.toUpperCase().replace(/[-\s]/g, '');
};

/**
 * Calcula estatísticas dos veículos
 */
const calcularEstatisticas = (
  veiculos: Veiculo[],
  cargasPorVeiculo: Record<string, CargaProgramada | null>,
  motivosPorVeiculo: Record<string, MotivoIndisponibilidade | null>
) => {
  const total = veiculos.length;
  const comProgramacao = veiculos.filter(v => cargasPorVeiculo[v.id] !== null && cargasPorVeiculo[v.id] !== undefined).length;
  const semProgramacao = total - comProgramacao;
  
  const veiculosSemProgramacao = veiculos.filter(v => !cargasPorVeiculo[v.id]);
  const emManutencao = veiculosSemProgramacao.filter(v => motivosPorVeiculo[v.id]?.motivo === 'manutencao').length;
  const aguardandoMotorista = veiculosSemProgramacao.filter(v => motivosPorVeiculo[v.id]?.motivo === 'folga_motorista').length;
  const aguardandoProgramacao = veiculosSemProgramacao.filter(v => motivosPorVeiculo[v.id]?.motivo === 'aguardando_programacao').length;
  const realmenteDisponiveis = veiculosSemProgramacao.filter(v => !motivosPorVeiculo[v.id]).length;

  return {
    total,
    comProgramacao,
    semProgramacao,
    emManutencao,
    aguardandoMotorista,
    aguardandoProgramacao,
    realmenteDisponiveis
  };
};

// ============ COMPONENTE PRINCIPAL ============

const ListaVeiculos = () => {
  const navigate = useNavigate();
  
  // ---- Estados de Dados ----
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [cargasPorVeiculo, setCargasPorVeiculo] = useState<Record<string, CargaProgramada | null>>({});
  const [motivosPorVeiculo, setMotivosPorVeiculo] = useState<Record<string, MotivoIndisponibilidade | null>>({});
  
  // ---- Estados de UI ----
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos');
  
  // ---- Estados de Modal ----
  const [showMotivoModal, setShowMotivoModal] = useState<Veiculo | null>(null);
  const [editando, setEditando] = useState<Veiculo | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [mapaModalVeiculo, setMapaModalVeiculo] = useState<Veiculo | null>(null);
  
  // ---- Estados de Formulário ----
  const [motivoSelecionado, setMotivoSelecionado] = useState<MotivoType>('manutencao');
  const [descricaoMotivo, setDescricaoMotivo] = useState('');
  
  // ---- Estados de Carregamento ----
  const [loading, setLoading] = useState(true);
  const [loadingCargas, setLoadingCargas] = useState(true);
  const [carregandoOperacao, setCarregandoOperacao] = useState(false);
  
  // ---- Estados de Notificação ----
  const [notificacao, setNotificacao] = useState<NotificacaoState>({
    mensagem: '',
    tipo: 'success',
    visivel: false
  });
  
  // ---- Estados de Visualização ----
  const [showMapView, setShowMapView] = useState(false);

  // ============ EFEITOS ============

  /**
   * Buscar veículos em tempo real
   */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'veiculos'), (snap) => {
      const veiculosList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Veiculo));
      setVeiculos(veiculosList);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  /**
   * Buscar motivos de indisponibilidade em tempo real
   */
  useEffect(() => {
    if (veiculos.length === 0) return;

    const unsubscribers: (() => void)[] = [];

    veiculos.forEach((veiculo) => {
      const motivoRef = collection(db, 'veiculos', veiculo.id, 'indisponibilidade');
      const q = query(motivoRef, where('dataFim', '==', null));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
          setMotivosPorVeiculo(prev => ({ ...prev, [veiculo.id]: null }));
        } else {
          const docSnap = snapshot.docs[0];
          const motivoData = docSnap.data();
          const motivo: MotivoIndisponibilidade = {
            id: docSnap.id,
            veiculoId: motivoData.veiculoId,
            motivo: motivoData.motivo,
            descricao: motivoData.descricao,
            dataInicio: motivoData.dataInicio,
            dataFim: motivoData.dataFim,
            atualizadoEm: motivoData.atualizadoEm
          };
          setMotivosPorVeiculo(prev => ({ ...prev, [veiculo.id]: motivo }));
        }
      });

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [veiculos]);

  /**
   * Buscar todas as cargas ativas
   */
  const buscarTodasCargasAtivas = useCallback(async () => {
    try {
      const todasCargas: CargaProgramada[] = [];
      
      const motoristasSnapshot = await getDocs(collection(db, 'motoristas'));
      
      for (const motoristaDoc of motoristasSnapshot.docs) {
        const cargasQuery = query(
          collection(db, 'motoristas', motoristaDoc.id, 'cargas'),
          where('status', 'in', ['programada', 'aguardando_carregamento', 'seguindo_para_entrega', 'chegou_entrega'])
        );
        
        const cargasSnapshot = await getDocs(cargasQuery);
        
        cargasSnapshot.forEach(cargaDoc => {
          const cargaData = cargaDoc.data() as CargaProgramada;
          todasCargas.push({ 
            ...cargaData, 
            id: cargaDoc.id 
          });
        });
      }
      
      return todasCargas;
    } catch (error) {
      console.error('Erro ao buscar cargas:', error);
      mostrarNotificacao('Erro ao carregar programações', 'error');
      return [];
    }
  }, []);

  /**
   * Buscar cargas ativas e correlacionar com veículos
   */
  useEffect(() => {
    if (veiculos.length === 0) {
      setCargasPorVeiculo({});
      setLoadingCargas(false);
      return;
    }

    let isMounted = true;

    const carregarCargas = async () => {
      if (!isMounted) return;
      
      try {
        setLoadingCargas(true);
        const todasCargas = await buscarTodasCargasAtivas();
        if (!isMounted) return;
        
        const cargasMap: Record<string, CargaProgramada | null> = {};
        
        veiculos.forEach(veiculo => {
          const placaVeiculoNorm = normalizarPlaca(veiculo.placa);
          
          const cargaEncontrada = todasCargas.find(carga => {
            const placaCargaNorm = normalizarPlaca(carga.placa);
            return placaCargaNorm === placaVeiculoNorm;
          });
          
          cargasMap[veiculo.id] = cargaEncontrada || null;
        });
        
        setCargasPorVeiculo(cargasMap);
      } catch (error) {
        console.error('Erro ao processar cargas:', error);
      } finally {
        if (isMounted) setLoadingCargas(false);
      }
    };
    
    carregarCargas();
    
    const interval = setInterval(carregarCargas, INTERVALO_ATUALIZACAO_CARGAS);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [veiculos, buscarTodasCargasAtivas]);

  // ============ HANDLERS ============

  /**
   * Mostrar notificação
   */
  const mostrarNotificacao = (mensagem: string, tipo: 'success' | 'error' = 'success') => {
    setNotificacao({ mensagem, tipo, visivel: true });
    setTimeout(() => {
      setNotificacao(prev => ({ ...prev, visivel: false }));
    }, DURACAO_NOTIFICACAO);
  };

  /**
   * Salvar motivo de indisponibilidade
   */
  const salvarMotivoIndisponibilidade = async () => {
    if (!showMotivoModal) return;

    try {
      setCarregandoOperacao(true);
      const motivoRef = collection(db, 'veiculos', showMotivoModal.id, 'indisponibilidade');
      const novoDocRef = doc(motivoRef);
      
      await setDoc(novoDocRef, {
        veiculoId: showMotivoModal.id,
        motivo: motivoSelecionado,
        descricao: descricaoMotivo || null,
        dataInicio: new Date().toISOString().split('T')[0],
        dataFim: null,
        atualizadoEm: new Date()
      });

      const mensagensMotivo = {
        manutencao: '✅ Motivo registrado: Em Manutenção',
        folga_motorista: '✅ Motivo registrado: Aguardando Motorista',
        aguardando_programacao: '✅ Motivo registrado: Aguardando Programação'
      };

      mostrarNotificacao(mensagensMotivo[motivoSelecionado], 'success');
      setShowMotivoModal(null);
      setDescricaoMotivo('');
      setMotivoSelecionado('manutencao');
    } catch (error) {
      console.error(error);
      mostrarNotificacao('❌ Erro ao registrar motivo', 'error');
    } finally {
      setCarregandoOperacao(false);
    }
  };

  /**
   * Finalizar indisponibilidade
   */
  const finalizarIndisponibilidade = async (veiculoId: string) => {
    const motivo = motivosPorVeiculo[veiculoId];
    if (!motivo || !motivo.id) return;

    try {
      setCarregandoOperacao(true);
      const motivoDocRef = doc(db, 'veiculos', veiculoId, 'indisponibilidade', motivo.id);
      await updateDoc(motivoDocRef, {
        dataFim: new Date().toISOString().split('T')[0],
        atualizadoEm: new Date()
      });
      mostrarNotificacao('✅ Veículo marcado como disponível novamente!', 'success');
    } catch (error) {
      console.error(error);
      mostrarNotificacao('❌ Erro ao finalizar indisponibilidade', 'error');
    } finally {
      setCarregandoOperacao(false);
    }
  };

  /**
   * Atualizar veículo
   */
  const handleUpdate = async (veiculoAtualizado: Veiculo) => {
    try {
      setCarregandoOperacao(true);
      const veiculoRef = doc(db, 'veiculos', veiculoAtualizado.id);
      const updateData: any = {
        placa: veiculoAtualizado.placa.toUpperCase(),
        tipo: veiculoAtualizado.tipo
      };
      
      if (veiculoAtualizado.tipo === 'truck') {
        updateData.capacidade = veiculoAtualizado.capacidade;
      } else {
        updateData.capacidade = null;
      }

      await updateDoc(veiculoRef, updateData);
      mostrarNotificacao('✅ Veículo atualizado com sucesso!', 'success');
      setEditando(null);
    } catch (error) {
      console.error(error);
      mostrarNotificacao('❌ Erro ao atualizar veículo', 'error');
    } finally {
      setCarregandoOperacao(false);
    }
  };

  /**
   * Excluir veículo
   */
  const handleDelete = async (id: string) => {
    try {
      setCarregandoOperacao(true);
      await deleteDoc(doc(db, 'veiculos', id));
      setShowDeleteConfirm(null);
      mostrarNotificacao('✅ Veículo excluído com sucesso!', 'success');
    } catch (error) {
      console.error(error);
      mostrarNotificacao('❌ Erro ao excluir veículo', 'error');
    } finally {
      setCarregandoOperacao(false);
    }
  };

  // ============ CÁLCULOS MEMOIZADOS ============

  const stats = useMemo(() => {
    return calcularEstatisticas(veiculos, cargasPorVeiculo, motivosPorVeiculo);
  }, [veiculos, cargasPorVeiculo, motivosPorVeiculo]);

  const filteredVeiculos = useMemo(() => {
    return veiculos.filter(v => {
      const cargaAtiva = cargasPorVeiculo[v.id];
      const temProgramacao = cargaAtiva !== null && cargaAtiva !== undefined;

      const matchPlaca = v.placa?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTipo = filterTipo === 'todos' || v.tipo === filterTipo;
      
      let matchProgramacao = true;
      if (filterStatus === 'comProgramacao') matchProgramacao = temProgramacao;
      if (filterStatus === 'semProgramacao') matchProgramacao = !temProgramacao;

      return matchPlaca && matchTipo && matchProgramacao;
    });
  }, [veiculos, cargasPorVeiculo, searchTerm, filterTipo, filterStatus]);

  // ============ RENDERIZAÇÃO ============

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#000',
        color: '#FFF',
        fontSize: '18px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
          <div>Carregando veículos...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showMapView ? (
        <VisaoMapaLV
          veiculos={veiculos}
          cargasPorVeiculo={cargasPorVeiculo}
          onRefresh={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 500);
          }}
          onBack={() => setShowMapView(false)}
          loading={loadingCargas}
        />
      ) : (
        <div style={{ padding: '40px 20px', backgroundColor: '#000', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#FFF', marginBottom: '10px' }}>
                🚛 Veículos Cadastrados
              </h1>
              <p style={{ color: '#666', fontSize: '14px' }}>
                Gerencie todos os veículos, programações e disponibilidades
              </p>
            </div>
            <button
              onClick={() => setShowMapView(true)}
              style={{
                padding: '12px 24px',
                background: '#4facfe',
                color: '#000',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <MapPin size={18} /> Ver Mapa
            </button>
          </div>

          {/* Estatísticas */}
          <Estatisticas stats={stats} />

          {/* Filtros */}
          <Filtros
            searchTerm={searchTerm}
            filterTipo={filterTipo}
            filterStatus={filterStatus}
            onSearchChange={setSearchTerm}
            onTipoChange={setFilterTipo}
            onStatusChange={setFilterStatus}
          />

          {/* Notificação */}
          <NotificacaoToast {...notificacao} />

          {/* Loading de Cargas */}
          {loadingCargas && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
              <div>Carregando programações...</div>
            </div>
          )}

          {/* Grid de Veículos */}
          {!loadingCargas && filteredVeiculos.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#666',
              backgroundColor: '#0A0A0A',
              borderRadius: '24px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚛</div>
              <h3 style={{ color: '#FFF', marginBottom: '10px' }}>Nenhum veículo encontrado</h3>
              <p>
                {searchTerm || filterTipo !== 'todos' || filterStatus !== 'todos'
                  ? 'Tente usar outros filtros de busca'
                  : 'Comece cadastrando seu primeiro veículo'}
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
              gap: '24px'
            }}>
              {filteredVeiculos.map(v => (
                <CardVeiculo
                  key={v.id}
                  veiculo={v}
                  carga={cargasPorVeiculo[v.id]}
                  motivo={motivosPorVeiculo[v.id]}
                  onEditar={setEditando}
                  onExcluir={setShowDeleteConfirm}
                  onVerMapa={setMapaModalVeiculo}
                  onAdicionarMotivo={setShowMotivoModal}
                  onFinalizarIndisponibilidade={finalizarIndisponibilidade}
                />
              ))}
            </div>
          )}

          {/* Modais */}
          {showMotivoModal && (
            <ModalMotivo
              veiculo={showMotivoModal}
              motivoSelecionado={motivoSelecionado}
              descricaoMotivo={descricaoMotivo}
              onMotivoChange={setMotivoSelecionado}
              onDescricaoChange={setDescricaoMotivo}
              onSalvar={salvarMotivoIndisponibilidade}
              onFechar={() => {
                setShowMotivoModal(null);
                setDescricaoMotivo('');
                setMotivoSelecionado('manutencao');
              }}
              carregando={carregandoOperacao}
            />
          )}

          {editando && (
            <ModalEditar
              veiculo={editando}
              onSalvar={handleUpdate}
              onFechar={() => setEditando(null)}
              carregando={carregandoOperacao}
            />
          )}

          {showDeleteConfirm && (
            <ModalConfirmacao
              veiculoId={showDeleteConfirm}
              placaVeiculo={veiculos.find(v => v.id === showDeleteConfirm)?.placa || ''}
              onConfirmar={handleDelete}
              onCancelar={() => setShowDeleteConfirm(null)}
              carregando={carregandoOperacao}
            />
          )}

          {mapaModalVeiculo && (
            <MapaModal
              isOpen={true}
              onClose={() => setMapaModalVeiculo(null)}
              veiculo={mapaModalVeiculo}
            />
          )}
        </div>
      )}
    </>
  );
};

export default ListaVeiculos;
