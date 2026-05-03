import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { 
    collection, onSnapshot, addDoc, query, serverTimestamp, deleteDoc, doc, getDocs, writeBatch 
} from "firebase/firestore";
import { 
    Plus, Trash2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
    BarChart3, LayoutGrid, CalendarDays, AlertCircle, X, CheckCircle,
    Clock, Users, TrendingUp, Info
} from 'lucide-react';

interface EscalaFolgaProps {
    motoristaId: string;
    onVoltar: () => void;
}

const TIPOS_ESCALA = {
    'Presente': { sigla: 'P', cor: '#3b82f6', bg: '#1e3a5f', desc: 'Presente', icon: '✅' },
    'Descanso Semanal': { sigla: 'DS', cor: '#10b981', bg: '#1a3a2a', desc: 'Descanso Semanal', icon: '😴' },
    'Férias': { sigla: 'FE', cor: '#f59e0b', bg: '#3a2a1a', desc: 'Férias', icon: '🏖️' },
    'Falta': { sigla: 'F', cor: '#ef4444', bg: '#3a1a1a', desc: 'Falta', icon: '❌' },
    'Atestado': { sigla: 'A', cor: '#8b5cf6', bg: '#2a1a3a', desc: 'Atestado Médico', icon: '📋' },
};

const EscalaFolga: React.FC<EscalaFolgaProps> = ({ motoristaId, onVoltar }) => {
    const [eventos, setEventos] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'mensal' | 'anual'>('mensal');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [hoveredDay, setHoveredDay] = useState<string | null>(null);
    
    // Estados para o modal de inserção por clique
    const [showInsertModal, setShowInsertModal] = useState<{ date: string; existingEvent?: any } | null>(null);
    const [selectedTipo, setSelectedTipo] = useState('Presente');

    const subColecaoRef = collection(db, "motoristas", motoristaId, "escalas_motoristas");

    // Função para preencher automaticamente os dias a partir de 1º de abril
    const autoPreencherDiasTrabalhados = async () => {
        const dataInicio = new Date(2026, 3, 1); // 1º de abril de 2026 (mês 3 = abril)
        const dataAtual = new Date();
        const hoje = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), dataAtual.getDate());
        
        // Coletar todas as datas já existentes no Firebase
        const snapshot = await getDocs(subColecaoRef);
        const datasExistentes = new Set(snapshot.docs.map(doc => doc.data().dataInicio));
        
        // Preparar batch para operação em lote
        const batch = writeBatch(db);
        let novosRegistros = 0;
        
        // Loop através de cada dia desde 1º de abril até hoje
        let currentDate = new Date(dataInicio);
        while (currentDate <= hoje) {
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
            
            // Se o dia não tem registro, adicionar como "Presente"
            if (!datasExistentes.has(dateStr)) {
                const docRef = doc(subColecaoRef);
                batch.set(docRef, {
                    tipo: 'Presente',
                    dataInicio: dateStr,
                    criadoEm: serverTimestamp()
                });
                novosRegistros++;
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Executar o batch se houver novos registros
        if (novosRegistros > 0) {
            await batch.commit();
            showNotification(`✅ ${novosRegistros} dias preenchidos automaticamente como "Presente"!`, "success");
        }
    };

    useEffect(() => {
        // Verificar se já foi feito o preenchimento automático
        const checkAndAutoFill = async () => {
            const autoFillFlag = localStorage.getItem(`auto_filled_${motoristaId}`);
            
            if (!autoFillFlag) {
                await autoPreencherDiasTrabalhados();
                localStorage.setItem(`auto_filled_${motoristaId}`, 'true');
            }
        };
        
        checkAndAutoFill();
        
        const unsub = onSnapshot(subColecaoRef, (snap) => {
            const list: any[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            setEventos(list.sort((a, b) => a.dataInicio.localeCompare(b.dataInicio)));
        });
        return () => unsub();
    }, [motoristaId]);

    const { stats, diasDesdeUltimaFolga, porcentagemPresenca } = useMemo(() => {
        const counts: any = { P: 0, DS: 0, FE: 0, F: 0, A: 0 };
        let totalDias = 0;
        
        eventos.forEach(ev => {
            const evDate = new Date(ev.dataInicio);
            if (evDate.getFullYear() === currentDate.getFullYear()) {
                const sigla = TIPOS_ESCALA[ev.tipo as keyof typeof TIPOS_ESCALA]?.sigla;
                if (sigla) {
                    counts[sigla]++;
                    totalDias++;
                }
            }
        });

        let contagemTrabalho = 0;
        const eventosOrdenados = [...eventos].reverse();
        for (const ev of eventosOrdenados) {
            if (ev.tipo === 'Descanso Semanal' || ev.tipo === 'Férias') break;
            if (ev.tipo === 'Presente') contagemTrabalho++;
        }

        const presenca = totalDias > 0 ? ((counts.P / totalDias) * 100).toFixed(1) : '0';

        return { 
            stats: counts, 
            diasDesdeUltimaFolga: contagemTrabalho,
            porcentagemPresenca: presenca
        };
    }, [eventos, currentDate]);

    const handleDayClick = (dateStr: string) => {
        const eventoExistente = eventos.find(ev => ev.dataInicio === dateStr);
        
        if (eventoExistente) {
            setShowDeleteConfirm(eventoExistente.id);
        } else {
            setSelectedTipo('Presente');
            setShowInsertModal({ date: dateStr });
        }
    };

    const handleInsert = async () => {
        if (!showInsertModal) return;
        
        setLoading(true);
        try {
            await addDoc(subColecaoRef, { 
                tipo: selectedTipo, 
                dataInicio: showInsertModal.date, 
                criadoEm: serverTimestamp() 
            });
            showNotification(`${TIPOS_ESCALA[selectedTipo as keyof typeof TIPOS_ESCALA]?.icon} ${selectedTipo} adicionado com sucesso!`, "success");
            setShowInsertModal(null);
        } catch (error) { 
            console.error(error);
            showNotification("Erro ao adicionar registro", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        setLoading(true);
        try {
            await deleteDoc(doc(db, "motoristas", motoristaId, "escalas_motoristas", id));
            setShowDeleteConfirm(null);
            showNotification("Registro removido com sucesso!", "success");
        } catch (error) {
            console.error(error);
            showNotification("Erro ao remover registro", "error");
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (message: string, type: 'success' | 'error') => {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 24px;
            background: ${type === 'success' ? '#10b981' : '#ef4444'};
            color: white;
            border-radius: 12px;
            font-weight: 600;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    };

    // Função para forçar o recálculo do auto-preenchimento (útil para administradores)
    const resetAutoFill = () => {
        localStorage.removeItem(`auto_filled_${motoristaId}`);
        autoPreencherDiasTrabalhados();
        showNotification("Recálculo do auto-preenchimento iniciado!", "success");
    };

    const renderMensal = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const totalDays = new Date(year, month + 1, 0).getDate();
        const startDay = new Date(year, month, 1).getDay();
        const days = [];

        for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} style={dayEmptyStyle}></div>);

        for (let d = 1; d <= totalDays; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const eventoNoDia = eventos.find(ev => ev.dataInicio === dateStr);
            const config = eventoNoDia ? TIPOS_ESCALA[eventoNoDia.tipo as keyof typeof TIPOS_ESCALA] : null;

            days.push(
                <div
                    key={d}
                    style={{
                        ...dayStyle,
                        backgroundColor: config ? config.bg : hoveredDay === dateStr ? '#1a1a2a' : '#0a0a0a',
                        border: config ? `2px solid ${config.cor}` : `1px solid ${hoveredDay === dateStr ? '#FFD700' : '#222'}`,
                        transform: hoveredDay === dateStr ? 'scale(1.02)' : 'scale(1)',
                    }}
                    onMouseEnter={() => setHoveredDay(dateStr)}
                    onMouseLeave={() => setHoveredDay(null)}
                    onClick={() => handleDayClick(dateStr)}
                >
                    <div style={dayHeaderStyle}>
                        <span style={dayNumberStyle}>{d}</span>
                        {eventoNoDia && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDeleteConfirm(eventoNoDia.id);
                                }}
                                style={deleteDayButtonStyle}
                                title="Remover registro"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                    {config && (
                        <div style={{ ...dayInfoStyle, backgroundColor: config.cor }}>
                            <span style={dayIconStyle}>{config.icon}</span>
                            <span style={daySiglaStyle}>{config.sigla}</span>
                        </div>
                    )}
                    {!config && hoveredDay === dateStr && (
                        <div style={addHintStyle}>
                            <Plus size={16} color="#FFD700" />
                        </div>
                    )}
                </div>
            );
        }
        return (
            <div style={calendarGrid}>
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
                    <div key={d} style={weekHeaderStyle}>{d}</div>
                ))}
                {days}
            </div>
        );
    };

    const renderAnual = () => {
        const months = Array.from({ length: 12 }, (_, i) => i);
        return (
            <div style={annualGridStyle}>
                {months.map(m => {
                    const monthName = new Date(currentDate.getFullYear(), m).toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
                    const totalDays = new Date(currentDate.getFullYear(), m + 1, 0).getDate();
                    const monthEvents = eventos.filter(ev => {
                        const d = new Date(ev.dataInicio);
                        return d.getMonth() === m && d.getFullYear() === currentDate.getFullYear();
                    });

                    const statsMonth = {
                        P: monthEvents.filter(ev => ev.tipo === 'Presente').length,
                        DS: monthEvents.filter(ev => ev.tipo === 'Descanso Semanal').length,
                        FE: monthEvents.filter(ev => ev.tipo === 'Férias').length,
                    };

                    return (
                        <div key={m} style={miniMonthCard}>
                            <div style={miniMonthHeader}>
                                <span style={miniMonthTitle}>{monthName}</span>
                                <div style={miniMonthStats}>
                                    <span style={{ color: '#3b82f6' }}>P: {statsMonth.P}</span>
                                    <span style={{ color: '#10b981' }}>DS: {statsMonth.DS}</span>
                                    <span style={{ color: '#f59e0b' }}>F: {statsMonth.FE}</span>
                                </div>
                            </div>
                            <div style={miniMonthGrid}>
                                {Array.from({ length: totalDays }, (_, d) => {
                                    const dateStr = `${currentDate.getFullYear()}-${String(m + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
                                    const ev = monthEvents.find(e => e.dataInicio === dateStr);
                                    const config = ev ? TIPOS_ESCALA[ev.tipo as keyof typeof TIPOS_ESCALA] : null;
                                    return (
                                        <div
                                            key={d}
                                            style={{
                                                ...miniMonthDay,
                                                backgroundColor: config ? config.cor : '#1a1a1a',
                                                opacity: config ? 1 : 0.3
                                            }}
                                            title={config ? config.desc : 'Sem registro'}
                                        ></div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div style={containerStyle}>
            <div style={headerTopStyle}>
                <button onClick={onVoltar} style={voltarButtonStyle}>
                    ← Voltar ao Menu
                </button>
                <button onClick={resetAutoFill} style={resetButtonStyle} title="Recalcular preenchimento automático">
                    🔄 Recalcular Dias
                </button>
            </div>
            
            <div style={headerStyle}>
                <div>
                    <h1 style={titleStyle}>🗓️ Controle de Escala</h1>
                    <p style={subtitleStyle}>Clique em qualquer dia para adicionar ou remover registro</p>
                    <p style={autoFillInfoStyle}>✅ Dias preenchidos automaticamente como "Presente" a partir de 01/04/2026</p>
                </div>
                <div style={toggleContainer}>
                    <button 
                        onClick={() => setViewMode('mensal')} 
                        style={viewMode === 'mensal' ? activeToggleStyle : inactiveToggleStyle}
                    >
                        <CalendarDays size={16} /> Mensal
                    </button>
                    <button 
                        onClick={() => setViewMode('anual')} 
                        style={viewMode === 'anual' ? activeToggleStyle : inactiveToggleStyle}
                    >
                        <LayoutGrid size={16} /> Anual
                    </button>
                </div>
            </div>

            {/* Cards de Estatísticas */}
            <div style={statsGridStyle}>
                <div style={{ ...statsCardStyle, borderLeft: `6px solid ${diasDesdeUltimaFolga >= 6 ? '#ef4444' : '#10b981'}` }}>
                    <div style={statsHeaderStyle}>
                        <Clock size={18} color={diasDesdeUltimaFolga >= 6 ? '#ef4444' : '#10b981'} />
                        <span style={statsLabelStyle}>Ciclo de Trabalho (6x1)</span>
                    </div>
                    <div style={statsValueStyle}>
                        {diasDesdeUltimaFolga} <span style={statsUnitStyle}>dias seguidos</span>
                    </div>
                    <p style={statsAlertStyle}>
                        {diasDesdeUltimaFolga >= 6 ? '⚠️ ATENÇÃO: Motorista deve folgar!' : '✅ Motorista dentro do ciclo normal.'}
                    </p>
                </div>

                <div style={statsCardStyle}>
                    <div style={statsHeaderStyle}>
                        <TrendingUp size={18} color="#3b82f6" />
                        <span style={statsLabelStyle}>Presença no Ano</span>
                    </div>
                    <div style={statsValueStyle}>
                        {porcentagemPresenca}% <span style={statsUnitStyle}>de presença</span>
                    </div>
                    <div style={progressBarStyle}>
                        <div style={{ ...progressFillStyle, width: `${porcentagemPresenca}%` }} />
                    </div>
                </div>

                <div style={statsCardStyle}>
                    <div style={statsHeaderStyle}>
                        <BarChart3 size={18} color="#8b5cf6" />
                        <span style={statsLabelStyle}>Resumo {currentDate.getFullYear()}</span>
                    </div>
                    <div style={statsSummaryStyle}>
                        {Object.entries(stats).map(([sigla, count]) => {
                            const config = Object.values(TIPOS_ESCALA).find(c => c.sigla === sigla);
                            return (
                                <div key={sigla} style={summaryItemStyle}>
                                    <div style={{ ...summaryDotStyle, backgroundColor: config?.cor }} />
                                    <span style={summaryLabelStyle}>{sigla}</span>
                                    <span style={summaryValueStyle}>{count as number}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div style={mainGridStyle}>
                {/* Sidebar com Legenda */}
                <div style={sidebarStyle}>
                    <div style={cardStyle}>
                        <h3 style={cardTitleStyle}>
                            <Info size={18} /> Legenda
                        </h3>
                        <div style={legendGridStyle}>
                            {Object.entries(TIPOS_ESCALA).map(([nome, info]) => (
                                <div key={nome} style={legendItemStyle}>
                                    <div style={{ ...legendColorStyle, backgroundColor: info.bg, borderColor: info.cor }}>
                                        <span style={{ color: info.cor }}>{info.icon}</span>
                                    </div>
                                    <div style={legendTextStyle}>
                                        <div style={legendTitleStyle}>{nome}</div>
                                        <div style={legendDescStyle}>{info.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div style={cardStyle}>
                        <h3 style={cardTitleStyle}>
                            <Info size={18} /> Como funciona
                        </h3>
                        <p style={infoTextStyle}>
                          ✅ Dias a partir de 01/04/2026 são preenchidos automaticamente como "Presente"<br />
                          ✅ O gestor só precisa editar quando necessário (Folga, Férias, etc.)<br />
                          ✅ Clique em qualquer dia para adicionar um evento<br />
                          ❌ Clique no X para remover
                        </p>
                    </div>
                </div>

                {/* Calendário */}
                <div style={calendarCardStyle}>
                    <div style={calendarHeaderStyle}>
                        <div style={calendarTitleStyle}>
                            <CalendarIcon size={24} color="#FFD700" />
                            <h3 style={calendarTitleTextStyle}>
                                {viewMode === 'mensal' 
                                    ? currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()
                                    : `VISÃO ANUAL ${currentDate.getFullYear()}`}
                            </h3>
                        </div>
                        <div style={navButtonsStyle}>
                            <button 
                                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - (viewMode === 'mensal' ? 1 : 12)))}
                                style={navButtonStyle}
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button onClick={() => setCurrentDate(new Date())} style={todayButtonStyle}>
                                HOJE
                            </button>
                            <button 
                                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + (viewMode === 'mensal' ? 1 : 12)))}
                                style={navButtonStyle}
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                    
                    {viewMode === 'mensal' ? renderMensal() : renderAnual()}
                </div>
            </div>

            {/* Modal de Inserção por Clique */}
            {showInsertModal && (
                <div style={modalOverlayStyle} onClick={() => setShowInsertModal(null)}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={modalIconStyle}>📅</div>
                        <h3 style={modalTitleStyle}>Adicionar Registro</h3>
                        <p style={modalTextStyle}>
                            Data: <strong style={{ color: '#FFD700' }}>{showInsertModal.date}</strong>
                        </p>
                        <div style={modalSelectGroup}>
                            <label style={modalLabelStyle}>Tipo de evento:</label>
                            <select 
                                style={modalSelectStyle} 
                                value={selectedTipo} 
                                onChange={e => setSelectedTipo(e.target.value)}
                            >
                                {Object.entries(TIPOS_ESCALA).map(([key, value]) => (
                                    <option key={key} value={key}>
                                        {value.icon} {key} - {value.desc}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div style={modalButtonsStyle}>
                            <button onClick={() => setShowInsertModal(null)} style={modalCancelButton}>
                                Cancelar
                            </button>
                            <button onClick={handleInsert} style={modalConfirmButton} disabled={loading}>
                                {loading ? 'Salvando...' : 'Adicionar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Exclusão */}
            {showDeleteConfirm && (
                <div style={modalOverlayStyle} onClick={() => setShowDeleteConfirm(null)}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={modalIconStyle}>⚠️</div>
                        <h3 style={modalTitleStyle}>Confirmar exclusão</h3>
                        <p style={modalTextStyle}>
                            Tem certeza que deseja remover este registro?<br />
                            Esta ação não poderá ser desfeita.
                        </p>
                        <div style={modalButtonsStyle}>
                            <button onClick={() => setShowDeleteConfirm(null)} style={modalCancelButton}>
                                Cancelar
                            </button>
                            <button onClick={() => handleDelete(showDeleteConfirm)} style={modalConfirmButton}>
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==================== ESTILOS DARK ====================
const containerStyle: React.CSSProperties = {
    padding: '30px',
    background: '#050505',
    minHeight: '100vh'
};

const headerTopStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '20px'
};

const voltarButtonStyle: React.CSSProperties = {
    background: '#0a0a0a',
    border: '1px solid #222',
    padding: '10px 20px',
    borderRadius: '12px',
    color: '#FFD700',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.3s ease'
};

const resetButtonStyle: React.CSSProperties = {
    ...voltarButtonStyle,
    background: '#1a1a2a',
    borderColor: '#FFD700'
};

const autoFillInfoStyle: React.CSSProperties = {
    color: '#10b981',
    fontSize: '12px',
    margin: '5px 0 0 0',
    fontWeight: '500'
};

const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    flexWrap: 'wrap',
    gap: '20px'
};

const titleStyle: React.CSSProperties = {
    color: '#FFD700',
    margin: 0,
    fontSize: '32px',
    fontWeight: '700'
};

const subtitleStyle: React.CSSProperties = {
    color: '#888',
    margin: '8px 0 0 0',
    fontSize: '14px'
};

const toggleContainer: React.CSSProperties = {
    display: 'flex',
    backgroundColor: '#0a0a0a',
    padding: '4px',
    borderRadius: '12px',
    gap: '4px',
    border: '1px solid #222'
};

const inactiveToggleStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    color: '#888',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.3s ease'
};

const activeToggleStyle: React.CSSProperties = {
    ...inactiveToggleStyle,
    backgroundColor: '#FFD700',
    color: '#000',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
};

const statsGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
};

const statsCardStyle: React.CSSProperties = {
    background: '#0a0a0a',
    padding: '20px',
    borderRadius: '20px',
    border: '1px solid #222',
    transition: 'transform 0.3s ease'
};

const statsHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px'
};

const statsLabelStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: '700',
    color: '#aaa'
};

const statsValueStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: '800',
    color: '#FFD700',
    marginBottom: '8px'
};

const statsUnitStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: '400',
    color: '#666'
};

const statsAlertStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#888',
    margin: 0
};

const progressBarStyle: React.CSSProperties = {
    width: '100%',
    height: '8px',
    backgroundColor: '#1a1a1a',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '12px'
};

const progressFillStyle: React.CSSProperties = {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: '4px',
    transition: 'width 0.3s ease'
};

const statsSummaryStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '8px',
    marginTop: '8px'
};

const summaryItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
};

const summaryDotStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%'
};

const summaryLabelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: '600',
    color: '#888'
};

const summaryValueStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: '700',
    color: '#FFD700'
};

const mainGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: '30px'
};

const sidebarStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
};

const cardStyle: React.CSSProperties = {
    background: '#0a0a0a',
    padding: '24px',
    borderRadius: '20px',
    border: '1px solid #222'
};

const cardTitleStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: '700',
    color: '#FFD700',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
};

const legendGridStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
};

const legendItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
};

const legendColorStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid',
    fontSize: '20px'
};

const legendTextStyle: React.CSSProperties = {
    flex: 1
};

const legendTitleStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: '600',
    color: '#fff'
};

const legendDescStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#888'
};

const infoTextStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#aaa',
    lineHeight: '1.6',
    margin: 0
};

const calendarCardStyle: React.CSSProperties = {
    background: '#0a0a0a',
    padding: '24px',
    borderRadius: '20px',
    border: '1px solid #222'
};

const calendarHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px'
};

const calendarTitleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
};

const calendarTitleTextStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: '700',
    color: '#FFD700',
    margin: 0
};

const navButtonsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px'
};

const navButtonStyle: React.CSSProperties = {
    border: '1px solid #222',
    background: '#0a0a0a',
    borderRadius: '10px',
    cursor: 'pointer',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFD700',
    transition: 'all 0.3s ease'
};

const todayButtonStyle: React.CSSProperties = {
    ...navButtonStyle,
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: '700'
};

const calendarGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '8px'
};

const weekHeaderStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '12px',
    fontSize: '12px',
    fontWeight: '700',
    color: '#888'
};

const dayStyle: React.CSSProperties = {
    minHeight: '100px',
    padding: '8px',
    borderRadius: '12px',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    position: 'relative'
};

const dayEmptyStyle: React.CSSProperties = {
    minHeight: '100px',
    padding: '8px',
    borderRadius: '12px'
};

const dayHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
};

const dayNumberStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: '600',
    color: '#aaa'
};

const deleteDayButtonStyle: React.CSSProperties = {
    background: 'rgba(239, 68, 68, 0.2)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ef4444',
    transition: 'all 0.3s ease'
};

const dayInfoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '8px',
    marginTop: '4px'
};

const dayIconStyle: React.CSSProperties = {
    fontSize: '14px'
};

const daySiglaStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: '700',
    color: 'white'
};

const addHintStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const annualGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px'
};

const miniMonthCard: React.CSSProperties = {
    padding: '16px',
    backgroundColor: '#0a0a0a',
    borderRadius: '16px',
    border: '1px solid #222'
};

const miniMonthHeader: React.CSSProperties = {
    marginBottom: '12px'
};

const miniMonthTitle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: '700',
    color: '#FFD700',
    display: 'block',
    marginBottom: '8px'
};

const miniMonthStats: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#888'
};

const miniMonthGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '3px'
};

const miniMonthDay: React.CSSProperties = {
    width: '100%',
    height: '8px',
    borderRadius: '2px',
    transition: 'all 0.3s ease'
};

const modalOverlayStyle: React.CSSProperties = {
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
};

const modalStyle: React.CSSProperties = {
    background: '#0a0a0a',
    borderRadius: '24px',
    padding: '32px',
    maxWidth: '400px',
    width: '90%',
    textAlign: 'center',
    border: '1px solid #222'
};

const modalIconStyle: React.CSSProperties = {
    fontSize: '48px',
    marginBottom: '16px'
};

const modalTitleStyle: React.CSSProperties = {
    fontSize: '22px',
    fontWeight: '700',
    color: '#FFD700',
    marginBottom: '8px'
};

const modalTextStyle: React.CSSProperties = {
    color: '#aaa',
    marginBottom: '20px',
    lineHeight: '1.5'
};

const modalSelectGroup: React.CSSProperties = {
    marginBottom: '24px',
    textAlign: 'left'
};

const modalLabelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#aaa'
};

const modalSelectStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #222',
    borderRadius: '12px',
    fontSize: '14px',
    color: '#fff',
    outline: 'none'
};

const modalButtonsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px'
};

const modalCancelButton: React.CSSProperties = {
    flex: 1,
    padding: '12px',
    background: '#1a1a1a',
    color: '#aaa',
    border: '1px solid #222',
    borderRadius: '12px',
    fontWeight: '600',
    cursor: 'pointer'
};

const modalConfirmButton: React.CSSProperties = {
    flex: 1,
    padding: '12px',
    background: '#FFD700',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    fontWeight: '600',
    cursor: 'pointer'
};

export default EscalaFolga;