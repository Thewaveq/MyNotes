
import { createClient } from '@supabase/supabase-js';
import { Note, Folder, AppSettings } from '../types';

// --- CONFIGURATION ---
// Hardcoded fallbacks so the app works immediately.
// Ideally, set these in Vercel Environment Variables as VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
const PROJECT_URL = 'https://ftcfxkgcowusxgxrskle.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0Y2Z4a2djb3d1c3hneHJza2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NjE1MDUsImV4cCI6MjA4MTQzNzUwNX0.dhvNnXM8ZQpR_M81oJ7vDaC7JlrudtjkprS5177lWH8';

// Helper to safely get env vars
const getEnv = (key: string) => {
    // Check for process.env (Node/Webpack/Vercel)
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key] || process.env[`VITE_${key}`] || process.env[`REACT_APP_${key}`];
    }
    return undefined;
};

const supabaseUrl = getEnv('SUPABASE_URL') || PROJECT_URL;
const supabaseKey = getEnv('SUPABASE_ANON_KEY') || ANON_KEY;

// Initialize Supabase
export const supabase = (supabaseUrl && supabaseKey) 
    ? createClient(supabaseUrl, supabaseKey) 
    : null;

export const isSupabaseConfigured = () => !!supabase;

// --- Database Helpers ---

// Mapper: App (camelCase) -> DB (snake_case)
const mapNoteToDb = (note: Note, userId: string) => ({
    id: note.id,
    user_id: userId,
    title: note.title,
    content: note.content,
    folder_id: note.folderId || null,
    type: note.type || 'text',
    updated_at: note.updatedAt
});

// Mapper: DB (snake_case) -> App (camelCase)
export const mapNoteFromDb = (dbNote: any): Note => ({
    id: dbNote.id,
    title: dbNote.title || '',
    content: dbNote.content || '',
    folderId: dbNote.folder_id || undefined,
    type: dbNote.type || 'text',
    updatedAt: Number(dbNote.updated_at) || Date.now()
});

const mapFolderToDb = (folder: Folder, userId: string) => ({
    id: folder.id,
    user_id: userId,
    name: folder.name,
    parent_id: folder.parentId || null,
    created_at: folder.createdAt
});

export const mapFolderFromDb = (dbFolder: any): Folder => ({
    id: dbFolder.id,
    name: dbFolder.name,
    parentId: dbFolder.parent_id || undefined,
    createdAt: Number(dbFolder.created_at) || Date.now()
});

// API Object
export const db = {
    // --- NOTES ---
    getNotes: async () => {
        if (!supabase) return [];
        const { data, error } = await supabase.from('notes').select('*');
        if (error) { console.error('Error fetching notes:', error); return []; }
        return data.map(mapNoteFromDb);
    },

    upsertNote: async (note: Note, userId: string) => {
        if (!supabase) return;
        const { error } = await supabase.from('notes').upsert(mapNoteToDb(note, userId));
        if (error) console.error('Error saving note:', error);
    },

    deleteNote: async (id: string) => {
        if (!supabase) return;
        const { error } = await supabase.from('notes').delete().eq('id', id);
        if (error) console.error('Error deleting note:', error);
    },

    // --- FOLDERS ---
    getFolders: async () => {
        if (!supabase) return [];
        const { data, error } = await supabase.from('folders').select('*');
        if (error) { console.error('Error fetching folders:', error); return []; }
        return data.map(mapFolderFromDb);
    },

    upsertFolder: async (folder: Folder, userId: string) => {
        if (!supabase) return;
        const { error } = await supabase.from('folders').upsert(mapFolderToDb(folder, userId));
        if (error) console.error('Error saving folder:', error);
    },

    deleteFolder: async (id: string) => {
        if (!supabase) return;
        const { error } = await supabase.from('folders').delete().eq('id', id);
        if (error) console.error('Error deleting folder:', error);
    },

    // --- SETTINGS (SYNC) ---
    getUserSettings: async (userId: string): Promise<AppSettings | null> => {
        if (!supabase) return null;
        const { data, error } = await supabase
            .from('user_settings')
            .select('settings')
            .eq('user_id', userId)
            .single();
        
        if (error) { 
             // It's okay if settings don't exist yet
             return null; 
        }
        return data?.settings as AppSettings;
    },

    saveUserSettings: async (settings: AppSettings, userId: string) => {
        if (!supabase) return;
        // We use a simplified table structure: user_id (PK), settings (JSONB)
        const { error } = await supabase
            .from('user_settings')
            .upsert({ user_id: userId, settings: settings });
        
        if (error) console.error('Error syncing settings:', error);
    }
};
