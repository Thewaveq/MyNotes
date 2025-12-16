import React, { useState, useEffect, useRef } from 'react';
import { X, Key, User, Upload, Download, Smartphone, Layout, LogOut, RefreshCcw, Server, Box, Plus, Trash2, Check, ChevronLeft, Save } from 'lucide-react';
import { AppSettings, UserProfile, AIProvider } from '../types';
import { getSettings, saveSettings } from '../utils/storage';
import { supabase, isSupabaseConfigured } from '../utils/supabase';

interface SettingsModalProps {
    onClose: () => void;
    user: UserProfile | null;
    onLogin: () => void; 
    onLogout: () => void;
    onExport: () => void;
    onImport: (file: File) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
    onClose, user, onLogin, onLogout, onExport, onImport 
}) => {
    const [settings, setSettings] = useState<AppSettings>(getSettings());
    const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'account'>('account');
    
    // --- AI Provider Management State ---
    const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
    const [tempProvider, setTempProvider] = useState<AIProvider | null>(null);
    const [keysText, setKeysText] = useState(''); 
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    
    // Supabase Email Login State
    const [email, setEmail] = useState('');
    const [loadingAuth, setLoadingAuth] = useState(false);
    const [authMessage, setAuthMessage] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize editing when a provider is selected
    useEffect(() => {
        if (editingProviderId && settings.providers) {
            const provider = settings.providers.find(p => p.id === editingProviderId);
            if (provider) {
                setTempProvider({ ...provider });
                setKeysText(provider.apiKeys.join('\n'));
            }
        }
    }, [editingProviderId, settings.providers]);

    const handleSaveGlobal = () => {
        let updatedProviders = [...settings.providers];
        if (tempProvider && editingProviderId) {
            const keys = keysText.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 0);
            updatedProviders = updatedProviders.map(p => 
                p.id === editingProviderId 
                ? { ...tempProvider, apiKeys: keys } 
                : p
            );
        }

        const newSettings = {
            ...settings,
            providers: updatedProviders
        };

        saveSettings(newSettings);
        window.location.reload(); 
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onImport(e.target.files[0]);
            onClose();
        }
    };

    // --- Provider Actions ---
    const addNewProvider = () => {
        const newId = crypto.randomUUID();
        const newProvider: AIProvider = {
            id: newId,
            name: 'Новый провайдер',
            type: 'openai-compatible',
            baseUrl: 'https://api.openai.com/v1',
            apiKeys: [],
            models: ['gpt-4o-mini', 'gpt-4o'],
            defaultModel: 'gpt-4o-mini'
        };
        const newProviders = [...settings.providers, newProvider];
        setSettings({ ...settings, providers: newProviders });
        setEditingProviderId(newId); 
    };

    const deleteProvider = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (settings.providers.length <= 1) {
            alert('Нельзя удалить последнего провайдера.');
            return;
        }
        if (confirm('Удалить этого провайдера?')) {
            const newProviders = settings.providers.filter(p => p.id !== id);
            let newActiveId = settings.activeProviderId;
            if (id === settings.activeProviderId) {
                newActiveId = newProviders[0].id;
            }
            setSettings({ 
                ...settings, 
                providers: newProviders,
                activeProviderId: newActiveId
            });
            if (editingProviderId === id) {
                setEditingProviderId(null);
                setTempProvider(null);
            }
        }
    };

    const syncCurrentEdits = () => {
        if (tempProvider && editingProviderId) {
            const keys = keysText.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 0);
            const updatedProviders = settings.providers.map(p => 
                p.id === editingProviderId 
                ? { ...tempProvider, apiKeys: keys } 
                : p
            );
            setSettings({ ...settings, providers: updatedProviders });
        }
    };

    const handleBackToList = () => {
        syncCurrentEdits();
        setEditingProviderId(null);
    };

    // --- Supabase Login Handler ---
    const handleSupabaseLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!supabase) return;
        setLoadingAuth(true);
        setAuthMessage('');
        
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                // If you deploy to Vercel, change this to your Vercel URL!
                emailRedirectTo: window.location.origin, 
            },
        });

        if (error) {
            setAuthMessage(error.message);
        } else {
            setAuthMessage('Ссылка для входа отправлена на вашу почту!');
        }
        setLoadingAuth(false);
    };

    const fetchModels = async () => { /* ... existing fetchModels code ... */ 
        if (!tempProvider) return;
        const apiKey = keysText.split(/[\n,]+/).map(k => k.trim())[0];
        const baseUrl = tempProvider.baseUrl;
        if (!apiKey) { alert('Сначала введите API ключ'); return; }
        if (!baseUrl) { alert('Введите Base URL'); return; }
        setIsFetchingModels(true);
        try {
            const cleanUrl = baseUrl.replace(/\/$/, '');
            const response = await fetch(`${cleanUrl}/models`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data && Array.isArray(data.data)) {
                const models = data.data.map((m: any) => m.id).sort();
                setTempProvider({
                    ...tempProvider,
                    models: models,
                    defaultModel: models.includes(tempProvider.defaultModel) ? tempProvider.defaultModel : models[0]
                });
                alert(`Найдено ${models.length} моделей.`);
            } else { alert('Неизвестный формат ответа от сервера.'); }
        } catch (e: any) { console.error(e); alert(`Ошибка: ${e.message}`); } finally { setIsFetchingModels(false); }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center md:p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-surface md:border border-border md:rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-full md:h-[600px]" onClick={e => e.stopPropagation()}>
                
                {/* Tabs */}
                <div className="w-full md:w-48 bg-zinc-900/50 border-b md:border-b-0 md:border-r border-white/5 p-2 md:p-4 flex flex-row md:flex-col gap-1 shrink-0 overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('account')} className={`whitespace-nowrap flex-1 md:flex-none text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center md:justify-start gap-2 transition-colors ${activeTab === 'account' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}><User size={16} /> <span className="md:inline">Аккаунт</span></button>
                    <button onClick={() => setActiveTab('ai')} className={`whitespace-nowrap flex-1 md:flex-none text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center md:justify-start gap-2 transition-colors ${activeTab === 'ai' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}><Smartphone size={16} /> <span className="md:inline">AI Модели</span></button>
                    <button onClick={() => setActiveTab('general')} className={`whitespace-nowrap flex-1 md:flex-none text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center md:justify-start gap-2 transition-colors ${activeTab === 'general' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}><Layout size={16} /> <span className="md:inline">Данные</span></button>
                    <button onClick={onClose} className="md:hidden p-2 ml-2 text-zinc-500"><X size={20} /></button>
                </div>

                <div className="flex-1 flex flex-col bg-surface relative min-w-0 h-full overflow-hidden">
                    <button onClick={onClose} className="hidden md:block absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors z-10"><X size={20} /></button>

                    <div className="flex-1 overflow-hidden flex flex-col h-full">
                        {activeTab === 'ai' ? (
                            <div className="flex h-full relative">
                                <div className={`flex-col bg-zinc-950/20 md:border-r border-white/5 ${editingProviderId ? 'hidden md:flex' : 'flex w-full'} md:w-1/3 h-full`}>
                                    <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                                        <span className="text-xs font-bold text-zinc-500 uppercase">Провайдеры</span>
                                        <button onClick={addNewProvider} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white"><Plus size={18} /></button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                        {settings.providers.map(p => (
                                            <div key={p.id} onClick={() => { syncCurrentEdits(); setEditingProviderId(p.id); }} className={`group flex items-center justify-between p-3 md:p-2.5 rounded-xl md:rounded-lg cursor-pointer text-sm transition-all border ${editingProviderId === p.id ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'border-transparent bg-white/5 md:bg-transparent text-zinc-300 hover:bg-white/10 hover:text-zinc-100'}`}>
                                                <div className="flex flex-col min-w-0 gap-0.5"><span className="font-bold md:font-medium truncate text-base md:text-sm">{p.name}</span></div>
                                                <div className="flex items-center gap-2">{settings.activeProviderId === p.id && (<div className="flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded text-green-500 text-[10px] font-bold uppercase">Активен</div>)}{p.id !== 'gemini-default' && (<button onClick={(e) => deleteProvider(p.id, e)} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg md:opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className={`flex-col bg-surface h-full overflow-hidden ${editingProviderId ? 'flex w-full' : 'hidden md:flex'} md:flex-1`}>
                                    {tempProvider && editingProviderId ? (
                                        <div className="flex flex-col h-full">
                                            <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                                                <div className="flex items-center gap-3"><button onClick={handleBackToList} className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white"><ChevronLeft size={24} /></button><h3 className="text-lg font-bold text-white truncate max-w-[150px] md:max-w-none">{tempProvider.name}</h3></div>
                                                <button onClick={() => { syncCurrentEdits(); setSettings({ ...settings, activeProviderId: editingProviderId }); }} disabled={settings.activeProviderId === editingProviderId} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${settings.activeProviderId === editingProviderId ? 'bg-green-500/10 text-green-500 border-green-500/20 cursor-default' : 'bg-white/5 text-zinc-400 hover:text-white border-white/10 hover:bg-white/10'}`}>{settings.activeProviderId === editingProviderId ? 'Активен' : 'Сделать активным'}</button>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 pb-20 md:pb-6">
                                                <div><label className="text-xs font-medium text-zinc-500 uppercase block mb-1.5">Название</label><input value={tempProvider.name} onChange={(e) => setTempProvider({...tempProvider, name: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-base text-white focus:border-blue-500 outline-none" /></div>
                                                {tempProvider.type === 'openai-compatible' && (<div><label className="text-xs font-medium text-zinc-500 uppercase block mb-1.5">Base URL</label><div className="relative"><Server size={18} className="absolute left-3 top-3.5 text-zinc-600" /><input value={tempProvider.baseUrl || ''} onChange={(e) => setTempProvider({...tempProvider, baseUrl: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-base text-white focus:border-blue-500 outline-none font-mono" /></div></div>)}
                                                <div><label className="text-xs font-medium text-zinc-500 uppercase block mb-1.5">API Keys</label><div className="relative"><Key size={18} className="absolute left-3 top-3 text-zinc-600" /><textarea value={keysText} onChange={(e) => setKeysText(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-blue-500 outline-none font-mono min-h-[120px] resize-none" placeholder="sk-..." /></div></div>
                                                <div className="pt-2 border-t border-white/5"><label className="text-xs font-medium text-zinc-500 uppercase block mb-1.5">Модель</label>
                                                    {tempProvider.type === 'gemini' ? (
                                                        <div className="relative"><Box size={18} className="absolute left-3 top-3.5 text-zinc-600" /><select value={tempProvider.defaultModel} onChange={(e) => setTempProvider({...tempProvider, defaultModel: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-10 pr-8 py-3 text-base text-white focus:border-blue-500 outline-none appearance-none"><option value="gemini-2.5-flash">Gemini 2.5 Flash</option><option value="gemini-1.5-pro">Gemini 1.5 Pro</option></select></div>
                                                    ) : (
                                                        <div className="space-y-3">
                                                            <div className="flex gap-2"><div className="relative flex-1"><Box size={18} className="absolute left-3 top-3.5 text-zinc-600" /><select value={tempProvider.defaultModel} onChange={(e) => setTempProvider({...tempProvider, defaultModel: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-10 pr-8 py-3 text-base text-white focus:border-blue-500 outline-none appearance-none">{tempProvider.models.map(m => (<option key={m} value={m}>{m}</option>))}</select></div><button onClick={fetchModels} disabled={isFetchingModels} className="px-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"><RefreshCcw size={20} className={isFetchingModels ? 'animate-spin' : ''} /></button></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (<div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-50 p-6 text-center"><Server size={48} className="mb-4 text-zinc-700" /><p className="text-base font-medium">Выберите провайдера</p></div>)}
                                </div>
                            </div>
                        ) : activeTab === 'account' ? (
                            <div className="p-6 md:p-8 space-y-6 animate-fade-in overflow-y-auto">
                                <div><h3 className="text-xl font-bold text-white mb-2">Аккаунт (Supabase)</h3><p className="text-sm text-zinc-400">Вход без пароля через Email (Magic Link).</p></div>
                                <div className="p-6 rounded-2xl border border-white/5 bg-zinc-900/50">
                                    {user ? (
                                        <div className="flex items-center gap-4">
                                            {user.photoURL ? (<img src={user.photoURL} alt="Avatar" className="w-14 h-14 rounded-full" />) : (<div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400"><User size={28} /></div>)}
                                            <div className="flex-1 min-w-0"><div className="font-bold text-white text-lg truncate">{user.displayName || 'Пользователь'}</div><div className="text-sm text-zinc-500 truncate">{user.email}</div></div>
                                            <button onClick={onLogout} className="p-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors"><LogOut size={20} /></button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-6">
                                            {!isSupabaseConfigured() ? (
                                                <div className="text-yellow-500 mb-4 bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20">
                                                    Ключи Supabase не найдены в переменных окружения.
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 mx-auto mb-4"><User size={32} /></div>
                                                    <form onSubmit={handleSupabaseLogin} className="max-w-xs mx-auto space-y-3">
                                                        <input 
                                                            type="email" 
                                                            required
                                                            placeholder="Ваш Email"
                                                            value={email}
                                                            onChange={e => setEmail(e.target.value)}
                                                            className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                                                        />
                                                        <button 
                                                            type="submit" 
                                                            disabled={loadingAuth}
                                                            className="w-full px-6 py-3 bg-white text-black hover:bg-zinc-200 rounded-xl text-base font-bold transition-colors flex items-center justify-center gap-3"
                                                        >
                                                            {loadingAuth ? 'Отправка...' : 'Войти по ссылке'}
                                                        </button>
                                                    </form>
                                                    {authMessage && <div className="mt-4 text-sm text-blue-400 p-3 bg-blue-500/10 rounded-lg">{authMessage}</div>}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 md:p-8 space-y-6 animate-fade-in overflow-y-auto">
                                <div><h3 className="text-xl font-bold text-white mb-2">Управление данными</h3><p className="text-sm text-zinc-400">Резервное копирование и перенос.</p></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button onClick={onExport} className="flex flex-row md:flex-col items-center justify-start md:justify-center gap-4 p-5 rounded-2xl bg-zinc-900/50 border border-white/5 hover:bg-white/5 hover:border-white/20 transition-all group"><div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform shrink-0"><Download size={24} /></div><div className="text-left md:text-center"><span className="block text-base font-bold text-zinc-200">Скачать бэкап</span></div></button>
                                    <button onClick={() => fileInputRef.current?.click()} className="flex flex-row md:flex-col items-center justify-start md:justify-center gap-4 p-5 rounded-2xl bg-zinc-900/50 border border-white/5 hover:bg-white/5 hover:border-white/20 transition-all group"><div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform shrink-0"><Upload size={24} /></div><div className="text-left md:text-center"><span className="block text-base font-bold text-zinc-200">Импорт данных</span></div></button>
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileSelect} />
                            </div>
                        )}
                    </div>
                    <div className="p-4 border-t border-white/5 flex justify-end bg-surface pb-safe"><button onClick={handleSaveGlobal} className="w-full md:w-auto px-8 py-3 md:py-2 bg-white text-black rounded-xl md:rounded-lg font-bold text-base md:text-sm hover:bg-zinc-200 transition-colors shadow-lg hover:shadow-white/10 flex items-center justify-center gap-2"><Save size={18} className="md:hidden" /> Сохранить</button></div>
                </div>
            </div>
        </div>
    );
};