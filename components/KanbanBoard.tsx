import React, { useState, useEffect, useRef } from 'react';
import { KanbanColumn, KanbanTask, Note } from '../types';
import { Plus, X, ArrowRight, ArrowLeft, Trash2, CheckCircle2, Circle, MoreHorizontal, Palette, GripVertical } from 'lucide-react';

interface KanbanBoardProps {
    note: Note;
    onUpdate: (content: string) => void;
}

const COLUMN_COLORS = [
    { id: 'zinc', label: 'Серый', classes: 'bg-zinc-800/50 border-zinc-700/50 text-zinc-200' },
    { id: 'red', label: 'Красный', classes: 'bg-red-500/10 border-red-500/20 text-red-200' },
    { id: 'orange', label: 'Оранжевый', classes: 'bg-orange-500/10 border-orange-500/20 text-orange-200' },
    { id: 'yellow', label: 'Желтый', classes: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-200' },
    { id: 'green', label: 'Зеленый', classes: 'bg-green-500/10 border-green-500/20 text-green-200' },
    { id: 'blue', label: 'Синий', classes: 'bg-blue-500/10 border-blue-500/20 text-blue-200' },
    { id: 'purple', label: 'Фиолетовый', classes: 'bg-purple-500/10 border-purple-500/20 text-purple-200' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ note, onUpdate }) => {
    const [columns, setColumns] = useState<KanbanColumn[]>([]);
    const [activeMenuColumnId, setActiveMenuColumnId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            const parsed = JSON.parse(note.content);
            if (Array.isArray(parsed)) {
                setColumns(parsed);
            }
        } catch (e) {
            setColumns([
                { id: 'col1', title: 'Нужно сделать', color: COLUMN_COLORS[1].classes, tasks: [] },
                { id: 'col2', title: 'В работе', color: COLUMN_COLORS[3].classes, tasks: [] },
                { id: 'col3', title: 'Готово', color: COLUMN_COLORS[4].classes, tasks: [] }
            ]);
        }
    }, [note.id]);

    const updateColumns = (newCols: KanbanColumn[]) => {
        setColumns(newCols);
        onUpdate(JSON.stringify(newCols));
    };

    // --- Column Operations ---

    const addColumn = () => {
        const newCol: KanbanColumn = {
            id: crypto.randomUUID(),
            title: 'Новая колонка',
            color: COLUMN_COLORS[0].classes,
            tasks: []
        };
        updateColumns([...columns, newCol]);
        // Scroll to end
        setTimeout(() => {
            if (containerRef.current) {
                containerRef.current.scrollTo({ left: containerRef.current.scrollWidth, behavior: 'smooth' });
            }
        }, 100);
    };

    const deleteColumn = (colId: string) => {
        if (confirmDeleteId === colId) {
            updateColumns(columns.filter(c => c.id !== colId));
            setActiveMenuColumnId(null);
            setConfirmDeleteId(null);
        } else {
            setConfirmDeleteId(colId);
            setTimeout(() => setConfirmDeleteId(null), 3000); // Reset after 3s
        }
    };

    const updateColumnTitle = (colId: string, newTitle: string) => {
        updateColumns(columns.map(c => c.id === colId ? { ...c, title: newTitle } : c));
    };

    const updateColumnColor = (colId: string, colorClasses: string) => {
        updateColumns(columns.map(c => c.id === colId ? { ...c, color: colorClasses } : c));
        setActiveMenuColumnId(null);
    };

    // --- Task Operations ---

    const addTask = (colId: string) => {
        const newCols = columns.map(col => {
            if (col.id === colId) {
                return {
                    ...col,
                    tasks: [...col.tasks, { id: crypto.randomUUID(), text: '' }]
                };
            }
            return col;
        });
        updateColumns(newCols);
    };

    const updateTaskText = (colId: string, taskId: string, text: string) => {
        const newCols = columns.map(col => {
            if (col.id === colId) {
                return {
                    ...col,
                    tasks: col.tasks.map(t => t.id === taskId ? { ...t, text } : t)
                };
            }
            return col;
        });
        updateColumns(newCols);
    };

    const toggleTaskComplete = (colId: string, taskId: string) => {
         const newCols = columns.map(col => {
            if (col.id === colId) {
                return {
                    ...col,
                    tasks: col.tasks.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t)
                };
            }
            return col;
        });
        updateColumns(newCols);
    }

    const deleteTask = (colId: string, taskId: string) => {
        const newCols = columns.map(col => {
            if (col.id === colId) {
                return {
                    ...col,
                    tasks: col.tasks.filter(t => t.id !== taskId)
                };
            }
            return col;
        });
        updateColumns(newCols);
    };

    const moveTask = (fromColIndex: number, taskId: string, direction: 'left' | 'right') => {
        const toColIndex = direction === 'left' ? fromColIndex - 1 : fromColIndex + 1;
        if (toColIndex < 0 || toColIndex >= columns.length) return;

        const taskToMove = columns[fromColIndex].tasks.find(t => t.id === taskId);
        if (!taskToMove) return;

        const newCols = [...columns];
        newCols[fromColIndex] = {
            ...newCols[fromColIndex],
            tasks: newCols[fromColIndex].tasks.filter(t => t.id !== taskId)
        };
        newCols[toColIndex] = {
            ...newCols[toColIndex],
            tasks: [...newCols[toColIndex].tasks, taskToMove]
        };
        updateColumns(newCols);
    };

    return (
        <div 
            ref={containerRef}
            className="absolute inset-0 overflow-x-auto overflow-y-hidden p-4 md:p-6"
            style={{ 
                touchAction: 'pan-x',
                overscrollBehaviorX: 'contain'
            }}
        >
            <div className="flex gap-4 md:gap-6 h-full min-w-full w-max pb-4">
                {columns.map((col, colIndex) => (
                    <div 
                        key={col.id} 
                        className={`w-[85vw] md:w-80 flex flex-col rounded-2xl border backdrop-blur-sm bg-zinc-900/40 shadow-xl overflow-hidden shrink-0 transition-colors duration-300 ${col.color || 'bg-zinc-800/50 border-zinc-700/50'}`}
                    >
                        {/* Column Header */}
                        <div className="p-3 border-b border-white/5 flex items-start gap-2 group relative shrink-0">
                            <input
                                value={col.title}
                                onChange={(e) => updateColumnTitle(col.id, e.target.value)}
                                className="flex-1 bg-transparent font-bold text-lg text-white focus:outline-none focus:bg-white/5 rounded px-1 -ml-1 truncate"
                            />
                            
                            <div className="relative">
                                <button 
                                    onClick={() => {
                                        setActiveMenuColumnId(activeMenuColumnId === col.id ? null : col.id);
                                        setConfirmDeleteId(null);
                                    }}
                                    className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors opacity-100 md:opacity-0 group-hover:opacity-100"
                                >
                                    <MoreHorizontal size={18} />
                                </button>

                                {/* Column Menu */}
                                {activeMenuColumnId === col.id && (
                                    <>
                                        <div 
                                            className="fixed inset-0 z-10" 
                                            onClick={() => setActiveMenuColumnId(null)} 
                                        />
                                        <div className="absolute right-0 top-full mt-2 w-48 bg-surfaceHighlight border border-border rounded-xl shadow-2xl z-20 p-2 animate-fade-in">
                                            <div className="text-xs font-medium text-zinc-500 px-2 py-1 mb-1">Цвет колонки</div>
                                            <div className="grid grid-cols-4 gap-1 mb-2 px-1">
                                                {COLUMN_COLORS.map(c => (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => updateColumnColor(col.id, c.classes)}
                                                        className={`w-8 h-8 rounded-full border border-white/10 hover:scale-110 transition-transform ${c.classes.split(' ')[0]}`}
                                                        title={c.label}
                                                    />
                                                ))}
                                            </div>
                                            <div className="h-px bg-white/5 my-1"></div>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteColumn(col.id);
                                                }}
                                                className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-lg transition-colors ${confirmDeleteId === col.id ? 'bg-red-500 text-white hover:bg-red-600' : 'text-red-400 hover:bg-red-500/10'}`}
                                            >
                                                <Trash2 size={14} /> 
                                                {confirmDeleteId === col.id ? 'Нажмите еще раз' : 'Удалить колонку'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            <span className="text-xs font-mono bg-black/20 px-2 py-0.5 rounded text-white/50 absolute top-3 right-10 pointer-events-none">
                                {col.tasks.length}
                            </span>
                        </div>

                        {/* Tasks List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar" style={{ overscrollBehavior: 'contain' }}>
                            {col.tasks.map(task => (
                                <div key={task.id} className="group bg-surface border border-white/5 hover:border-white/10 rounded-xl p-3 shadow-sm transition-all animate-fade-in relative">
                                    <textarea
                                        value={task.text}
                                        onChange={(e) => updateTaskText(col.id, task.id, e.target.value)}
                                        placeholder="Что нужно сделать?"
                                        className={`w-full bg-transparent border-none resize-none focus:outline-none text-sm font-medium leading-relaxed ${task.isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}
                                        rows={Math.max(2, Math.ceil(task.text.length / 30))}
                                        style={{ touchAction: 'pan-x pan-y' }}
                                    />
                                    
                                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="flex gap-1">
                                             <button 
                                                onClick={() => toggleTaskComplete(col.id, task.id)}
                                                className={`p-1.5 rounded-lg hover:bg-white/10 ${task.isCompleted ? 'text-green-500' : 'text-zinc-500'}`}
                                            >
                                                {task.isCompleted ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                                            </button>
                                            <button 
                                                onClick={() => deleteTask(col.id, task.id)}
                                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <div className="flex gap-1">
                                            <button 
                                                disabled={colIndex === 0}
                                                onClick={() => moveTask(colIndex, task.id, 'left')}
                                                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white disabled:opacity-20"
                                            >
                                                <ArrowLeft size={14} />
                                            </button>
                                            <button 
                                                disabled={colIndex === columns.length - 1}
                                                onClick={() => moveTask(colIndex, task.id, 'right')}
                                                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white disabled:opacity-20"
                                            >
                                                <ArrowRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Add Task Footer */}
                        <div className="p-3 pt-0 mt-auto shrink-0">
                            <button 
                                onClick={() => addTask(col.id)}
                                className="w-full py-2.5 flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 text-white/30 hover:text-white/80 hover:bg-white/5 hover:border-white/30 transition-all text-sm font-medium"
                            >
                                <Plus size={16} /> Добавить задачу
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add Column Button */}
                <button
                    onClick={addColumn}
                    className="w-16 md:w-16 w-[85vw] h-full max-h-[160px] flex items-center justify-center rounded-2xl border border-dashed border-white/10 text-white/20 hover:text-white/80 hover:bg-white/5 hover:border-white/30 transition-all shrink-0 my-auto"
                    title="Добавить колонку"
                >
                    <Plus size={32} />
                </button>
            </div>
        </div>
    );
};