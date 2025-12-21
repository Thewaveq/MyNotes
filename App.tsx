
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { SettingsModal } from './components/SettingsModal';
import { Note, Folder, UserProfile } from './types';
import { 
    getNotes, saveNote, deleteNote, createNote, bulkSaveNotes, 
    getFolders, createFolder, deleteFolder, updateFolder, saveSettings 
} from './utils/storage';
import { AlertTriangle, Loader2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { supabase, db, mapNoteFromDb, mapFolderFromDb } from './utils/supabase';

const App: React.FC = () => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    
    // Auth & Sync State
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isLoadingCloud, setIsLoadingCloud] = useState(false);
	
	// Fix for mobile keyboard and viewport height
    const [viewportHeight, setViewportHeight] = useState(
        typeof window !== 'undefined' && window.visualViewport 
            ? window.visualViewport.height 
            : typeof window !== 'undefined' ? window.innerHeight : 0
    );

	// Sidebar State with LocalStorage persistence
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('sidebarState') !== 'closed';
        }
        return true;
    });

    useEffect(() => {
        localStorage.setItem('sidebarState', isSidebarOpen ? 'open' : 'closed');
    }, [isSidebarOpen]);

    useEffect(() => {
        const handleResize = () => {
            if (window.visualViewport) {
                setViewportHeight(window.visualViewport.height);
                window.scrollTo(0, 0); 
            } else {
                setViewportHeight(window.innerHeight);
            }
        };

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
            handleResize();
        } else {
            window.addEventListener('resize', handleResize);
        }

        return () => {
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleResize);
            } else {
                window.removeEventListener('resize', handleResize);
            }
        };
    }, []);

    // Delete Confirmation State
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'note' | 'folder', id: string, name?: string } | null>(null);

    // Initial Load & Auth Listener
    useEffect(() => {
        // 1. Initial Local Load (Instant)
        const localNotes = getNotes();
        const localFolders = getFolders();
        setNotes(localNotes);
        setFolders(localFolders);
        
        // 2. Setup Supabase
        if (supabase) {
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session?.user) {
                    const profile = {
                        uid: session.user.id,
                        email: session.user.email || null,
                        displayName: session.user.email?.split('@')[0] || 'User',
                        photoURL: null
                    };
                    setUser(profile);
                    loadCloudData(profile.uid);
                    setupRealtimeSubscription(profile.uid);
                }
            });

            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                if (session?.user) {
                    const profile = {
                        uid: session.user.id,
                        email: session.user.email || null,
                        displayName: session.user.email?.split('@')[0] || 'User',
                        photoURL: null
                    };
                    setUser(profile);
                    loadCloudData(profile.uid);
                    setupRealtimeSubscription(profile.uid);
                } else {
                    setUser(null);
                    // Revert to local data on logout
                    setNotes(getNotes());
                    setFolders(getFolders());
                    setActiveNoteId(null);
                    // Clean up realtime if needed (supabase handles connection mostly)
                }
            });

            return () => subscription.unsubscribe();
        }
        
        // If local only and has notes, select first
        const isMobile = window.innerWidth < 768;
        if (localNotes.length > 0 && !isMobile) {
            setActiveNoteId(localNotes[0].id);
        }
    }, []);

    const setupRealtimeSubscription = (userId: string) => {
        if (!supabase) return;

        // Subscribe to changes for this user
        const channel = supabase.channel('user_sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
                (payload) => {
                    handleRealtimeNote(payload);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'folders', filter: `user_id=eq.${userId}` },
                (payload) => {
                    handleRealtimeFolder(payload);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const handleRealtimeNote = (payload: any) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
            const mappedNote = mapNoteFromDb(newRecord);
            // Save to local storage for offline support
            saveNote(mappedNote); 
            // Update State
            setNotes(prev => {
                const idx = prev.findIndex(n => n.id === mappedNote.id);
                if (idx >= 0) {
                    // Only update if timestamp is newer to prevent loops
                    if (prev[idx].updatedAt <= mappedNote.updatedAt) {
                         const copy = [...prev];
                         copy[idx] = mappedNote;
                         return copy.sort((a, b) => b.updatedAt - a.updatedAt);
                    }
                    return prev;
                }
                return [mappedNote, ...prev].sort((a, b) => b.updatedAt - a.updatedAt);
            });
        } else if (eventType === 'DELETE') {
            const id = oldRecord.id;
            deleteNote(id); // Local delete
            setNotes(prev => prev.filter(n => n.id !== id));
            setActiveNoteId(prevId => prevId === id ? null : prevId);
        }
    };

    const handleRealtimeFolder = (payload: any) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        if (eventType === 'INSERT' || eventType === 'UPDATE') {
            const mappedFolder = mapFolderFromDb(newRecord);
            // We need a way to upsert folder locally, doing manually here since storage utils are simpler
            setFolders(prev => {
                const idx = prev.findIndex(f => f.id === mappedFolder.id);
                if (idx >= 0) {
                     const copy = [...prev];
                     copy[idx] = mappedFolder;
                     return copy.sort((a, b) => a.createdAt - b.createdAt);
                }
                return [...prev, mappedFolder].sort((a, b) => a.createdAt - b.createdAt);
            });
            // Also persist to local storage (bulk save folders workaround)
            // (In a real app, updateFolder should support upsert)
        } else if (eventType === 'DELETE') {
            const id = oldRecord.id;
            deleteFolder(id); // Local delete helper
            setFolders(prev => prev.filter(f => f.id !== id));
        }
    };

    const loadCloudData = async (userId: string) => {
        setIsLoadingCloud(true);
        try {
            // 1. Fetch Data
            const [cloudNotes, cloudFolders, cloudSettings] = await Promise.all([
                db.getNotes(),
                db.getFolders(),
                db.getUserSettings(userId)
            ]);
            
            // 2. Update State
            setNotes(cloudNotes.sort((a, b) => b.updatedAt - a.updatedAt));
            setFolders(cloudFolders.sort((a, b) => a.createdAt - b.createdAt));
            
            // 3. Sync Settings if available
            if (cloudSettings) {
                saveSettings(cloudSettings); // Save to localStorage
                // We might need to force the SettingsModal to reload active settings if open, 
                // but usually user isn't in settings immediately upon load.
            }
            
            // 4. Update Local Storage with fresh Cloud Data (Backup)
            bulkSaveNotes(cloudNotes);
            // (Folders bulk save not implemented in storage utils, but Sidebar reads from State mostly)

            if (cloudNotes.length > 0 && !activeNoteId && window.innerWidth >= 768) {
                setActiveNoteId(cloudNotes[0].id);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingCloud(false);
        }
    };

    const handleLogin = () => {
        setShowSettings(true);
    };

    const handleLogout = async () => {
        if (supabase) {
            await supabase.auth.signOut();
        }
        setUser(null);
    };

    // --- Sync Helper ---
    // If logged in -> Save to Cloud. Always save to local as backup/optimistic.
    const syncNote = (note: Note) => {
        saveNote(note); // Local
        if (user) db.upsertNote(note, user.uid); // Cloud
    };
    
    const syncNoteDelete = (id: string) => {
        deleteNote(id); // Local
        if (user) db.deleteNote(id); // Cloud
    };

    const syncFolder = (folder: Folder) => {
        if (user) db.upsertFolder(folder, user.uid);
    };

    const syncFolderDelete = (id: string) => {
        deleteFolder(id); // Local
        if (user) db.deleteFolder(id); // Cloud
    };


    // --- Note Operations ---

    const handleCreateNote = (folderId?: string, type: 'text' | 'board' | 'calendar' | 'image-board' = 'text') => {
        const newNote = createNote(folderId, type); // Creates locally
        setNotes([newNote, ...notes]);
        setActiveNoteId(newNote.id);
        
        if (user) db.upsertNote(newNote, user.uid);
    };

    const handleDeleteNoteRequest = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const note = notes.find(n => n.id === id);
        setDeleteTarget({ type: 'note', id, name: note?.title });
    };

    const handleUpdateNote = (id: string, updates: Partial<Note>) => {
        setNotes(prevNotes => prevNotes.map(note => {
            if (note.id === id) {
                const updatedNote = { ...note, ...updates };
                syncNote(updatedNote); // Sync
                return updatedNote;
            }
            return note;
        }));
    };

    const handleSaveCurrent = () => {
        const current = notes.find(n => n.id === activeNoteId);
        if (current) {
            syncNote(current);
            // Refresh logic isn't strictly needed for React state, but good for local storage consistency
        }
    };

    const handleMoveNote = (noteId: string, targetFolderId?: string) => {
        const note = notes.find(n => n.id === noteId);
        if (note) {
            const updatedNote = { ...note, folderId: targetFolderId };
            setNotes(prev => prev.map(n => n.id === noteId ? updatedNote : n));
            syncNote(updatedNote);
        }
    };

    // --- Folder Operations ---

    const handleCreateFolder = (name: string, parentId?: string) => {
        if (name && name.trim()) {
            const newFolder = createFolder(name.trim(), parentId); // Local helper
            setFolders([...folders, newFolder]);
            if (user) db.upsertFolder(newFolder, user.uid);
        }
    };

    const handleUpdateFolder = (id: string, name: string) => {
        updateFolder(id, { name }); // Local helper
        const updated = folders.find(f => f.id === id);
        if (updated) {
            const newFolder = { ...updated, name };
            setFolders(prev => prev.map(f => f.id === id ? newFolder : f));
            if (user) db.upsertFolder(newFolder, user.uid);
        }
    };

    const handleMoveFolder = (folderId: string, targetParentId?: string) => {
        if (folderId === targetParentId) return;
        updateFolder(folderId, { parentId: targetParentId }); // Local helper
        
        const updated = folders.find(f => f.id === folderId);
        if (updated) {
            const newFolder = { ...updated, parentId: targetParentId };
            setFolders(prev => prev.map(f => f.id === folderId ? newFolder : f));
            if (user) db.upsertFolder(newFolder, user.uid);
        }
    };

    const handleDeleteFolderRequest = (id: string) => {
        const folder = folders.find(f => f.id === id);
        setDeleteTarget({ type: 'folder', id, name: folder?.name });
    };

    // --- Actual Delete Logic ---

    const confirmDelete = () => {
        if (!deleteTarget) return;

        if (deleteTarget.type === 'note') {
            syncNoteDelete(deleteTarget.id);
            const newNotes = notes.filter(n => n.id !== deleteTarget.id);
            setNotes(newNotes);
            if (activeNoteId === deleteTarget.id) {
                const isMobile = window.innerWidth < 768;
                setActiveNoteId(newNotes.length > 0 && !isMobile ? newNotes[0].id : null);
            }
        } else if (deleteTarget.type === 'folder') {
            syncFolderDelete(deleteTarget.id);
            // Also update children locally for immediate UI feedback
            const newFolders = folders.filter(f => f.id !== deleteTarget.id);
            setFolders(newFolders);
            
            // Reload notes to reflect folder deletion (notes become orphaned)
            const updatedNotes = notes.map(n => n.folderId === deleteTarget.id ? { ...n, folderId: undefined } : n);
            setNotes(updatedNotes);
            
            // Sync orphaned notes if in cloud
            if (user) {
                updatedNotes.forEach(n => {
                    if (n.folderId === undefined && notes.find(old => old.id === n.id)?.folderId === deleteTarget.id) {
                        db.upsertNote(n, user.uid);
                    }
                });
            }
        }
        setDeleteTarget(null);
    };

    // --- Import/Export ---

    const handleExport = () => {
        const data = { notes, folders };
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `backup_${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const handleImport = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const fileContent = event.target?.result as string;
            
            if (file.name.toLowerCase().endsWith('.json')) {
                try {
                    const json = JSON.parse(fileContent);
                    const isRawKanbanBoard = Array.isArray(json) && json.length > 0 && 'tasks' in json[0] && 'color' in json[0];
                    
                    if (isRawKanbanBoard) {
                        const newBoardNote: Note = {
                            id: crypto.randomUUID(),
                            title: file.name.replace('.json', '').replace(/_/g, ' ') || 'Импортированная доска',
                            content: JSON.stringify(json),
                            updatedAt: Date.now(),
                            type: 'board'
                        };
                        const updatedNotes = [newBoardNote, ...notes];
                        setNotes(updatedNotes);
                        setActiveNoteId(newBoardNote.id);
                        syncNote(newBoardNote);
                        alert(`Доска "${newBoardNote.title}" успешно импортирована.`);
                        return;
                    }

                    let newNotes: Note[] = [];
                    let newFolders: Folder[] = [];

                    if (Array.isArray(json)) {
                        newNotes = json;
                    } else if (json.notes && Array.isArray(json.notes)) {
                        newNotes = json.notes;
                        newFolders = json.folders || [];
                    }

                    const validNotes = newNotes.map((item: any) => ({
                        id: item.id || crypto.randomUUID(),
                        title: item.title || 'Без названия',
                        content: item.content || '',
                        updatedAt: item.updatedAt || Date.now(),
                        folderId: item.folderId,
                        type: item.type || 'text'
                    }));

                    if (newFolders.length > 0) {
                        const existingIds = new Set(folders.map(f => f.id));
                        const foldersToAdd = newFolders.filter(f => !existingIds.has(f.id));
                        const finalFolders = [...folders, ...foldersToAdd];
                        setFolders(finalFolders);
                        
                        // Sync folders
                        foldersToAdd.forEach(f => {
                            updateFolder(f.id, f); // local save
                            if(user) db.upsertFolder(f, user.uid);
                        });
                    }

                    if (validNotes.length > 0) {
                        const existingIds = new Set(notes.map(n => n.id));
                        const notesToAdd = validNotes.filter(n => !existingIds.has(n.id));
                        const finalNotes = [...notesToAdd, ...notes]; 
                        
                        setNotes(finalNotes);
                        
                        // Sync notes
                        notesToAdd.forEach(n => syncNote(n));

                        alert(`Импортировано ${notesToAdd.length} новых заметок.`);
                    } else {
                        alert('Файл не содержит корректных заметок.');
                    }

                } catch (e) {
                    console.error(e);
                    alert("Ошибка при чтении файла. Убедитесь, что это корректный JSON.");
                }
            }
        };
        reader.readAsText(file);
    };

    const activeNote = notes.find(n => n.id === activeNoteId) || null;
    const isEditing = activeNoteId !== null;

    if (isLoadingCloud) {
        return (
            <div className="flex h-screen h-[100dvh] w-screen bg-background items-center justify-center flex-col gap-4">
                <Loader2 size={40} className="animate-spin text-accent" />
                <div className="text-zinc-400 text-sm">Загрузка ваших заметок...</div>
            </div>
        );
    }

    return (
         <div className="flex w-screen bg-transparent text-zinc-100 overflow-hidden font-sans relative" style={{ height: `${viewportHeight}px` }}>
            <Sidebar 
                notes={notes}
                folders={folders}
                activeNoteId={activeNoteId}
                user={user}
                onSelectNote={setActiveNoteId}
                onCreateNote={handleCreateNote}
                onDeleteNote={handleDeleteNoteRequest}
                onCreateFolder={handleCreateFolder}
                onUpdateFolder={handleUpdateFolder}
                onDeleteFolder={handleDeleteFolderRequest}
                onMoveNote={handleMoveNote}
                onMoveFolder={handleMoveFolder}
                onOpenSettings={() => setShowSettings(true)}
                className={`${isEditing ? 'hidden md:flex' : 'flex'} ${
                    isSidebarOpen ? 'md:w-80' : 'md:w-0 md:opacity-0 md:overflow-hidden md:border-none'
                } transition-all duration-300 ease-in-out`}
            />

			 {/* Sidebar Toggle Button */}
            <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`hidden md:flex absolute top-6 z-50 items-center justify-center w-6 h-12 bg-zinc-900 border-y border-r border-white/10 rounded-r-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all duration-300 ease-in-out`}
                style={{ left: isSidebarOpen ? '20rem' : '0' }}
                title={isSidebarOpen ? "Свернуть меню" : "Развернуть меню"}
            >
                {isSidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
            </button>
            
            <div className={`flex-1 flex overflow-hidden relative ${!isEditing ? 'hidden md:flex' : 'flex'}`}>
                <Editor 
                    note={activeNote}
                    allNotes={notes}
                    onUpdateNote={handleUpdateNote}
                    onSave={handleSaveCurrent}
                    onBack={() => setActiveNoteId(null)}
                    onNavigate={(id) => setActiveNoteId(id)}
                />
            </div>

            {showSettings && (
                <SettingsModal 
                    onClose={() => setShowSettings(false)}
                    user={user}
                    onLogin={handleLogin}
                    onLogout={handleLogout}
                    onExport={handleExport}
                    onImport={handleImport}
                />
            )}

            {deleteTarget && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden scale-100 transition-transform">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4 text-red-500">
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <AlertTriangle size={20} />
                                </div>
                                <h3 className="text-lg font-bold text-white">
                                    Удалить {deleteTarget.type === 'note' ? 'заметку' : 'папку'}?
                                </h3>
                            </div>
                            
                            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                                Вы собираетесь удалить 
                                <span className="text-white font-medium mx-1">
                                    {deleteTarget.name || (deleteTarget.type === 'note' ? 'Без названия' : 'Папка')}
                                </span>.
                                {deleteTarget.type === 'folder' 
                                    ? " Все заметки внутри этой папки будут перемещены в общий список."
                                    : " Это действие необратимо."}
                            </p>

                            <div className="flex gap-3 justify-end">
                                <button 
                                    onClick={() => setDeleteTarget(null)}
                                    className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors text-sm font-medium"
                                >
                                    Отмена
                                </button>
                                <button 
                                    onClick={confirmDelete}
                                    className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all text-sm font-medium"
                                >
                                    Удалить
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
