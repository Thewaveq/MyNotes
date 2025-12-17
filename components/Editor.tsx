import React, { useRef, useState, useEffect } from 'react';
import { 
    Sparkles, Download, Save, Loader2, ChevronLeft, 
    Bold, Italic, Underline, Strikethrough, List, 
    SquareCheck, X, PenLine, Kanban, Calendar as CalendarIcon,
    Link2 as LinkIcon, LayoutTemplate, Type, MousePointerClick,
    Image as ImageIcon
} from 'lucide-react';
import { Note, AIActionType } from '../types';
import { AIMenu } from './AIMenu';
import { streamAIResponse } from '../services/geminiService';
import { GenerateContentResponse } from "@google/genai";
import { KanbanBoard } from './KanbanBoard';
import { CalendarView } from './CalendarView';
import { ImageBoard } from './ImageBoard';

interface EditorProps {
    note: Note | null;
    allNotes?: Note[]; // Passed from App to list available notes
    onUpdateNote: (id: string, updates: Partial<Note>) => void;
    onSave: () => void;
    onBack: () => void;
    onNavigate?: (id: string) => void; // Handler for clicking links
    className?: string;
}

interface LinkMenuState {
    visible: boolean;
    top: number;
    left: number;
    searchTerm: string;
    stage: 'select-note' | 'select-style';
    selectedNote?: Note;
}

export const Editor: React.FC<EditorProps> = ({ 
    note, 
    allNotes = [],
    onUpdateNote, 
    onSave, 
    onBack, 
    onNavigate,
    className = '' 
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [aiMenuPos, setAiMenuPos] = useState<{ top: number, left: number } | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    
    // Link Menu State
    const [linkMenuState, setLinkMenuState] = useState<LinkMenuState | null>(null);
    
    const lastNoteIdRef = useRef<string | null>(null);

    const colors = [
        { color: '#fafafa', label: 'Белый' },
        { color: '#ef4444', label: 'Красный' },      // red-500
        { color: '#f97316', label: 'Оранжевый' },    // orange-500
        { color: '#eab308', label: 'Желтый' },       // yellow-500
        { color: '#22c55e', label: 'Зеленый' },      // green-500
        { color: '#3b82f6', label: 'Синий' },        // blue-500
        { color: '#a855f7', label: 'Фиолетовый' },   // purple-500
        { color: '#ec4899', label: 'Розовый' },      // pink-500
    ];

    useEffect(() => {
        if (!note || note.type === 'board' || note.type === 'calendar' || note.type === 'image-board') {
            lastNoteIdRef.current = null;
            return;
        }

        if (editorRef.current) {
            if (note.id !== lastNoteIdRef.current) {
                editorRef.current.innerHTML = note.content || '';
                lastNoteIdRef.current = note.id;
            }
        }
    }, [note]);

    const handleInput = () => {
        if (!note || !editorRef.current) return;
        
        detectMarkdownOnInput();
        detectWikiLink();

        const newContent = editorRef.current.innerHTML;
        const textContent = editorRef.current.innerText;
        const firstLine = textContent.split('\n')[0].substring(0, 40) || 'Новая заметка';
        
        onUpdateNote(note.id, { 
            content: newContent,
            title: firstLine,
            updatedAt: Date.now()
        });
    };

    // --- Wiki Link Logic ---
    const detectWikiLink = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        
        // Only trigger if typing text
        if (node.nodeType !== Node.TEXT_NODE) return;
        
        const text = node.textContent || '';
        const offset = range.startOffset;
        const textBeforeCursor = text.slice(0, offset);

        // Regex to find [[Something
        const match = textBeforeCursor.match(/\[\[([^\]]*)$/);

        if (match) {
            const searchTerm = match[1];
            const rect = range.getBoundingClientRect();
            
            if (rect.bottom === 0 && rect.left === 0) return;

            setLinkMenuState({
                visible: true,
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                searchTerm: searchTerm,
                stage: 'select-note'
            });
        } else {
            setLinkMenuState(null);
        }
    };

    const handleNoteSelect = (targetNote: Note) => {
        if (linkMenuState) {
            setLinkMenuState({
                ...linkMenuState,
                stage: 'select-style',
                selectedNote: targetNote,
                searchTerm: '' 
            });
        }
    };

    const finalizeLinkInsertion = (style: 'inline' | 'card') => {
        if (!linkMenuState || !linkMenuState.selectedNote) return;
        const targetNote = linkMenuState.selectedNote;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        const offset = range.startOffset;
        
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            const lastBracketIndex = text.lastIndexOf('[[', offset);
            
            if (lastBracketIndex !== -1) {
                range.setStart(node, lastBracketIndex);
                range.setEnd(node, offset);
                range.deleteContents();

                let elementToInsert: HTMLElement;

                if (style === 'inline') {
                     elementToInsert = createInlineLinkElement(targetNote);
                } else {
                     elementToInsert = createCardLinkElement(targetNote);
                }

                const spaceAfter = document.createTextNode('\u00A0');

                if (style === 'card') {
                    range.insertNode(spaceAfter);
                    range.insertNode(elementToInsert);
                } else {
                    range.insertNode(spaceAfter);
                    range.insertNode(elementToInsert);
                    range.insertNode(document.createTextNode('\u00A0'));
                }
                
                range.setStartAfter(spaceAfter);
                range.setEndAfter(spaceAfter);
                selection.removeAllRanges();
                selection.addRange(range);
                
                setLinkMenuState(null);
                handleInput();
            }
        }
    };

    // --- HTML Generators for Links ---

    const createInlineLinkElement = (targetNote: Note) => {
        let snippet = getSnippet(targetNote);
        
        const link = document.createElement('a');
        link.href = '#';
        link.dataset.noteId = targetNote.id;
        link.contentEditable = 'false';
        link.className = 'inline-flex items-center gap-2 px-2.5 py-0.5 mx-1 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-white/10 hover:border-blue-500/30 text-zinc-200 transition-all select-none align-middle group no-underline cursor-pointer align-bottom whitespace-normal';
        
        const iconSvg = getIconSvg(targetNote.type);
        
        link.innerHTML = `${iconSvg}<span class="font-medium text-sm underline decoration-white/20 underline-offset-2 group-hover:decoration-blue-500/50 decoration-1">${targetNote.title}</span>${snippet ? `<span class="text-xs text-zinc-500 border-l border-white/10 pl-2 max-w-[120px] truncate hidden sm:inline-block font-sans">${snippet}</span>` : ''}`;
        return link;
    };

    const createCardLinkElement = (targetNote: Note) => {
        const container = document.createElement('div');
        container.contentEditable = 'false';
        container.className = 'block w-full my-3 select-none group whitespace-normal font-sans';
        
        const card = document.createElement('a');
        card.href = '#';
        card.dataset.noteId = targetNote.id;
        card.className = 'relative flex flex-col gap-3 p-3.5 rounded-xl bg-zinc-900 border border-white/5 hover:border-blue-500/30 hover:bg-zinc-800 transition-all cursor-pointer no-underline group-hover:shadow-lg group-hover:shadow-black/20 text-left';
        
        let iconBgClass = 'bg-zinc-800 text-zinc-400';
        let contentHtml = '';
        let typeLabel = '';

        if (targetNote.type === 'board') {
            iconBgClass = 'bg-blue-500/10 text-blue-400';
            typeLabel = 'Доска задач';
            
            try {
                const columns = JSON.parse(targetNote.content);
                if (Array.isArray(columns) && columns.length > 0) {
                    const miniCols = columns.slice(0, 3).map((col: any) => {
                        const taskCount = col.tasks?.length || 0;
                        let barColor = 'bg-zinc-700';
                        if(col.color) {
                           if(col.color.includes('red')) barColor = 'bg-red-500';
                           else if(col.color.includes('green')) barColor = 'bg-green-500';
                           else if(col.color.includes('blue')) barColor = 'bg-blue-500';
                           else if(col.color.includes('yellow')) barColor = 'bg-yellow-500';
                           else if(col.color.includes('orange')) barColor = 'bg-orange-500';
                           else if(col.color.includes('purple')) barColor = 'bg-purple-500';
                        }
                        let tasksHtml = '';
                        for(let i=0; i<Math.min(taskCount, 4); i++) {
                            tasksHtml += `<div class="h-1 w-full rounded-full ${barColor} opacity-40 mb-1"></div>`;
                        }

                        return `
                        <div class="flex-1 min-w-0 bg-white/5 rounded p-1.5 flex flex-col gap-1 h-20 border border-white/5">
                            <div class="flex items-center gap-1.5 mb-0.5">
                                <div class="w-1.5 h-1.5 rounded-full ${barColor}"></div>
                                <span class="text-[9px] font-bold text-zinc-400 uppercase truncate font-sans">${col.title}</span>
                            </div>
                            <div class="flex-1 flex flex-col gap-1">
                                ${tasksHtml}
                                ${taskCount === 0 ? '<div class="h-full border border-dashed border-white/5 rounded"></div>' : ''}
                            </div>
                        </div>`;
                    }).join('');
                    contentHtml = `<div class="flex gap-2 mt-1 w-full">${miniCols}</div>`;
                } else {
                    contentHtml = '<div class="text-xs text-zinc-500 py-2 font-sans">Пустая доска</div>';
                }
            } catch (e) { contentHtml = '<div class="text-xs text-zinc-500 py-2 font-sans">Ошибка данных доски</div>'; }

        } else if (targetNote.type === 'calendar') {
            iconBgClass = 'bg-purple-500/10 text-purple-400';
            typeLabel = 'Календарь';
            try {
                const data = JSON.parse(targetNote.content);
                let allEvents: {date: string, text: string, completed: boolean}[] = [];
                Object.entries(data).forEach(([date, events]: [string, any]) => {
                    events.forEach((ev: any) => allEvents.push({ date, text: ev.text, completed: ev.isCompleted }));
                });
                allEvents.sort((a, b) => a.date.localeCompare(b.date));
                const upcoming = allEvents.slice(0, 3);

                if (upcoming.length > 0) {
                    const listHtml = upcoming.map(ev => {
                        const [y, m, d] = ev.date.split('-');
                        const shortDate = `${d}.${m}`;
                        return `
                        <div class="flex items-center gap-2.5 text-xs py-1 border-b border-white/5 last:border-0 font-sans">
                            <span class="font-mono text-purple-400 font-bold bg-purple-500/10 px-1.5 rounded text-[10px]">${shortDate}</span>
                            <span class="truncate ${ev.completed ? 'text-zinc-500 line-through' : 'text-zinc-300'}">${ev.text}</span>
                        </div>`;
                    }).join('');
                    contentHtml = `<div class="flex flex-col mt-1 bg-white/5 rounded-lg px-2 py-1 border border-white/5">${listHtml}</div>`;
                } else {
                     contentHtml = '<div class="text-xs text-zinc-500 py-1 font-sans">Нет предстоящих событий</div>';
                }
            } catch(e) { contentHtml = 'Нет событий'; }
        
        } else if (targetNote.type === 'image-board') {
            iconBgClass = 'bg-green-500/10 text-green-400';
            typeLabel = 'Референсы';
            
            try {
                const images = JSON.parse(targetNote.content);
                if (Array.isArray(images) && images.length > 0) {
                    const previewImages = images.slice(0, 4).map(img => `
                        <div class="aspect-square rounded-md overflow-hidden bg-black/50 border border-white/5">
                            <img src="${img.url}" class="w-full h-full object-cover" />
                        </div>
                    `).join('');
                    
                    contentHtml = `
                    <div class="grid grid-cols-4 gap-2 mt-1">
                        ${previewImages}
                        ${images.length > 4 ? `<div class="aspect-square rounded-md bg-white/5 flex items-center justify-center text-[10px] text-zinc-500 font-bold border border-white/5">+${images.length - 4}</div>` : ''}
                    </div>`;
                } else {
                    contentHtml = '<div class="text-xs text-zinc-500 py-1 font-sans">Пустая доска</div>';
                }
            } catch(e) { contentHtml = '<div class="text-xs text-zinc-500 py-1">Ошибка данных</div>'; }

        } else {
             // Text Note
             const tempDiv = document.createElement('div');
             tempDiv.innerHTML = targetNote.content;
             let rawText = tempDiv.innerText.replace(/\s+/g, ' ').trim();
             const cleanTitle = targetNote.title.trim();
             if (rawText.startsWith(cleanTitle)) {
                 rawText = rawText.substring(cleanTitle.length).trim();
             }
             if (rawText.length > 0) {
                 const snippet = rawText.substring(0, 140);
                 const hasMore = rawText.length > 140;
                 contentHtml = `
                 <div class="mt-1">
                    <p class="text-xs text-zinc-400 line-clamp-3 leading-relaxed font-sans">
                        ${snippet}${hasMore ? '...' : ''}
                    </p>
                 </div>`;
             } else {
                 contentHtml = '<div class="text-xs text-zinc-600 mt-1 font-sans">Пустая заметка</div>';
             }
        }

        const iconSvg = getIconSvg(targetNote.type, 16);
        const dateStr = new Date(targetNote.updatedAt).toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long' 
        });

        card.innerHTML = `
            <div class="flex items-center gap-3 border-b border-white/5 pb-2 font-sans">
                <div class="w-8 h-8 rounded-lg ${iconBgClass} flex items-center justify-center shrink-0 ring-1 ring-inset ring-white/10">
                    ${iconSvg}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-semibold text-sm text-zinc-200 group-hover:text-blue-400 transition-colors truncate">
                        ${targetNote.title}
                    </div>
                    <div class="flex items-center gap-2 text-[10px] text-zinc-500">
                        ${typeLabel ? `<span class="uppercase font-bold tracking-wider">${typeLabel}</span>` : ''}
                        <span>•</span>
                        <span>${dateStr}</span>
                    </div>
                </div>
                <div class="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
                </div>
            </div>
            <div class="w-full">
                ${contentHtml}
            </div>
        `;
        
        container.appendChild(card);
        return container;
    };

    const getSnippet = (note: Note) => {
        if (note.type === 'text') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = note.content;
            const plainText = tempDiv.innerText.replace(/\s+/g, ' ').trim();
            if (plainText) {
                const cleanTitle = note.title.trim();
                const textWithoutTitle = plainText.startsWith(cleanTitle) 
                    ? plainText.slice(cleanTitle.length).trim() 
                    : plainText;
                let s = textWithoutTitle.substring(0, 35);
                if (textWithoutTitle.length > 35) s += '...';
                return s;
            }
        } else if (note.type === 'board') return 'Доска задач';
        else if (note.type === 'calendar') return 'Календарь';
        else if (note.type === 'image-board') return 'Референсы';
        return '';
    };

    const getIconSvg = (type: Note['type'], size = 14) => {
        if (type === 'board') return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v7"/><path d="M16 7v7"/><path d="M12 7v7"/></svg>`;
        if (type === 'calendar') return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
        if (type === 'image-board') return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7h2a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-2"></path><path d="M9 17H7A5 5 0 0 1 7 7h2"></path><line x1="8" y1="12" x2="16" y2="12"></line></svg>`;
    };

    const handleEditorClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const link = target.closest('a');
        
        if (link && link.dataset.noteId) {
            e.preventDefault();
            e.stopPropagation();
            if (onNavigate) {
                onNavigate(link.dataset.noteId);
            }
        }
    };

    // --- Formatting Helpers ---
    const execFormat = (command: string, value: string | undefined = undefined) => {
        if (editorRef.current) editorRef.current.focus();
        document.execCommand(command, false, value);
        handleInput();
    };

    const applyColor = (color: string) => {
        if (editorRef.current) editorRef.current.focus();
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('foreColor', false, color);
        setShowColorPicker(false);
        handleInput();
    };

    const insertCheckbox = () => {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        
        const div = document.createElement('div');
        div.className = "flex items-center gap-2 my-1";
        div.innerHTML = `<input type="checkbox" class="accent-accent w-4 h-4 cursor-pointer"> <span>Задача</span>`;
        
        range.deleteContents();
        range.insertNode(div);
        range.setStartAfter(div);
        range.setEndAfter(div);
        selection.removeAllRanges();
        selection.addRange(range);
        
        handleInput();
        if (editorRef.current) editorRef.current.focus();
    };

    // --- Markdown Logic ---
    const detectMarkdownOnInput = () => {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent) return;
        const offset = range.startOffset;
        const textToCursor = node.textContent.slice(0, offset);
        if (!/[\s\u00A0]$/.test(textToCursor)) return;
        
        const spaceMatch = textToCursor.match(/[\s\u00A0]+$/);
        const triggerLen = spaceMatch ? spaceMatch[0].length : 0;
        const textToCheck = textToCursor.slice(0, -triggerLen);
        
        const boldMatch = textToCheck.match(/\*\*([^*]+)\*\*$/);
        if (boldMatch) { applyInputFormatting(boldMatch, 'bold', node, offset, triggerLen); return; }
        
        if (!textToCheck.endsWith('**') && !textToCheck.endsWith('__')) {
            const italicMatch = textToCheck.match(/([*_])([^*_]+)\1$/);
            if (italicMatch) { applyInputFormatting(italicMatch, 'italic', node, offset, triggerLen); return; }
        }

        const strikeMatch = textToCheck.match(/~~([^~]+)~~$/);
        if (strikeMatch) { applyInputFormatting(strikeMatch, 'strike', node, offset, triggerLen); return; }
        
        const headerMatch = textToCheck.match(/^(#{1,3})$/);
        if (headerMatch) {
            const level = headerMatch[1].length;
            range.setStart(node, 0); 
            range.setEnd(node, offset);
            range.deleteContents();
            document.execCommand('formatBlock', false, `h${level}`);
            return;
        }
    };

    const applyInputFormatting = (match: RegExpMatchArray, type: string, node: Node, currentOffset: number, triggerLen: number) => {
        const fullMatch = match[0];
        const innerText = match[type === 'italic' ? 2 : 1];
        const selection = window.getSelection();
        if (!selection) return;
        const range = selection.getRangeAt(0);
        const lengthToRemove = fullMatch.length + triggerLen;
        const startOffset = currentOffset - lengthToRemove;
        if (startOffset < 0) return;

        range.setStart(node, startOffset);
        range.setEnd(node, currentOffset);
        range.deleteContents();

        let html = '';
        if (type === 'bold') html = `<b>${innerText}</b>&nbsp;`;
        if (type === 'italic') html = `<i>${innerText}</i>&nbsp;`;
        if (type === 'strike') html = `<s>${innerText}</s>&nbsp;`;

        document.execCommand('insertHTML', false, html);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (note?.type === 'board' || note?.type === 'calendar' || note?.type === 'image-board') return; 

        if ((e.ctrlKey || e.metaKey) && (e.code === 'Space' || e.code === 'KeyJ')) {
            e.preventDefault();
            setAiMenuPos({ top: window.innerHeight / 2 - 150, left: window.innerWidth / 2 - 128 });
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleManualSave();
            return;
        }
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') { e.preventDefault(); execFormat('bold'); return; }
            if (e.key === 'i') { e.preventDefault(); execFormat('italic'); return; }
            if (e.key === 'u') { e.preventDefault(); execFormat('underline'); return; }
        }
        if (e.key === 'Escape' && linkMenuState) {
            setLinkMenuState(null);
        }
    };

    const handleManualSave = () => {
        setSaving(true);
        onSave();
        setTimeout(() => setSaving(false), 800);
    };

    const handleAIAction = async (action: AIActionType, prompt?: string) => {
        if (!note || !editorRef.current) return;
        setIsGenerating(true);
        const selection = window.getSelection();
        let range: Range | null = null;
        let selectedText = "";
        let contextBefore = "";
        let contextAfter = "";
        
        if (selection && selection.rangeCount > 0 && editorRef.current.contains(selection.anchorNode)) {
            range = selection.getRangeAt(0);
            selectedText = range.toString();
            const preSelectionRange = range.cloneRange();
            preSelectionRange.selectNodeContents(editorRef.current);
            preSelectionRange.setEnd(range.startContainer, range.startOffset);
            contextBefore = preSelectionRange.toString();
            const postSelectionRange = range.cloneRange();
            postSelectionRange.selectNodeContents(editorRef.current);
            postSelectionRange.setStart(range.endContainer, range.endOffset);
            contextAfter = postSelectionRange.toString();
        } else {
             contextBefore = editorRef.current.innerText;
        }

        try {
            const stream = await streamAIResponse(selectedText, action, prompt, contextBefore, contextAfter);
            let accumulatedHTML = "";
            if (range) {
                if (action !== AIActionType.CONTINUE) range.deleteContents();
                else range.collapse(false);
            }
            const wrapper = document.createElement('span');
            if (range) range.insertNode(wrapper);
            else editorRef.current.appendChild(wrapper);

            for await (const chunk of stream) {
                const chunkText = (chunk as GenerateContentResponse).text;
                if (chunkText) {
                    accumulatedHTML += chunkText;
                    wrapper.innerHTML = accumulatedHTML;
                }
            }
            handleInput();
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
        if (note.type === 'board' || note.type === 'calendar' || note.type === 'image-board') {
            const element = document.createElement("a");
            const file = new Blob([note.content], {type: 'application/json'});
            const prefix = note.type;
            element.href = URL.createObjectURL(file);
            element.download = `${note.title.replace(/[^a-zа-яё0-9]/gi, '_') || prefix}.json`;
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
            return;
        }

        const element = document.createElement("a");
        const file = new Blob([
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${note.title}</title></head><body style="background:#09090b;color:#fafafa;font-family:sans-serif;padding:20px;">${note.content}</body></html>`
        ], {type: 'text/html'});
        element.href = URL.createObjectURL(file);
        element.download = `${note.title.replace(/[^a-zа-яё0-9]/gi, '_') || 'note'}.html`;
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

    const ToolbarBtn = ({ icon: Icon, onClick, active = false }: { icon: any, onClick: (e: React.MouseEvent) => void, active?: boolean }) => (
        <button 
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            className={`p-1.5 md:p-2.5 rounded-xl transition-all active:scale-95 ${active ? 'bg-accent/20 text-accent' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
        >
            <Icon size={18} className="md:w-5 md:h-5" />
        </button>
    );

    const getIcon = () => {
        if (note.type === 'board') return <Kanban className="text-blue-500 shrink-0" size={20} />;
        if (note.type === 'calendar') return <CalendarIcon className="text-blue-500 shrink-0" size={20} />;
        if (note.type === 'image-board') return <ImageIcon className="text-blue-500 shrink-0" size={20} />;
        return <PenLine className="text-zinc-500 shrink-0" size={20} />;
    };

    const filteredNotesForLink = linkMenuState && allNotes
        ? allNotes.filter(n => 
            n.id !== note.id && 
            n.title && n.title.toLowerCase().includes(linkMenuState.searchTerm.toLowerCase())
          ).slice(0, 5)
        : [];

    return (
        <div className={`flex-1 flex flex-col h-full relative bg-transparent min-w-0 ${className}`}>
            {/* Top Toolbar */}
            <div className="h-14 md:h-16 flex items-center justify-between px-3 md:px-6 z-20 shrink-0 sticky top-0 transition-all duration-300 bg-background/80 backdrop-blur-md md:bg-transparent">
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
                <div className="flex-1 relative overflow-hidden flex flex-col">
                    <div
                        ref={editorRef}
                        contentEditable
                        onInput={handleInput}
                        onKeyDown={handleKeyDown}
                        onClick={handleEditorClick}
                        className="flex-1 w-full max-w-3xl mx-auto p-4 md:p-8 pb-48 overflow-y-auto focus:outline-none text-zinc-300 leading-relaxed text-base md:text-lg font-serif outline-none no-scrollbar
                        [&_h1]:text-2xl md:[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:tracking-tight
                        [&_h2]:text-xl md:[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-zinc-100 [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:tracking-tight
                        [&_h3]:text-lg md:[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-zinc-200 [&_h3]:mt-4 [&_h3]:mb-2
                        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:text-zinc-300
                        [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:text-zinc-300
                        [&_li]:my-1 [&_li]:pl-1
                        [&_p]:mb-2 [&_p]:mt-0
                        [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-700 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-400 [&_blockquote]:my-2
                        [&_b]:font-bold [&_b]:text-zinc-100
                        [&_i]:italic [&_i]:text-zinc-400
                        [&_s]:line-through [&_s]:opacity-60
                        [&_code]:bg-white/5 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-sm
                        [&_input[type=checkbox]]:accent-accent [&_input[type=checkbox]]:w-4 [&_input[type=checkbox]]:h-4 [&_input[type=checkbox]]:mt-1"
                        spellCheck={false}
                        style={{ whiteSpace: 'pre-wrap' }} 
                    />
                </div>
                
                {/* Color Picker Overlay */}
                {showColorPicker && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 grid grid-cols-5 gap-3 z-40 animate-fade-in w-auto shadow-black/50">
                        {colors.map((c) => (
                            <button
                                key={c.color}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    applyColor(c.color);
                                }}
                                className="w-9 h-9 rounded-full border border-white/10 hover:scale-110 transition-transform ring-2 ring-transparent hover:ring-white focus:outline-none shrink-0 shadow-sm"
                                style={{ backgroundColor: c.color }}
                                title={c.label}
                            />
                        ))}
                        <button 
                             onMouseDown={(e) => e.preventDefault()}
                             onClick={() => setShowColorPicker(false)}
                             className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 text-zinc-400 hover:text-white border border-white/10 shrink-0 hover:bg-white/10 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}

                {/* Wiki Link Suggestion Menu */}
                {linkMenuState && (
                    <>
                        <div 
                            className="fixed inset-0 z-40 bg-transparent"
                            onClick={() => setLinkMenuState(null)} 
                        />
                        <div 
                            className="fixed z-50 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl w-64 max-h-60 overflow-y-auto animate-fade-in"
                            style={{ top: linkMenuState.top + 8, left: linkMenuState.left }}
                        >
                            {linkMenuState.stage === 'select-note' ? (
                                <>
                                    <div className="p-2 border-b border-white/5 text-xs font-bold text-zinc-500 uppercase">
                                        Ссылка на заметку
                                    </div>
                                    {filteredNotesForLink.length === 0 ? (
                                        <div className="p-3 text-sm text-zinc-500 italic">Заметки не найдены</div>
                                    ) : (
                                        filteredNotesForLink.map(n => (
                                            <button
                                                key={n.id}
                                                onClick={() => handleNoteSelect(n)}
                                                className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-white flex items-center gap-2 transition-colors"
                                            >
                                                <LinkIcon size={14} className="text-blue-500" />
                                                <span className="truncate">{n.title || 'Без названия'}</span>
                                            </button>
                                        ))
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="p-2 border-b border-white/5 flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase">
                                        <button onClick={() => setLinkMenuState({...linkMenuState, stage: 'select-note'})} className="hover:text-white"><ChevronLeft size={12}/></button>
                                        Вид ссылки
                                    </div>
                                    <div className="p-1 space-y-1">
                                        <button
                                            onClick={() => finalizeLinkInsertion('inline')}
                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 flex items-center gap-3 transition-colors group"
                                        >
                                            <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white">
                                                <Type size={16} />
                                            </div>
                                            <div>
                                                <div className="text-sm text-zinc-200 font-medium">Текст</div>
                                                <div className="text-xs text-zinc-500">Компактная ссылка в строке</div>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => finalizeLinkInsertion('card')}
                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 flex items-center gap-3 transition-colors group"
                                        >
                                            <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white">
                                                <LayoutTemplate size={16} />
                                            </div>
                                            <div>
                                                <div className="text-sm text-zinc-200 font-medium">Карточка</div>
                                                <div className="text-xs text-zinc-500">Блок с предпросмотром</div>
                                            </div>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}

                {/* Bottom Floating Toolbar */}
                <div 
                    className="absolute left-1/2 -translate-x-1/2 w-[96%] md:w-auto z-30 flex justify-center pointer-events-none transition-all duration-300"
                    style={{ bottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
                >
                    <div className="pointer-events-auto bg-zinc-900/90 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 rounded-2xl p-2 flex items-center gap-2 max-w-full overflow-x-auto no-scrollbar snap-x snap-mandatory">
                        
                        <div className="flex items-center gap-1 md:gap-0.5 pr-2 border-r border-white/10 shrink-0 snap-center">
                            <ToolbarBtn icon={Bold} onClick={() => execFormat('bold')} />
                            <ToolbarBtn icon={Italic} onClick={() => execFormat('italic')} />
                            <ToolbarBtn icon={Underline} onClick={() => execFormat('underline')} />
                            <ToolbarBtn icon={Strikethrough} onClick={() => execFormat('strikeThrough')} />
                        </div>

                        <div className="flex items-center gap-1 md:gap-0.5 px-2 border-r border-white/10 shrink-0 snap-center">
                            <ToolbarBtn icon={List} onClick={() => execFormat('insertUnorderedList')} />
                            <ToolbarBtn icon={SquareCheck} onClick={() => insertCheckbox()} />
                        </div>

                        <div className="px-2 shrink-0 snap-center">
                            <button 
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setShowColorPicker(!showColorPicker)}
                                className={`w-8 h-8 md:w-9 md:h-9 rounded-xl border transition-all flex items-center justify-center ${showColorPicker ? 'border-white bg-white/10' : 'border-transparent hover:bg-white/5'}`}
                            >
                                <div className="w-4 h-4 md:w-5 md:h-5 rounded-full" style={{ background: 'linear-gradient(135deg, #f87171, #60a5fa)' }}></div>
                            </button>
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

                <AIMenu 
                    visible={!!aiMenuPos} 
                    position={aiMenuPos || { top: 0, left: 0 }} 
                    onClose={() => setAiMenuPos(null)}
                    onAction={handleAIAction}
                    isGenerating={isGenerating}
                />
                </>
            )}
        </div>
    );
};