import React, { useState, useEffect } from 'react';
import { 
    Maximize2, Minimize2,
    Sparkles, Download, Save, Loader2, ChevronLeft, 
    Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, 
    SquareCheck, X, PenLine, Kanban, Calendar as CalendarIcon,
    Link2 as LinkIcon, Image as ImageIcon
} from 'lucide-react';

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';

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
    
    // Width layout state
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

    // --- TipTap Editor Setup ---
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Image.configure({
                inline: true,
                allowBase64: true,
                HTMLAttributes: {
                    class: 'rounded-lg max-w-full h-auto my-2 border border-white/10 shadow-lg',
                },
            }),
            Link.configure({
                openOnClick: false, // We handle clicks manually if needed, or let user ctrl+click
                HTMLAttributes: {
                    class: 'text-blue-400 underline decoration-blue-400/30 hover:decoration-blue-400 transition-all cursor-pointer',
                },
            }),
            TaskList.configure({
                HTMLAttributes: {
                    class: 'not-prose pl-2',
                },
            }),
            TaskItem.configure({
                nested: true,
                HTMLAttributes: {
                    class: 'flex gap-2 items-start my-1',
                },
            }),
            Placeholder.configure({
                placeholder: 'Начните писать или нажмите "/" для команд...',
                emptyEditorClass: 'is-editor-empty before:content-[attr(data-placeholder)] before:text-zinc-600 before:float-left before:pointer-events-none before:h-0',
            }),
        ],
        content: note?.content || '',
        editorProps: {
            attributes: {
                class: 'focus:outline-none min-h-[300px] prose prose-invert prose-p:my-1 prose-headings:mb-2 prose-headings:mt-4 prose-ul:my-2 max-w-none text-zinc-300',
            },
        },
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            if (note) {
                 onUpdateNote(note.id, { 
                    content: html,
                    updatedAt: Date.now()
                });
            }
        },
    });

    // Sync content when note changes (e.g. switching notes)
    useEffect(() => {
        if (editor && note && note.type !== 'board' && note.type !== 'calendar' && note.type !== 'image-board') {
            const currentContent = editor.getHTML();
            // Avoid re-rendering loop if content is effectively same
            if (currentContent !== note.content) {
                // Only set content if it's significantly different to avoid cursor jumps on small updates
                // Or better: only set if note ID changed. 
                // Simple check:
                editor.commands.setContent(note.content || '');
            }
        }
    }, [note?.id, editor]); // Depend on ID mostly to switch context

    const handleManualSave = () => {
        setSaving(true);
        onSave();
        setTimeout(() => setSaving(false), 800);
    };

    const insertImage = () => {
        const url = window.prompt('Введите URL изображения:');
        if (url && editor) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    };

    const handleAIAction = async (action: AIActionType, prompt?: string) => {
        if (!note || !editor) return;
        setIsGenerating(true);
        
        // Context
        const { from, to } = editor.state.selection;
        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        const contextBefore = editor.state.doc.textBetween(0, from, ' ');
        const contextAfter = editor.state.doc.textBetween(to, editor.state.doc.content.size, ' ');

        try {
            const stream = await streamAIResponse(selectedText, action, prompt, contextBefore, contextAfter);
            let accumulatedText = "";
            
            // If replacing selection or continuing
            if (action !== AIActionType.CONTINUE) {
                 // Insert a separator or new block if not replacing
                 // For now, let's just insert at cursor
            }

            // Create a transaction to insert text live
            for await (const chunk of stream) {
                const chunkText = (chunk as GenerateContentResponse).text;
                if (chunkText) {
                    accumulatedText += chunkText;
                    // Insert text at current position + offset
                    // This is complex with streaming. 
                    // Simpler approach: Collect full text then insert? No, user wants stream.
                    // We will just insertChunk by chunk.
                    editor.chain().insertContent(chunkText).run();
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
        const blobType = (note.type === 'board' || note.type === 'calendar' || note.type === 'image-board') ? 'application/json' : 'text/html';
        const extension = (note.type === 'board' || note.type === 'calendar' || note.type === 'image-board') ? 'json' : 'html';

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

    // Helper for toolbar buttons
    const ToolbarBtn = ({ 
        icon: Icon, 
        onClick, 
        isActive = false,
        disabled = false
    }: { 
        icon: any, 
        onClick: () => void, 
        isActive?: boolean,
        disabled?: boolean
    }) => (
        <button 
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            disabled={disabled}
            className={`p-1.5 md:p-2.5 rounded-xl transition-all active:scale-95 ${
                isActive 
                    ? 'bg-blue-500/20 text-blue-400' 
                    : 'text-zinc-400 hover:text-white hover:bg-white/10'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <Icon size={18} className="md:w-5 md:h-5" />
        </button>
    );

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
                <>
                    <div className="flex-1 relative overflow-hidden flex flex-col min-h-0">
                        <div 
                            className={`h-full overflow-y-auto px-4 md:px-8 py-6 no-scrollbar transition-all duration-500 ease-in-out ${isCentered ? 'max-w-3xl mx-auto w-full border-x border-white/5 bg-black/20 shadow-2xl' : 'w-full'}`}
                            onClick={() => editor?.commands.focus()}
                        >
                            <EditorContent editor={editor} className="min-h-full" />
                        </div>
                    </div>

                    {/* Bottom Floating Toolbar - Reconnected to TipTap */}
                    {editor && (
                        <div className="w-full z-30 flex justify-center shrink-0 pt-2 pb-6 pointer-events-none bg-transparent absolute bottom-0">
                            <div className="pointer-events-auto bg-zinc-900/90 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 rounded-2xl p-2 flex items-center gap-2 max-w-full overflow-x-auto no-scrollbar snap-x snap-mandatory">
                                
                                <div className="flex items-center gap-1 md:gap-0.5 pr-2 border-r border-white/10 shrink-0 snap-center">
                                    <ToolbarBtn 
                                        icon={Bold} 
                                        onClick={() => editor.chain().focus().toggleBold().run()} 
                                        isActive={editor.isActive('bold')} 
                                    />
                                    <ToolbarBtn 
                                        icon={Italic} 
                                        onClick={() => editor.chain().focus().toggleItalic().run()} 
                                        isActive={editor.isActive('italic')} 
                                    />
                                    {/* TipTap starter kit doesn't have underline by default, usually not md standard, but strikethrough is */}
                                    <ToolbarBtn 
                                        icon={Strikethrough} 
                                        onClick={() => editor.chain().focus().toggleStrike().run()} 
                                        isActive={editor.isActive('strike')} 
                                    />
                                </div>

                                <div className="flex items-center gap-1 md:gap-0.5 px-2 border-r border-white/10 shrink-0 snap-center">
                                    <ToolbarBtn 
                                        icon={List} 
                                        onClick={() => editor.chain().focus().toggleBulletList().run()} 
                                        isActive={editor.isActive('bulletList')} 
                                    />
                                    <ToolbarBtn 
                                        icon={SquareCheck} 
                                        onClick={() => editor.chain().focus().toggleTaskList().run()} 
                                        isActive={editor.isActive('taskList')} 
                                    />
                                    <ToolbarBtn 
                                        icon={ImageIcon} 
                                        onClick={insertImage} 
                                    />
                                </div>

                                <div className="pl-1 shrink-0 snap-center">
                                    <button 
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => setAiMenuPos({ top: window.innerHeight / 2 - 150, left: window.innerWidth / 2 - 128 })}
                                        className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-white text-black shadow-lg hover:shadow-white/20 hover:scale-105 transition-all active:scale-95 flex items-center justify-center"
                                        title="AI Помощник"
                                    >
                                        <Sparkles size={16} className="text-black fill-black md:w-[18px] md:h-[18px]" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
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
