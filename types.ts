
export interface Note {
    id: string;
    title: string;
    content: string;
    updatedAt: number;
    folderId?: string;
    type?: 'text' | 'board' | 'calendar' | 'image-board';
}

export interface Folder {
    id: string;
    name: string;
    createdAt: number;
    parentId?: string;
}

export enum AIActionType {
    CONTINUE = 'CONTINUE',
    IMPROVE = 'IMPROVE',
    SUMMARIZE = 'SUMMARIZE',
    CUSTOM = 'CUSTOM',
    FIX_GRAMMAR = 'FIX_GRAMMAR'
}

export interface AIRequest {
    type: AIActionType;
    text: string;
    prompt?: string;
    contextBefore?: string;
}

// Kanban Types
export interface KanbanTask {
    id: string;
    text: string;
    isCompleted?: boolean;
}

export interface KanbanColumn {
    id: string;
    title: string;
    tasks: KanbanTask[];
    color: string;
}

// Calendar Types
export interface CalendarEvent {
    id: string;
    text: string;
    isCompleted: boolean;
}

export interface CalendarData {
    [dateIso: string]: CalendarEvent[];
}

// Image Board Types
export interface ImageItem {
    id: string;
    url: string; // Base64 data URI
    caption?: string;
    createdAt: number;
}

// --- New AI Provider Logic ---

export interface AIProvider {
    id: string;
    name: string;
    type: 'gemini' | 'openai-compatible';
    apiKeys: string[];
    baseUrl?: string; // Only for openai-compatible
    models: string[]; // List of available models for this provider
    defaultModel: string; // The selected model to use
}

export interface AppSettings {
    // We now store a list of providers and the ID of the active one
    providers: AIProvider[];
    activeProviderId: string;
    theme: 'dark' | 'light';
    
    // Deprecated fields kept for type safety during migration (will be removed in logic)
    aiProvider?: any;
    apiKeys?: any;
    openaiBaseUrl?: any;
    customModel?: any;
}

export interface UserProfile {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
}