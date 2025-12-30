import React, { useState, useEffect } from 'react';
import {
    Maximize2, Minimize2,
    Sparkles, Download, Save, Loader2, ChevronLeft,
    Kanban, Calendar as CalendarIcon,
    Image as ImageIcon, PenLine
} from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { Note, AIActionType } from '../types';
import { AIMenu } from './AIMenu';
import { streamAIResponse } from '../services/geminiService';
import { GenerateContentResponse } from "@google/genai";
import { KanbanBoard } from './KanbanBoard';
import { CalendarView } from './CalendarView';
import { ImageBoard } from './ImageBoard';

interface EditorProps {
    note: Note | null;
    allNotes?: Note[];
    onUpdateNote: (id: string, updates: Partial<Note>) => void;
    onSave: () => void;
    onBack: () => void;
    onNavigate?: (id: string) => void;
    className?: string;
}

export const Editor: React.FC<EditorProps> = ({ 
    note, 
    allNotes = [],
    onUpdateNote, 
    onSave, 
    onBack, 
    className = '' 
}) => {
    const [aiMenuPos, setAiMenuPos] = useState<{ top: number, left: number } | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // State for text width mode (persisted in localStorage)
    const [isCentered, setIsCentered] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('editorWidth') === 'centered';
        }
        return false;
    });

    const toggleLayout = () => {
        const newState = !isCentered;
        setIsCentered(newState);
        localStorage.setItem('editorWidth', newState ? 'centered' : 'full');
    };

    const handleManualSave = () => {
        setSaving(true);
        onSave();
        setTimeout(() => setSaving(false), 800);
    };

    const handleAIAction = async (action: AIActionType, prompt?: string) => {
        if (!note) return;
        setIsGenerating(true);
        
        // В упрощенной версии берем весь текст как контекст, если нет выделения
        // Библиотека MDEditor позволяет получить ref на textarea, но для простоты
        // будем работать с текущим content.
        
        // TODO: Для улучшения можно добавить получение выделения через ref textarea,
        // но пока реализуем базовую вставку в конец или генерацию.

        const contextBefore = note.content || "";
        const selectedText = ""; // Пока без точного выделения
        const contextAfter = "";

        try {
            const stream = await streamAIResponse(selectedText, action, prompt, contextBefore, contextAfter);
            let accumulatedText = "";
            
            // Если это продолжение текста - добавляем в конец
            // Если рефакторинг - по хорошему нужно заменять, но пока добавим ниже
            
            let newContent = note.content || "";
            if (action !== AIActionType.CONTINUE) {
                newContent += "\n\n--- AI Result ---\n";
            }

            for await (const chunk of stream) {
                const chunkText = (chunk as GenerateContentResponse).text;
                if (chunkText) {
                    accumulatedText += chunkText;
                    // Обновляем состояние "на лету"
                    onUpdateNote(note.id, { 
                        content: newContent + accumulatedText,
                        updatedAt: Date.now()
                    });
                }
            }
        } catch (error) {
            console.error(error);
            alert("Ошибка ИИ. Проверьте ключ API.");
        } finally {
            setIsGenerating(false);
            setAiMenuPos(null);
        }
    };

    const handleDownload = () => {
        if (!note) return;
        
        const blobType = (note.type === 'board' || note.type === 'calendar' || note.type === 'image-board') 
            ? 'application/json' 
            : 'text/markdown';
            
        const extension = (note.type === 'board' || note.type === 'calendar' || note.type === 'image-board') 
            ? 'json' 
            : 'md';

        const element = document.createElement("a");
        const file = new Blob([note.content], {type: blobType});
        element.href = URL.createObjectURL(file);
        element.download = `${note.title.replace(/[^a-zа-яё0-9]/gi, '_') || 'note'}.${extension}`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    if (!note) {
        return (
            <div className={`flex-1 flex items-center justify-center bg-transparent flex-col gap-6 ${className}`}>
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 flex items-center justify-center shadow-2xl">
                    <PenLine size={32} className="text-zinc-600" />
                </div>
                <div className="text-center">
                    <h2 className="text-zinc-300 font-medium text-lg">Нет выбранной заметки</h2>
                    <p className="text-zinc-500 text-sm mt-1">Выберите из списка или создайте новую</p>
                </div>
            </div>
        );
    }

    const getIcon = () => {
        if (note.type === 'board') return <Kanban className="text-blue-500 shrink-0" size={20} />;
        if (note.type === 'calendar') return <CalendarIcon className="text-blue-500 shrink-0" size={20} />;
        if (note.type === 'image-board') return <ImageIcon className="text-blue-500 shrink-0" size={20} />;
        return <PenLine className="text-zinc-500 shrink-0" size={20} />;
    };

    return (
        <div className={`flex-1 flex flex-col h-full relative bg-transparent min-w-0 overflow-hidden ${className}`}>
            {/* Top Toolbar */}
            <div className="h-14 md:h-16 flex items-center justify-between px-3 md:pl-14 md:pr-6 z-20 shrink-0 w-full bg-zinc-950/80 backdrop-blur-md border-b border-white/5 md:bg-transparent md:border-transparent transition-all duration-300">
                <div className="flex items-center gap-3 md:gap-4 flex-1 mr-4 overflow-hidden">
                    <button onClick={onBack} className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-white/5">
                        <ChevronLeft size={24} />
                    </button>
                    <div className="hidden md:block">{getIcon()}</div>
                    <input 
                        className="bg-transparent text-lg md:text-2xl font-bold text-white focus:outline-none placeholder-zinc-700 w-full truncate font-sans tracking-tight"
                        value={note.title || ''}
                        onChange={(e) => onUpdateNote(note.id, { title: e.target.value })}
                        placeholder="Без названия"
                    />
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={toggleLayout} 
                        className="hidden md:block p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all" 
                        title={isCentered ? "На всю ширину" : "Сфокусироваться"}
                    >
                        {isCentered ? <Maximize2 size={20} /> : <Minimize2 size={20} />}
                    </button>
                    
                     <button onClick={handleManualSave} className="p-2 md:p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all" title="Сохранить">
                        {saving ? <Loader2 size={20} className="animate-spin text-green-500" /> : <Save size={20} />}
                    </button>
                    <button onClick={handleDownload} className="p-2 md:p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all" title="Скачать">
                        <Download size={20} />
                    </button>
                    <button 
                        onClick={() => setAiMenuPos({ top: window.innerHeight / 2 - 150, left: window.innerWidth / 2 - 128 })}
                        className="p-2 md:p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all" 
                        title="AI Помощник"
                    >
                        <Sparkles size={20} />
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            {note.type === 'board' ? (
                 <div className="flex-1 relative w-full h-full min-h-0 overflow-hidden">
                    <KanbanBoard 
                        note={note} 
                        onUpdate={(newContent) => onUpdateNote(note.id, { content: newContent, updatedAt: Date.now() })}
                    />
                </div>
            ) : note.type === 'calendar' ? (
                <div className="flex-1 relative w-full h-full min-h-0 overflow-hidden">
                    <CalendarView 
                        note={note}
                        onUpdate={(newContent) => onUpdateNote(note.id, { content: newContent, updatedAt: Date.now() })}
                    />
                </div>
            ) : note.type === 'image-board' ? (
                <div className="flex-1 relative w-full h-full min-h-0 overflow-hidden">
                    <ImageBoard 
                        note={note}
                        onUpdate={(newContent) => onUpdateNote(note.id, { content: newContent, updatedAt: Date.now() })}
                    />
                </div>
            ) : (
                <div className={`flex-1 relative overflow-hidden flex flex-col min-h-0 p-4 ${isCentered ? 'max-w-4xl mx-auto w-full' : 'w-full'}`} data-color-mode="dark">
                    <div className="h-full flex flex-col">
                        <MDEditor
                            value={note.content || ''}
                            onChange={(val) => onUpdateNote(note.id, { content: val || '', updatedAt: Date.now() })}
                            height="100%"
                            className="bg-transparent border-none shadow-none"
                            style={{ backgroundColor: 'transparent', height: '100%' }}
                            visibleDragbar={false}
                            preview="live"
                            extraCommands={[]}
                        />
                    </div>
                </div>
            )}

            <AIMenu 
                visible={!!aiMenuPos} 
                position={aiMenuPos || { top: 0, left: 0 }} 
                onClose={() => setAiMenuPos(null)}
                onAction={handleAIAction}
                isGenerating={isGenerating}
            />
        </div>
    );
};