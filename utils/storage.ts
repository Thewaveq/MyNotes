import { Note, Folder, KanbanColumn, AppSettings, AIProvider } from '../types';

const NOTES_KEY = 'ai-editor-notes';
const FOLDERS_KEY = 'ai-editor-folders';
const SETTINGS_KEY = 'ai-editor-settings';

const generateId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// --- Settings & Migration ---

const DEFAULT_GEMINI_PROVIDER: AIProvider = {
    id: 'gemini-default',
    name: 'Google Gemini',
    type: 'gemini',
    apiKeys: [],
    baseUrl: '',
    models: ['gemini-2.5-flash', 'gemini-1.5-pro'],
    defaultModel: 'gemini-2.5-flash'
};

export const getSettings = (): AppSettings => {
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            
            // --- MIGRATION LOGIC ---
            // If new structure 'providers' is missing, migrate old data
            if (!parsed.providers || !Array.isArray(parsed.providers)) {
                const providers: AIProvider[] = [DEFAULT_GEMINI_PROVIDER];
                
                // Migrate legacy Gemini keys
                if (parsed.aiProvider === 'gemini' || !parsed.aiProvider) {
                    // Try to find keys in old locations
                    let legacyKeys: string[] = [];
                    if (Array.isArray(parsed.apiKeys)) legacyKeys = parsed.apiKeys;
                    else if (typeof parsed.apiKey === 'string') legacyKeys = [parsed.apiKey];
                    
                    providers[0].apiKeys = legacyKeys;
                }

                // Migrate legacy OpenAI settings if they existed
                if (parsed.aiProvider === 'openai') {
                    let legacyKeys: string[] = [];
                    if (Array.isArray(parsed.apiKeys)) legacyKeys = parsed.apiKeys;
                    else if (typeof parsed.apiKey === 'string') legacyKeys = [parsed.apiKey];

                    providers.push({
                        id: 'openai-legacy',
                        name: 'OpenAI (Legacy)',
                        type: 'openai-compatible',
                        apiKeys: legacyKeys,
                        baseUrl: parsed.openaiBaseUrl || 'https://api.openai.com/v1',
                        models: parsed.customModel ? [parsed.customModel] : ['gpt-4o-mini'],
                        defaultModel: parsed.customModel || 'gpt-4o-mini'
                    });
                }

                // Determine active provider ID
                const activeId = parsed.aiProvider === 'openai' ? 'openai-legacy' : 'gemini-default';

                const newSettings: AppSettings = {
                    providers,
                    activeProviderId: activeId,
                    theme: parsed.theme || 'dark'
                };
                
                // Save migrated settings immediately so we don't re-run this
                saveSettings(newSettings);
                return newSettings;
            }

            return parsed;
        }
    } catch (e) {}
    
    // Completely fresh start
    return {
        providers: [DEFAULT_GEMINI_PROVIDER],
        activeProviderId: 'gemini-default',
        theme: 'dark'
    };
};

export const saveSettings = (settings: AppSettings): void => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

// --- Notes ---

export const getNotes = (): Note[] => {
    try {
        const stored = localStorage.getItem(NOTES_KEY);
        if (!stored) return [];
        const notes = JSON.parse(stored);
        if (!Array.isArray(notes)) return [];
        return notes.sort((a: Note, b: Note) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (e) {
        console.error("Failed to load notes", e);
        return [];
    }
};

export const saveNote = (note: Note): void => {
    try {
        const notes = getNotes();
        const existingIndex = notes.findIndex(n => n.id === note.id);
        
        if (existingIndex >= 0) {
            notes[existingIndex] = note;
        } else {
            notes.push(note);
        }
        
        localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch (e) {
        console.error("Failed to save note", e);
    }
};

export const bulkSaveNotes = (newNotes: Note[]): void => {
    try {
        localStorage.setItem(NOTES_KEY, JSON.stringify(newNotes));
    } catch (e) {
        console.error("Failed to bulk save notes", e);
    }
};

export const deleteNote = (id: string): void => {
    const notes = getNotes().filter(n => n.id !== id);
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
};

export const createNote = (folderId?: string, type: 'text' | 'board' | 'calendar' | 'image-board' = 'text'): Note => {
    let initialContent = '';
    let initialTitle = 'Новая заметка';

    if (type === 'board') {
        initialTitle = 'Новая доска';
        const defaultColumns: KanbanColumn[] = [
            { id: 'todo', title: 'Нужно сделать', color: 'bg-red-500/10 border-red-500/20 text-red-200', tasks: [] },
            { id: 'progress', title: 'В работе', color: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-200', tasks: [] },
            { id: 'done', title: 'Готово', color: 'bg-green-500/10 border-green-500/20 text-green-200', tasks: [] }
        ];
        initialContent = JSON.stringify(defaultColumns);
    } else if (type === 'calendar') {
        initialTitle = 'Календарь';
        initialContent = '{}';
    } else if (type === 'image-board') {
        initialTitle = 'Референсы';
        initialContent = '[]';
    }

    const newNote: Note = {
        id: generateId(),
        title: initialTitle,
        content: initialContent,
        updatedAt: Date.now(),
        folderId: folderId,
        type: type
    };
    saveNote(newNote);
    return newNote;
};

// --- Folders ---

export const getFolders = (): Folder[] => {
    try {
        const stored = localStorage.getItem(FOLDERS_KEY);
        if (!stored) return [];
        const folders = JSON.parse(stored);
        if (!Array.isArray(folders)) return [];
        return folders.sort((a: Folder, b: Folder) => (a.createdAt || 0) - (b.createdAt || 0));
    } catch (e) {
        return [];
    }
};

export const createFolder = (name: string, parentId?: string): Folder => {
    const folders = getFolders();
    const newFolder: Folder = {
        id: generateId(),
        name,
        createdAt: Date.now(),
        parentId
    };
    folders.push(newFolder);
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    return newFolder;
};

export const updateFolder = (id: string, updates: Partial<Folder>): void => {
    const folders = getFolders().map(f => f.id === id ? { ...f, ...updates } : f);
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
};

export const deleteFolder = (id: string): void => {
    let folders = getFolders().filter(f => f.id !== id);
    folders = folders.map(f => {
        if (f.parentId === id) {
            return { ...f, parentId: undefined };
        }
        return f;
    });
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    const notes = getNotes().map(note => {
        if (note.folderId === id) {
            return { ...note, folderId: undefined };
        }
        return note;
    });
    bulkSaveNotes(notes);
};