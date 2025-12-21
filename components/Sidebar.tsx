import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Note, Folder, UserProfile } from '../types';
import { 
    Trash2, Search, FileJson, 
    Command, Folder as FolderIcon, FolderOpen, MoreHorizontal,
    CornerDownRight, ChevronRight, ChevronDown, FileText,
    Kanban, FilePlus, Edit2, Calendar as CalendarIcon, Image as ImageIcon,
    Settings, User
} from 'lucide-react';

interface SidebarProps {
    notes: Note[];
    folders: Folder[];
    activeNoteId: string | null;
    user?: UserProfile | null; // Added User prop
    onSelectNote: (id: string) => void;
    onCreateNote: (folderId?: string, type?: 'text' | 'board' | 'calendar' | 'image-board') => void;
    onDeleteNote: (id: string, e: React.MouseEvent) => void;
    onCreateFolder: (name: string, parentId?: string) => void;
    onUpdateFolder: (id: string, name: string) => void;
    onDeleteFolder: (id: string) => void;
    onMoveNote: (noteId: string, folderId?: string) => void;
    onMoveFolder: (folderId: string, targetParentId?: string) => void;
    onOpenSettings: () => void; // New Handler
    className?: string;
}

interface NoteItemProps {
    note: Note;
    isActive: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onOpenMoveMenu: (id: string) => void;
    onDragStart: (e: React.DragEvent, id: string) => void;
}

const getNoteIcon = (type: Note['type']) => {
    switch (type) {
        case 'board': return <Kanban size={16} />;
        case 'calendar': return <CalendarIcon size={16} />;
        case 'image-board': return <ImageIcon size={16} />;
        default: return <FileText size={16} />;
    }
};

const NoteItem: React.FC<NoteItemProps & { 
    isMenuOpen: boolean;
    onToggleMenu: (e: React.MouseEvent) => void; 
}> = ({ 
    note, 
    isActive, 
    onSelect, 
    onDelete, 
    onOpenMoveMenu, 
    onDragStart,
    isMenuOpen,
    onToggleMenu
}) => (
    <div 
        draggable
        onDragStart={(e) => onDragStart(e, note.id)}
        onClick={() => onSelect(note.id)}
        className={`group relative p-2.5 rounded-xl cursor-pointer transition-all duration-200 border border-transparent mb-1 ml-4
        ${isActive 
            ? 'bg-white/10 shadow-lg shadow-black/20 border-white/5' 
            : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200'}
        `}
    >
        <div className="flex items-center gap-3 relative z-0">
             {/* Icon Indicator */}
             <div className={`mt-0.5 shrink-0 ${isActive ? 'text-blue-400' : 'text-zinc-600 group-hover:text-zinc-500'}`}>
                {getNoteIcon(note.type)}
            </div>

            {/* Text Container - Flex 1 to take space */}
            <div className="flex-1 min-w-0 pr-6"> {/* pr-6 оставляет место под кнопку, чтобы текст не наезжал */}
                <h3 className={`font-medium truncate text-[14px] leading-snug ${isActive ? 'text-white' : 'text-zinc-300'}`}>
                    {note.title || (note.type === 'board' ? 'Новая доска' : note.type === 'calendar' ? 'Календарь' : note.type === 'image-board' ? 'Референсы' : 'Без названия')}
                </h3>
            </div>
            
            {/* 3 Dots Button (Absolute) */}
            <div className={`absolute right-1 top-1/2 -translate-y-1/2 z-10 ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                <button 
                    onClick={onToggleMenu}
                    className={`p-1 rounded-lg transition-colors ${isMenuOpen ? 'bg-zinc-700 text-white' : 'hover:bg-zinc-700/50 text-zinc-500 hover:text-white'}`}
                >
                    <MoreHorizontal size={16} />
                </button>
            </div>
        </div>

        {/* Dropdown Menu */}
        {isMenuOpen && (
            <div className="absolute right-0 top-9 z-50 w-40 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl shadow-black p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                <button 
                    onClick={(e) => { e.stopPropagation(); onOpenMoveMenu(note.id); }}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg w-full text-left"
                >
                    <CornerDownRight size={14} /> Переместить
                </button>
                <div className="h-px bg-white/5 my-0.5" />
                <button 
                    onClick={(e) => onDelete(note.id, e)}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg w-full text-left"
                >
                    <Trash2 size={14} /> Удалить
                </button>
            </div>
        )}
    </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ 
    notes, 
    folders,
    activeNoteId, 
    user,
    onSelectNote, 
    onCreateNote, 
    onDeleteNote,
    onCreateFolder,
    onUpdateFolder,
    onDeleteFolder,
    onMoveNote,
    onMoveFolder,
    onOpenSettings,
    className = ""
}) => {
    const [searchTerm, setSearchTerm] = React.useState('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    
    // Updated state to track both ID and TYPE (note or folder)
    const [moveMenuTarget, setMoveMenuTarget] = useState<{ id: string, type: 'note' | 'folder' } | null>(null);
    
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    // Закрыть меню при клике в любое место (прозрачная подложка будет ниже)
    const handleCloseMenu = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setActiveMenuId(null);
    };
    
    // UI State for creating/editing
    const [creationState, setCreationState] = useState<{ parentId?: string, isCreating: boolean }>({ isCreating: false });
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
    const [tempFolderName, setTempFolderName] = useState('');
    
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-expand folder containing the active note
    useEffect(() => {
        if (activeNoteId) {
            const activeNote = notes.find(n => n.id === activeNoteId);
            if (activeNote && activeNote.folderId) {
                setExpandedFolders(prev => {
                    const next = new Set(prev);
                    next.add(activeNote.folderId!);
                    return next;
                });
            }
        }
    }, [activeNoteId, notes]);

    // --- Filtering ---
    const filteredNotes = useMemo(() => notes.filter(note => 
        note.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        note.content.toLowerCase().includes(searchTerm.toLowerCase())
    ), [notes, searchTerm]);

    // --- Helpers ---
    const toggleFolder = (id: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const startCreatingFolder = (parentId?: string) => {
        setCreationState({ isCreating: true, parentId });
        setTempFolderName('');
    };

    const submitFolderCreation = () => {
        if (tempFolderName.trim()) {
            onCreateFolder(tempFolderName.trim(), creationState.parentId);
            if (creationState.parentId) {
                setExpandedFolders(prev => new Set(prev).add(creationState.parentId!));
            }
        }
        setCreationState({ isCreating: false });
        setTempFolderName('');
    };

    const startEditingFolder = (folder: Folder) => {
        setEditingFolderId(folder.id);
        setTempFolderName(folder.name);
    };

    const submitFolderEdit = () => {
        if (editingFolderId && tempFolderName.trim()) {
            onUpdateFolder(editingFolderId, tempFolderName.trim());
        }
        setEditingFolderId(null);
        setTempFolderName('');
    };

    useEffect(() => {
        if ((creationState.isCreating || editingFolderId) && inputRef.current) {
            inputRef.current.focus();
        }
    }, [creationState.isCreating, editingFolderId]);

    // --- Drag & Drop ---
    const handleDragStartNote = (e: React.DragEvent, noteId: string) => {
        e.dataTransfer.setData('type', 'note');
        e.dataTransfer.setData('id', noteId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragStartFolder = (e: React.DragEvent, folderId: string) => {
        e.dataTransfer.setData('type', 'folder');
        e.dataTransfer.setData('id', folderId);
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation(); 
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDropOnFolder = (e: React.DragEvent, targetFolderId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const type = e.dataTransfer.getData('type');
        const id = e.dataTransfer.getData('id');

        if (type === 'note') {
            onMoveNote(id, targetFolderId);
            setExpandedFolders(prev => new Set(prev).add(targetFolderId));
        } else if (type === 'folder') {
            if (id !== targetFolderId) {
                onMoveFolder(id, targetFolderId);
                setExpandedFolders(prev => new Set(prev).add(targetFolderId));
            }
        }
    };

    const handleDropOnRoot = (e: React.DragEvent) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('type');
        const id = e.dataTransfer.getData('id');
        
        if (type === 'note') {
            onMoveNote(id, undefined);
        } else if (type === 'folder') {
            onMoveFolder(id, undefined);
        }
    };

    const isDescendant = (parentId: string, childId: string): boolean => {
        const child = folders.find(f => f.id === childId);
        if (!child || !child.parentId) return false;
        if (child.parentId === parentId) return true;
        return isDescendant(parentId, child.parentId);
    };

    // --- Recursive Folder Rendering ---
    const renderFolder = (folder: Folder, depth: number = 0) => {
        // Safe guard against too deep recursion or loops
        if (depth > 10) return null;

        const isExpanded = expandedFolders.has(folder.id);
        const childFolders = folders.filter(f => f.parentId === folder.id);
        const childNotes = filteredNotes.filter(n => n.folderId === folder.id);
        const isEditing = editingFolderId === folder.id;

        return (
            <div 
                key={folder.id} 
                className="ml-3 border-l border-white/5 pl-1"
                draggable={!isEditing}
                onDragStart={(e) => handleDragStartFolder(e, folder.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnFolder(e, folder.id)}
            >
                {/* Folder Header */}
                <div 
                    className={`relative flex items-center group px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${isEditing ? 'bg-white/10' : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200'} `}
                    onClick={() => !isEditing && toggleFolder(folder.id)}
                >
                    <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden relative z-0 pr-6">
                        {isEditing ? (
                            <input 
                                ref={inputRef}
                                value={tempFolderName}
                                onChange={(e) => setTempFolderName(e.target.value)}
                                onBlur={submitFolderEdit}
                                onKeyDown={(e) => e.key === 'Enter' && submitFolderEdit()}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-transparent border-none text-sm text-white focus:outline-none w-full font-medium"
                            />
                        ) : (
                            <>
                                <div className="shrink-0 text-zinc-600">
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </div>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {isExpanded 
                                        ? <FolderOpen size={16} className="text-blue-500 shrink-0" /> 
                                        : <FolderIcon size={16} className="text-blue-500 shrink-0" />
                                    }
                                    <span className="font-medium text-sm truncate flex-1">{folder.name}</span>
                                </div>
                                {/* Скрываем цифру, если открыто меню */}
                                <span className={`text-xs text-zinc-600 shrink-0 ml-2 transition-opacity duration-200 ${activeMenuId === folder.id ? 'opacity-0' : 'group-hover:opacity-0'}`}>
                                    {(childFolders.length + childNotes.length) || 0}
                                </span>
                            </>
                        )}
                    </div>

                    {!isEditing && (
                        <>
                            {/* 3 Dots Button */}
                            <div className={`absolute right-1 top-1/2 -translate-y-1/2 z-10 ${activeMenuId === folder.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === folder.id ? null : folder.id); }}
                                    className={`p-1 rounded-lg transition-colors ${activeMenuId === folder.id ? 'bg-zinc-700 text-white' : 'hover:bg-zinc-700/50 text-zinc-500 hover:text-white'}`}
                                >
                                    <MoreHorizontal size={16} />
                                </button>
                            </div>

                            {/* Context Menu */}
                            {activeMenuId === folder.id && (
                                <div className="absolute right-0 top-8 z-50 w-44 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl shadow-black p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 origin-top-right cursor-default" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                        onClick={() => { handleCloseMenu(); startCreatingFolder(folder.id); }}
                                        className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg w-full text-left"
                                    >
                                        <FolderIcon size={14} /> Новая подпапка
                                    </button>
                                    <button 
                                        onClick={() => { handleCloseMenu(); startEditingFolder(folder); }}
                                        className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg w-full text-left"
                                    >
                                        <Edit2 size={14} /> Переименовать
                                    </button>
                                    <button 
                                        onClick={() => { handleCloseMenu(); setMoveMenuTarget({ id: folder.id, type: 'folder' }); }}
                                        className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg w-full text-left"
                                    >
                                        <CornerDownRight size={14} /> Переместить
                                    </button>
                                    <div className="h-px bg-white/5 my-0.5" />
                                    <button 
                                        onClick={() => { handleCloseMenu(); onDeleteFolder(folder.id); }}
                                        className="flex items-center gap-2 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg w-full text-left"
                                    >
                                        <Trash2 size={14} /> Удалить
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Children */}
                {isExpanded && (
                    <div className="mt-0.5">
                        {creationState.isCreating && creationState.parentId === folder.id && (
                             <div className="ml-4 px-2 py-1 mb-1">
                                <div className="flex items-center gap-2 bg-white/5 border border-blue-500/30 rounded-lg p-1.5">
                                    <FolderIcon size={14} className="text-blue-500 shrink-0" />
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={tempFolderName}
                                        onChange={(e) => setTempFolderName(e.target.value)}
                                        onBlur={submitFolderCreation}
                                        onKeyDown={(e) => e.key === 'Enter' && submitFolderCreation()}
                                        className="bg-transparent border-none text-xs text-white focus:outline-none w-full"
                                        placeholder="Имя папки..."
                                    />
                                </div>
                            </div>
                        )}

                        {childFolders.map(child => renderFolder(child, depth + 1))}
                        {childNotes.map(note => (
                            <NoteItem 
                                key={note.id} 
                                note={note} 
                                isActive={activeNoteId === note.id}
                                onSelect={onSelectNote}
                                onDelete={onDeleteNote}
                                onOpenMoveMenu={(id) => setMoveMenuTarget({ id, type: 'note' })}
                                onDragStart={handleDragStartNote}
                                isMenuOpen={activeMenuId === note.id}
                                onToggleMenu={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === note.id ? null : note.id); }}
                            />
                        ))}
                         {childFolders.length === 0 && childNotes.length === 0 && !creationState.isCreating && (
                            <div className="ml-8 text-xs text-zinc-700 py-1 italic">Пусто</div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const rootFolders = folders.filter(f => !f.parentId);
    // Notes that are at root OR point to a non-existent folder (orphans)
    const folderIds = new Set(folders.map(f => f.id));
    const rootNotes = filteredNotes.filter(n => !n.folderId || !folderIds.has(n.folderId));

    const getValidMoveTargets = () => {
        if (!moveMenuTarget) return [];
        if (moveMenuTarget.type === 'note') return folders;
        return folders.filter(f => 
            f.id !== moveMenuTarget.id && 
            !isDescendant(moveMenuTarget.id, f.id)
        );
    };

    return (
        <div 
            className={`w-full h-full flex flex-col relative border-r border-white/5 bg-zinc-950/30 backdrop-blur-md ${className}`}
        >
            {/* Header */}
            <div className="p-4 pt-6 shrink-0">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 px-1">
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                            <Command size={18} className="text-zinc-200" />
                        </div>
                        <span className="font-bold text-lg tracking-tight">AI Notes</span>
                    </div>
                    
                    {/* Evenly spaced buttons */}
                    <div className="flex items-center gap-0.5">
                         <button 
                            onClick={() => startCreatingFolder(undefined)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all text-zinc-500 hover:text-zinc-100 hover:bg-white/5"
                            title="Новая папка"
                        >
                            <FolderIcon size={16} />
                        </button>
                        <button 
                            onClick={() => onCreateNote(undefined, 'calendar')}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all text-zinc-500 hover:text-zinc-100 hover:bg-white/5"
                            title="Новый календарь"
                        >
                            <CalendarIcon size={16} />
                        </button>
                         <button 
                            onClick={() => onCreateNote(undefined, 'image-board')}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all text-zinc-500 hover:text-zinc-100 hover:bg-white/5"
                            title="Новая доска изображений"
                        >
                            <ImageIcon size={16} />
                        </button>
                        <button 
                            onClick={() => onCreateNote(undefined, 'board')}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all text-zinc-500 hover:text-zinc-100 hover:bg-white/5"
                            title="Новая доска задач"
                        >
                            <Kanban size={16} />
                        </button>
                        <button 
                            onClick={() => onCreateNote(undefined, 'text')}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all text-zinc-500 hover:text-zinc-100 hover:bg-white/5"
                            title="Новая заметка"
                        >
                            <FilePlus size={16} />
                        </button>
                    </div>
                </div>
                
                <div className="relative group">
                    <Search className="absolute left-3 top-2.5 text-zinc-500 group-focus-within:text-accent transition-colors" size={16} />
                    <input 
                        type="text" 
                        placeholder="Поиск..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-white/5 text-sm text-zinc-200 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-accent/50 focus:bg-zinc-900 transition-all placeholder-zinc-600"
                    />
                </div>
            </div>

            {/* List */}
            <div 
                className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 no-scrollbar"
                onDragOver={handleDragOver}
                onDrop={handleDropOnRoot}
            >
                {/* Root Folder Creation Input */}
                {creationState.isCreating && !creationState.parentId && (
                    <div className="px-2 py-1 mb-2 animate-fade-in">
                        <div className="flex items-center gap-2 bg-white/10 border border-blue-500/50 rounded-lg p-2">
                            <FolderIcon size={16} className="text-blue-500 shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={tempFolderName}
                                onChange={(e) => setTempFolderName(e.target.value)}
                                onBlur={submitFolderCreation}
                                onKeyDown={(e) => e.key === 'Enter' && submitFolderCreation()}
                                className="bg-transparent border-none text-sm text-white focus:outline-none w-full min-w-0 placeholder-zinc-500 font-medium"
                                placeholder="Название папки..."
                            />
                        </div>
                    </div>
                )}

                {/* Recursive Folder Tree */}
                {rootFolders.map(folder => renderFolder(folder))}

                {/* Divider if needed */}
                {rootFolders.length > 0 && rootNotes.length > 0 && (
                    <div className="h-px bg-white/5 my-3 mx-2"></div>
                )}

                {/* Root Notes */}
                {rootNotes.map(note => (
                    <NoteItem 
                        key={note.id} 
                        note={note} 
                        isActive={activeNoteId === note.id}
                        onSelect={onSelectNote}
                        onDelete={onDeleteNote}
                        onOpenMoveMenu={(id) => setMoveMenuTarget({ id, type: 'note' })}
                        onDragStart={handleDragStartNote}
                    />
                ))}

                {filteredNotes.length === 0 && folders.length === 0 && !creationState.isCreating && (
                    <div className="flex flex-col items-center justify-center h-40 text-zinc-600 p-8 text-sm text-center">
                        <FileJson size={32} className="mb-3 opacity-50" />
                        <p>Нет элементов</p>
                    </div>
                )}
            </div>

            {/* Bottom Actions - Now simplified to Settings/User */}
            <div className="p-4 border-t border-white/5 shrink-0">
                <button 
                    onClick={onOpenSettings}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group"
                >
                    {user && user.photoURL ? (
                        <img src={user.photoURL} className="w-8 h-8 rounded-full bg-zinc-800 object-cover" alt="User" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white">
                            <User size={16} />
                        </div>
                    )}
                    
                    <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-zinc-300 group-hover:text-white truncate">
                            {user ? user.displayName : 'Гость'}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">
                            {user ? 'Синхронизация...' : 'Настройки и вход'}
                        </div>
                    </div>

                    <Settings size={18} className="text-zinc-500 group-hover:text-white" />
                </button>
            </div>

            {/* Move Context Menu Modal */}
            {moveMenuTarget && (
                <div 
                    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setMoveMenuTarget(null)}
                >
                    <div 
                        className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-xs overflow-hidden animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-3 border-b border-white/5 flex justify-between items-center">
                            <span className="font-bold text-sm">Переместить {moveMenuTarget.type === 'note' ? 'заметку' : 'папку'} в...</span>
                            <button onClick={() => setMoveMenuTarget(null)}><MoreHorizontal size={16} /></button>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                            <button 
                                onClick={() => { 
                                    if (moveMenuTarget.type === 'note') onMoveNote(moveMenuTarget.id, undefined);
                                    else onMoveFolder(moveMenuTarget.id, undefined);
                                    setMoveMenuTarget(null); 
                                }}
                                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/10 text-left text-sm transition-colors"
                            >
                                <FileText size={16} className="text-zinc-400" />
                                <span>Общий список</span>
                            </button>
                            
                            {getValidMoveTargets().map(f => (
                                <button 
                                    key={f.id}
                                    onClick={() => { 
                                        if (moveMenuTarget.type === 'note') onMoveNote(moveMenuTarget.id, f.id);
                                        else onMoveFolder(moveMenuTarget.id, f.id);
                                        setMoveMenuTarget(null); 
                                    }}
                                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/10 text-left text-sm transition-colors"
                                >
                                    <FolderIcon size={16} className="text-blue-500" />
                                    <span className="truncate">{f.name}</span>
                                    {f.parentId && <span className="text-[10px] text-zinc-600 ml-auto">подпапка</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {activeMenuId && (
                <div className="fixed inset-0 z-40 bg-transparent" onClick={handleCloseMenu} />
            )}
        </div>
    );
};
