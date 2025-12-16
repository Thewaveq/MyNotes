import React, { useState, useEffect } from 'react';
import { Note, CalendarData, CalendarEvent } from '../types';
import { ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon } from 'lucide-react';

interface CalendarViewProps {
    note: Note;
    onUpdate: (content: string) => void;
}

const DAYS_OF_WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export const CalendarView: React.FC<CalendarViewProps> = ({ note, onUpdate }) => {
    const [date, setDate] = useState(new Date());
    const [selectedDateIso, setSelectedDateIso] = useState<string>(new Date().toISOString().split('T')[0]);
    const [calendarData, setCalendarData] = useState<CalendarData>({});
    const [newTaskText, setNewTaskText] = useState('');

    useEffect(() => {
        try {
            const parsed = JSON.parse(note.content);
            setCalendarData(parsed);
        } catch (e) {
            setCalendarData({});
        }
    }, [note.id]);

    const updateCalendarData = (newData: CalendarData) => {
        setCalendarData(newData);
        onUpdate(JSON.stringify(newData));
    };

    // --- Date Logic ---
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => {
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1; // Convert Sun(0) to 6, Mon(1) to 0
    };

    const handlePrevMonth = () => {
        setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1));
    };

    const handleDateClick = (day: number) => {
        const newDate = new Date(date.getFullYear(), date.getMonth(), day);
        // Correct timezone offset issue by manually formatting
        const year = newDate.getFullYear();
        const month = String(newDate.getMonth() + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        setSelectedDateIso(`${year}-${month}-${d}`);
    };

    // --- Task Logic ---
    const addTask = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newTaskText.trim()) return;

        const currentTasks = calendarData[selectedDateIso] || [];
        const newTask: CalendarEvent = {
            id: crypto.randomUUID(),
            text: newTaskText.trim(),
            isCompleted: false
        };

        updateCalendarData({
            ...calendarData,
            [selectedDateIso]: [...currentTasks, newTask]
        });
        setNewTaskText('');
    };

    const toggleTask = (taskId: string) => {
        const currentTasks = calendarData[selectedDateIso] || [];
        const updatedTasks = currentTasks.map(t => 
            t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t
        );
        updateCalendarData({
            ...calendarData,
            [selectedDateIso]: updatedTasks
        });
    };

    const deleteTask = (taskId: string) => {
        const currentTasks = calendarData[selectedDateIso] || [];
        const updatedTasks = currentTasks.filter(t => t.id !== taskId);
        
        // Cleanup empty dates
        const newData = { ...calendarData };
        if (updatedTasks.length === 0) {
            delete newData[selectedDateIso];
        } else {
            newData[selectedDateIso] = updatedTasks;
        }
        updateCalendarData(newData);
    };

    // --- Render Helpers ---
    const renderCalendarGrid = () => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const startDay = getFirstDayOfMonth(year, month);
        
        const days = [];
        // Padding
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-14 md:h-20" />);
        }

        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const currentIso = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const isSelected = currentIso === selectedDateIso;
            const isToday = new Date().toISOString().split('T')[0] === currentIso;
            const hasEvents = calendarData[currentIso]?.length > 0;
            const completedCount = calendarData[currentIso]?.filter(t => t.isCompleted).length || 0;
            const totalCount = calendarData[currentIso]?.length || 0;
            const allCompleted = totalCount > 0 && completedCount === totalCount;

            days.push(
                <button
                    key={i}
                    onClick={() => handleDateClick(i)}
                    className={`
                        h-14 md:h-20 rounded-xl border relative flex flex-col items-center justify-start py-2 transition-all
                        ${isSelected 
                            ? 'border-blue-500 bg-blue-500/10 z-10' 
                            : 'border-white/5 hover:border-white/10 hover:bg-white/5 bg-surface/50'}
                        ${isToday ? 'ring-1 ring-blue-500/50' : ''}
                    `}
                >
                    <span className={`text-sm font-medium ${isToday ? 'text-blue-400' : 'text-zinc-400'}`}>{i}</span>
                    
                    {hasEvents && (
                        <div className="mt-auto mb-2 flex gap-1">
                            {allCompleted ? (
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                            )}
                            {totalCount > 1 && (
                                <span className="text-[9px] text-zinc-600 leading-none">+{totalCount - 1}</span>
                            )}
                        </div>
                    )}
                </button>
            );
        }
        return days;
    };

    const selectedTasks = calendarData[selectedDateIso] || [];

    return (
        <div className="flex flex-col md:flex-row h-full w-full overflow-hidden">
            {/* Left: Calendar Grid */}
            <div className="flex-1 flex flex-col p-4 md:p-6 overflow-y-auto no-scrollbar">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white capitalize">
                        {MONTHS[date.getMonth()]} <span className="text-zinc-500">{date.getFullYear()}</span>
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={handlePrevMonth} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white">
                            <ChevronLeft size={20} />
                        </button>
                        <button onClick={() => setDate(new Date())} className="px-3 py-1.5 text-xs font-medium hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white border border-white/10">
                            Сегодня
                        </button>
                        <button onClick={handleNextMonth} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                    {DAYS_OF_WEEK.map(d => (
                        <div key={d} className="text-center text-xs font-medium text-zinc-500 py-1 uppercase tracking-wider">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-2 flex-1 auto-rows-min">
                    {renderCalendarGrid()}
                </div>
            </div>

            {/* Right: Task Panel */}
            <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-white/5 bg-zinc-950/30 p-4 md:p-6 flex flex-col h-[40vh] md:h-full">
                <div className="mb-4">
                    <div className="text-sm text-zinc-500 font-medium uppercase tracking-wider mb-1">Выбрана дата</div>
                    <div className="text-xl font-bold text-white">
                        {new Date(selectedDateIso).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                </div>

                {/* Add Task Input */}
                <form onSubmit={addTask} className="mb-4 relative group">
                    <input 
                        type="text" 
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        placeholder="Добавить задачу..." 
                        className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-4 pr-10 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all placeholder-zinc-500"
                    />
                    <button 
                        type="submit"
                        disabled={!newTaskText.trim()}
                        className="absolute right-2 top-2 p-1 bg-blue-500 text-white rounded-lg disabled:opacity-0 transition-all shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95"
                    >
                        <Plus size={16} />
                    </button>
                </form>

                {/* Task List */}
                <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
                    {selectedTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2 opacity-50">
                            <CalendarIcon size={32} strokeWidth={1.5} />
                            <span className="text-sm">Нет задач на этот день</span>
                        </div>
                    ) : (
                        selectedTasks.map(task => (
                            <div 
                                key={task.id} 
                                className="group flex items-start gap-3 p-3 rounded-xl bg-surface border border-white/5 hover:border-white/10 transition-colors animate-fade-in"
                            >
                                <button 
                                    onClick={() => toggleTask(task.id)}
                                    className={`mt-0.5 shrink-0 transition-colors ${task.isCompleted ? 'text-green-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    {task.isCompleted ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                </button>
                                <span className={`text-sm leading-relaxed flex-1 break-words ${task.isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                                    {task.text}
                                </span>
                                <button 
                                    onClick={() => deleteTask(task.id)}
                                    className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};