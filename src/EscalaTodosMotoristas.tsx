import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { 
    collection, onSnapshot, query, getDocs, doc, writeBatch, serverTimestamp, where, setDoc, updateDoc, deleteDoc 
} from "firebase/firestore";
import { 
    ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
    Search, Filter, Download, Save, RefreshCw, User,
    BarChart3, Users, CalendarDays, AlertCircle, X, CheckCircle2, Trash2
} from 'lucide-react';

interface Motorista {
    id: string;
    nome: string;
}

interface EventoEscala {
    id: string;
    motoristaId: string;
    tipo: string;
    dataInicio: string;
}

const TIPOS_ESCALA = {
    'Presente': { sigla: 'P', cor: '#22c55e', bg: '#1a2e1a', desc: 'Presente', icon: '✅' },
    'Descanso Semanal': { sigla: 'FOLGA', cor: '#3b82f6', bg: '#1e3a5f', desc: 'Descanso Semanal', icon: '😴' },
    'Férias': { sigla: 'FÉRIAS', cor: '#f59e0b', bg: '#3a2a1a', desc: 'Férias', icon: '🏖️' },
    'Falta': { sigla: 'FALTA', cor: '#ef4444', bg: '#3a1a1a', desc: 'Falta', icon: '❌' },
    'Atestado': { sigla: 'ATESTADO', cor: '#ef4444', bg: '#3a1a1a', desc: 'Atestado Médico', icon: '📋' },
};

const EscalaTodosMotoristas: React.FC = () => {
    const [motoristas, setMotoristas] = useState<Motorista[]>([]);
    const [escalas, setEscalas] = useState<Record<string, Record<string, EventoEscala>>>({});
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    
    // Estado para o modal de seleção
    const [selectedCell, setSelectedCell] = useState<{ motoristaId: string, motoristaNome: string, date: Date } | null>(null);

    // Gerar dias do mês atual
    const daysInMonth = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const date = new Date(year, month, 1);
        const days = [];
        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    }, [currentDate]);

    useEffect(() => {
        const unsubMotoristas = onSnapshot(collection(db, "motoristas"), (snapshot) => {
            const docs = snapshot.docs.map(d => ({ id: d.id, nome: d.data().nome }));
            setMotoristas(docs.sort((a, b) => a.nome.localeCompare(b.nome)));
            
            docs.forEach(motorista => {
                const escalaRef = collection(db, "motoristas", motorista.id, "escalas_motoristas");
                onSnapshot(escalaRef, (escalaSnap) => {
                    const motoristaEscalas: Record<string, EventoEscala> = {};
                    escalaSnap.forEach(edoc => {
                        const data = edoc.data();
                        motoristaEscalas[data.dataInicio] = { 
                            id: edoc.id, 
                            motoristaId: motorista.id, 
                            ...data 
                        } as EventoEscala;
                    });
                    setEscalas(prev => ({
                        ...prev,
                        [motorista.id]: motoristaEscalas
                    }));
                });
            });
            setLoading(false);
        });

        return () => unsubMotoristas();
    }, []);

    // FUNÇÃO PARA LIMPAR TODOS OS DADOS DE ESCALA
    const limparTodosDados = async () => {
        setClearing(true);
        let totalDeleted = 0;
        let errors = 0;

        try {
            for (const motorista of motoristas) {
                if (!motorista.id) continue;

                try {
                    // Busca todas as escalas do motorista
                    const escalasRef = collection(db, "motoristas", motorista.id, "escalas_motoristas");
                    const escalasSnapshot = await getDocs(escalasRef);
                    
                    if (escalasSnapshot.empty) continue;

                    // Usa batch para excluir em lote
                    const batch = writeBatch(db);
                    let batchCount = 0;
                    
                    for (const escalaDoc of escalasSnapshot.docs) {
                        batch.delete(escalaDoc.ref);
                        batchCount++;
                        totalDeleted++;

                        // Executa batch a cada 500 operações
                        if (batchCount >= 500) {
                            await batch.commit();
                            batchCount = 0;
                        }
                    }
                    
                    // Commit do último batch
                    if (batchCount > 0) {
                        await batch.commit();
                    }
                    
                } catch (error) {
                    console.error(`Erro ao limpar escalas do motorista ${motorista.nome}:`, error);
                    errors++;
                }
            }

            if (errors === 0) {
                alert(`✅ ${totalDeleted} registro(s) de escala excluído(s) com sucesso!`);
            } else {
                alert(`⚠️ ${totalDeleted} registro(s) excluído(s) com ${errors} erro(s)`);
            }
            
            setShowClearConfirm(false);
            
            // Limpa o estado local
            setEscalas({});
            
        } catch (error) {
            console.error('Erro ao limpar todos os dados:', error);
            alert('❌ Erro ao limpar todos os dados');
        } finally {
            setClearing(false);
        }
    };

    // Cálculos para o Dashboard
    const stats = useMemo(() => {
        const hojeStr = new Date().toISOString().split('T')[0];
        const counts = {
            total: motoristas.length,
            presentes: 0,
            folga: 0,
            ferias: 0,
            falta: 0,
            atestado: 0,
            semRegistro: 0
        };

        motoristas.forEach(m => {
            const statusHoje = escalas[m.id]?.[hojeStr]?.tipo;
            if (statusHoje === 'Presente') counts.presentes++;
            else if (statusHoje === 'Descanso Semanal') counts.folga++;
            else if (statusHoje === 'Férias') counts.ferias++;
            else if (statusHoje === 'Falta') counts.falta++;
            else if (statusHoje === 'Atestado') counts.atestado++;
            else counts.semRegistro++;
        });

        return counts;
    }, [motoristas, escalas]);

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const getStatusForDay = (motoristaId: string, date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        return escalas[motoristaId]?.[dateStr];
    };

    const handleCellClick = (motoristaId: string, motoristaNome: string, date: Date) => {
        setSelectedCell({ motoristaId, motoristaNome, date });
    };

    const updateStatus = async (tipo: string | null) => {
        if (!selectedCell) return;
        const { motoristaId, date } = selectedCell;
        const dateStr = date.toISOString().split('T')[0];
        const currentStatus = escalas[motoristaId]?.[dateStr];
        
        try {
            if (tipo === null) {
                // Remover registro
                if (currentStatus) {
                    await deleteDoc(doc(db, "motoristas", motoristaId, "escalas_motoristas", currentStatus.id));
                }
            } else {
                // Adicionar ou atualizar
                if (currentStatus) {
                    const docRef = doc(db, "motoristas", motoristaId, "escalas_motoristas", currentStatus.id);
                    await updateDoc(docRef, { tipo, atualizadoEm: serverTimestamp() });
                } else {
                    const escalaRef = collection(db, "motoristas", motoristaId, "escalas_motoristas");
                    await setDoc(doc(escalaRef), {
                        tipo,
                        dataInicio: dateStr,
                        criadoEm: serverTimestamp()
                    });
                }
            }

            // Atualizar status do veículo se for hoje
            const hojeStr = new Date().toISOString().split('T')[0];
            if (dateStr === hojeStr) {
                await atualizarStatusVeiculo(motoristaId, tipo || 'Presente');
            }
            
            setSelectedCell(null);
        } catch (error) {
            console.error("Erro ao atualizar escala:", error);
        }
    };

    const atualizarStatusVeiculo = async (motoristaId: string, tipo: string) => {
        try {
            const cargasRef = collection(db, "motoristas", motoristaId, "cargas");
            const q = query(cargasRef, where("statusViagem", "==", "em_andamento"));
            const snap = await getDocs(q);
            
            let placa = "";
            if (!snap.empty) {
                placa = snap.docs[0].data().placa;
            }

            if (placa) {
                const indisponibilidadeRef = doc(db, "veiculos", placa, "indisponibilidade", "status_atual");

                if (['Descanso Semanal', 'Férias', 'Falta', 'Atestado'].includes(tipo)) {
                    await setDoc(indisponibilidadeRef, {
                        motivo: 'folga_motorista',
                        descricao: `Motorista em ${tipo}`,
                        dataInicio: new Date().toISOString(),
                        atualizadoEm: serverTimestamp()
                    });
                } else {
                    await deleteDoc(indisponibilidadeRef);
                }
            }
        } catch (error) {
            console.error("Erro ao atualizar status do veículo:", error);
        }
    };

    const autoPreencherMes = async () => {
        if (!window.confirm("Deseja preencher automaticamente os dias vazios até hoje como 'Presente'?")) return;
        
        setSaving(true);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        try {
            for (const motorista of motoristas) {
                const batch = writeBatch(db);
                let count = 0;
                
                for (const day of daysInMonth) {
                    if (day > hoje) break;
                    
                    const dateStr = day.toISOString().split('T')[0];
                    if (!escalas[motorista.id]?.[dateStr]) {
                        const newDocRef = doc(collection(db, "motoristas", motorista.id, "escalas_motoristas"));
                        batch.set(newDocRef, {
                            tipo: 'Presente',
                            dataInicio: dateStr,
                            criadoEm: serverTimestamp()
                        });
                        count++;
                    }
                }
                
                if (count > 0) {
                    await batch.commit();
                }
            }
            alert("Preenchimento concluído!");
        } catch (error) {
            console.error(error);
            alert("Erro ao processar preenchimento.");
        } finally {
            setSaving(false);
        }
    };

    const filteredMotoristas = motoristas.filter(m => 
        m.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getPresencaCount = (motoristaId: string, date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        const status = escalas[motoristaId]?.[dateStr];
        if (!status || status.tipo !== 'Presente') return null;
        
        let count = 1;
        let checkDate = new Date(date);
        while (true) {
            checkDate.setDate(checkDate.getDate() - 1);
            const checkStr = checkDate.toISOString().split('T')[0];
            const prevStatus = escalas[motoristaId]?.[checkStr];
            if (prevStatus && prevStatus.tipo === 'Presente') count++;
            else break;
        }
        return count;
    };

    if (loading) return <div style={loadingContainer}>Carregando escala geral...</div>;

    return (
        <div style={containerStyle}>
            {/* Dashboard de Resumo */}
            <div style={statsGrid}>
                <div style={statCard}>
                    <div style={statIconBox}><Users size={24} color="#FFD700" /></div>
                    <div>
                        <div style={statLabel}>Total Motoristas</div>
                        <div style={statValue}>{stats.total}</div>
                    </div>
                </div>
                <div style={{ ...statCard, borderLeft: '4px solid #22c55e' }}>
                    <div style={{ ...statIconBox, backgroundColor: '#1a2e1a' }}><CheckCircle2 size={24} color="#22c55e" /></div>
                    <div>
                        <div style={statLabel}>Presentes Hoje</div>
                        <div style={statValue}>{stats.presentes}</div>
                    </div>
                </div>
                <div style={{ ...statCard, borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ ...statIconBox, backgroundColor: '#1e3a5f' }}><CalendarDays size={24} color="#3b82f6" /></div>
                    <div>
                        <div style={statLabel}>Em Folga</div>
                        <div style={statValue}>{stats.folga}</div>
                    </div>
                </div>
                <div style={{ ...statCard, borderLeft: '4px solid #ef4444' }}>
                    <div style={{ ...statIconBox, backgroundColor: '#3a1a1a' }}><AlertCircle size={24} color="#ef4444" /></div>
                    <div>
                        <div style={statLabel}>Faltas/Atestados</div>
                        <div style={statValue}>{stats.falta + stats.atestado}</div>
                    </div>
                </div>
            </div>

            <div style={headerStyle}>
                <div style={titleSection}>
                    <h1 style={titleStyle}>📅 Escala Geral de Motoristas</h1>
                    <p style={subtitleStyle}>Controle unificado de presenças, folgas e afastamentos</p>
                </div>
                
                <div style={actionSection}>
                    <div style={searchWrapper}>
                        <Search size={18} style={searchIcon} />
                        <input 
                            type="text" 
                            placeholder="Buscar motorista..." 
                            style={searchInput}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div style={monthPicker}>
                        <button onClick={handlePrevMonth} style={monthBtn}><ChevronLeft size={20} /></button>
                        <span style={monthLabel}>
                            {currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
                        </span>
                        <button onClick={handleNextMonth} style={monthBtn}><ChevronRight size={20} /></button>
                    </div>

                    <button 
                        onClick={autoPreencherMes} 
                        style={autoFillBtn}
                        disabled={saving}
                    >
                        <RefreshCw size={18} className={saving ? 'animate-spin' : ''} />
                        {saving ? 'Processando...' : 'Auto-Preencher'}
                    </button>

                    <button 
                        onClick={() => setShowClearConfirm(true)} 
                        style={clearAllBtn}
                        disabled={clearing}
                    >
                        <Trash2 size={18} />
                        {clearing ? 'Limpando...' : 'Limpar Todos os Dados'}
                    </button>
                </div>
            </div>

            <div style={tableWrapper}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={stickyColHeader}>MOTORISTAS</th>
                            {daysInMonth.map(day => (
                                <th key={day.getTime()} style={dayHeaderStyle(day)}>
                                    <div style={dayNum}>{day.getDate()}</div>
                                    <div style={dayName}>
                                        {day.toLocaleString('pt-BR', { weekday: 'short' }).replace('.', '')}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredMotoristas.map(motorista => (
                            <tr key={motorista.id} style={rowStyle}>
                                <td style={stickyCol}>
                                    <div style={motoristaInfo}>
                                        <div style={avatarMini}><User size={14} /></div>
                                        <span style={motoristaNome}>{motorista.nome}</span>
                                    </div>
                                </td>
                                {daysInMonth.map(day => {
                                    const status = getStatusForDay(motorista.id, day);
                                    const presencaNum = getPresencaCount(motorista.id, day);
                                    const config = status ? TIPOS_ESCALA[status.tipo as keyof typeof TIPOS_ESCALA] : null;
                                    
                                    return (
                                        <td 
                                            key={day.getTime()} 
                                            style={cellStyle(config)}
                                            onClick={() => handleCellClick(motorista.id, motorista.nome, day)}
                                        >
                                            {status?.tipo === 'Presente' ? (
                                                <span style={presencaText}>{presencaNum}</span>
                                            ) : (
                                                <span style={statusText}>{config?.sigla || ''}</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal de Confirmação para Limpar Todos os Dados */}
            {showClearConfirm && (
                <div style={modalOverlay} onClick={() => setShowClearConfirm(false)}>
                    <div style={{ ...modalContent, maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
                        <div style={modalHeader}>
                            <div>
                                <h3 style={{ ...modalTitle, color: '#EF4444' }}>⚠️ Atenção!</h3>
                                <p style={modalSubtitle}>
                                    Esta ação irá <strong style={{ color: '#EF4444' }}>EXCLUIR PERMANENTEMENTE</strong> TODOS os registros de escala de <strong>TODOS</strong> os motoristas.
                                </p>
                            </div>
                            <button onClick={() => setShowClearConfirm(false)} style={closeBtn}><X size={20} /></button>
                        </div>
                        
                        <div style={modalBody}>
                            <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>
                                Isso inclui todos os dias marcados como Presente, Folga, Férias, Falta e Atestado. 
                                Esta ação não pode ser desfeita.
                            </p>
                            <p style={{ color: '#FFD700', fontSize: '14px', marginBottom: '24px', textAlign: 'center' }}>
                                Deseja realmente continuar?
                            </p>
                            
                            <div style={clearConfirmButtons}>
                                <button 
                                    onClick={() => setShowClearConfirm(false)} 
                                    style={cancelClearBtn}
                                    disabled={clearing}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={limparTodosDados} 
                                    style={confirmClearBtn}
                                    disabled={clearing}
                                >
                                    <Trash2 size={16} />
                                    {clearing ? 'Limpando...' : 'Sim, Limpar Todos os Dados'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Seleção de Status */}
            {selectedCell && (
                <div style={modalOverlay} onClick={() => setSelectedCell(null)}>
                    <div style={modalContent} onClick={e => e.stopPropagation()}>
                        <div style={modalHeader}>
                            <div>
                                <h3 style={modalTitle}>{selectedCell.motoristaNome}</h3>
                                <p style={modalSubtitle}>
                                    {selectedCell.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                            <button onClick={() => setSelectedCell(null)} style={closeBtn}><X size={20} /></button>
                        </div>
                        
                        <div style={statusOptions}>
                            {Object.entries(TIPOS_ESCALA).map(([key, val]) => (
                                <button 
                                    key={key} 
                                    style={{
                                        ...statusOptionBtn,
                                        backgroundColor: val.bg,
                                        border: `1px solid ${val.cor}40`
                                    }}
                                    onClick={() => updateStatus(key)}
                                >
                                    <span style={{ fontSize: '20px' }}>{val.icon}</span>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontWeight: '700', color: val.cor }}>{val.desc}</div>
                                        <div style={{ fontSize: '11px', color: '#888' }}>Marcar como {val.sigla}</div>
                                    </div>
                                </button>
                            ))}
                            <button 
                                style={{ ...statusOptionBtn, backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                                onClick={() => updateStatus(null)}
                            >
                                <span style={{ fontSize: '20px' }}>🗑️</span>
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontWeight: '700', color: '#888' }}>Remover Registro</div>
                                    <div style={{ fontSize: '11px', color: '#666' }}>Limpar escala deste dia</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={legendStyle}>
                {Object.entries(TIPOS_ESCALA).map(([key, val]) => (
                    <div key={key} style={legendItem}>
                        <div style={{ ...legendColor, backgroundColor: val.cor }}></div>
                        <span>{val.desc}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ==================== ESTILOS ====================

const containerStyle: React.CSSProperties = {
    padding: '24px',
    color: '#fff',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    backgroundColor: '#000'
};

const statsGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px'
};

const statCard: React.CSSProperties = {
    backgroundColor: '#0A0A0A',
    padding: '20px',
    borderRadius: '16px',
    border: '1px solid #1A1A1A',
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
};

const statIconBox: React.CSSProperties = {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: '#1A1A1A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const statLabel: React.CSSProperties = {
    fontSize: '12px',
    color: '#888',
    fontWeight: '600'
};

const statValue: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: '800',
    color: '#FFF'
};

const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px'
};

const titleSection: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
};

const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: '700',
    margin: 0,
    color: '#FFD700'
};

const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#888',
    margin: 0
};

const actionSection: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap'
};

const searchWrapper: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
};

const searchIcon: React.CSSProperties = {
    position: 'absolute',
    left: '12px',
    color: '#666'
};

const searchInput: React.CSSProperties = {
    backgroundColor: '#111',
    border: '1px solid #222',
    borderRadius: '8px',
    padding: '10px 12px 10px 40px',
    color: '#fff',
    width: '240px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s'
};

const monthPicker: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#111',
    border: '1px solid #222',
    borderRadius: '8px',
    padding: '4px'
};

const monthBtn: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#FFD700',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '6px',
    transition: 'background 0.2s'
};

const monthLabel: React.CSSProperties = {
    padding: '0 16px',
    fontSize: '14px',
    fontWeight: '600',
    minWidth: '160px',
    textAlign: 'center'
};

const autoFillBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#FFD700',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s'
};

const clearAllBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#DC2626',
    color: '#FFF',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s'
};

const tableWrapper: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    border: '1px solid #222',
    borderRadius: '12px',
    backgroundColor: '#0a0a0a'
};

const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    fontSize: '13px'
};

const stickyColHeader: React.CSSProperties = {
    position: 'sticky',
    left: 0,
    top: 0,
    zIndex: 10,
    backgroundColor: '#111',
    padding: '16px',
    textAlign: 'left',
    borderBottom: '2px solid #222',
    borderRight: '2px solid #222',
    minWidth: '250px',
    color: '#FFD700',
    fontWeight: '800'
};

const dayHeaderStyle = (date: Date): React.CSSProperties => {
    const isToday = new Date().toDateString() === date.toDateString();
    return {
        padding: '12px',
        textAlign: 'center',
        borderBottom: '2px solid #222',
        borderRight: '1px solid #222',
        minWidth: '60px',
        backgroundColor: isToday ? '#1a1a00' : '#111',
        position: 'sticky',
        top: 0,
        zIndex: 5
    };
};

const dayNum: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: '700',
    display: 'block'
};

const dayName: React.CSSProperties = {
    fontSize: '10px',
    color: '#888',
    textTransform: 'uppercase'
};

const rowStyle: React.CSSProperties = {
    transition: 'background 0.2s'
};

const stickyCol: React.CSSProperties = {
    position: 'sticky',
    left: 0,
    zIndex: 2,
    backgroundColor: '#0a0a0a',
    padding: '12px 16px',
    borderBottom: '1px solid #222',
    borderRight: '2px solid #222'
};

const motoristaInfo: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
};

const avatarMini: React.CSSProperties = {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#222',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFD700'
};

const motoristaNome: React.CSSProperties = {
    fontWeight: '600',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
};

const cellStyle = (config: any): React.CSSProperties => ({
    padding: '0',
    textAlign: 'center',
    borderBottom: '1px solid #222',
    borderRight: '1px solid #222',
    cursor: 'pointer',
    backgroundColor: config ? config.bg : 'transparent',
    transition: 'all 0.2s',
    height: '45px'
});

const presencaText: React.CSSProperties = {
    color: '#22c55e',
    fontWeight: '700',
    fontSize: '16px'
};

const statusText: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: '800',
    padding: '4px 8px',
    borderRadius: '4px'
};

const legendStyle: React.CSSProperties = {
    display: 'flex',
    gap: '24px',
    padding: '16px',
    backgroundColor: '#111',
    borderRadius: '12px',
    border: '1px solid #222',
    flexWrap: 'wrap'
};

const legendItem: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#ccc'
};

const legendColor: React.CSSProperties = {
    width: '12px',
    height: '12px',
    borderRadius: '3px'
};

const loadingContainer: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: '#FFD700',
    fontSize: '18px',
    fontWeight: '600'
};

// Estilos do Modal
const modalOverlay: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)'
};

const modalContent: React.CSSProperties = {
    backgroundColor: '#0A0A0A',
    borderRadius: '24px',
    padding: '32px',
    width: '90%',
    maxWidth: '450px',
    border: '1px solid #222',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
};

const modalHeader: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
};

const modalBody: React.CSSProperties = {
    marginTop: '16px'
};

const modalTitle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: '800',
    color: '#FFD700',
    margin: 0
};

const modalSubtitle: React.CSSProperties = {
    fontSize: '14px',
    color: '#888',
    margin: '4px 0 0 0'
};

const closeBtn: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    padding: '4px'
};

const statusOptions: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
};

const statusOptionBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    borderRadius: '16px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    width: '100%'
};

const clearConfirmButtons: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginTop: '8px'
};

const cancelClearBtn: React.CSSProperties = {
    backgroundColor: '#1A1A1A',
    color: '#AAA',
    border: '1px solid #333',
    borderRadius: '12px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    flex: 1
};

const confirmClearBtn: React.CSSProperties = {
    backgroundColor: '#DC2626',
    color: '#FFF',
    border: 'none',
    borderRadius: '12px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    justifyContent: 'center',
    transition: 'all 0.2s',
    flex: 1
};

export default EscalaTodosMotoristas;