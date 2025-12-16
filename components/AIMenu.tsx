import React from 'react';
import { Sparkles, Play, Edit3, Type, FileText, CheckCircle } from 'lucide-react';
import { AIActionType } from '../types';

interface AIMenuProps {
    visible: boolean;
    position: { top: number; left: number };
    onAction: (action: AIActionType, prompt?: string) => void;
    onClose: () => void;
    isGenerating: boolean;
}

export const AIMenu: React.FC<AIMenuProps> = ({ visible, position, onAction, onClose, isGenerating }) => {
    const [customPrompt, setCustomPrompt] = React.useState('');
    const [showCustomInput, setShowCustomInput] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (showCustomInput && inputRef.current) {
            inputRef.current.focus();
        }
    }, [showCustomInput]);

    if (!visible) return null;

    const handleCustomSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (customPrompt.trim()) {
            onAction(AIActionType.CUSTOM, customPrompt);
            setCustomPrompt('');
            setShowCustomInput(false);
        }
    };

    return (
        <>
            <div 
                className="fixed inset-0 z-10" 
                onClick={onClose} 
            />
            <div 
                className="fixed z-20 w-64 bg-surfaceHighlight border border-border rounded-xl shadow-2xl animate-fade-in overflow-hidden"
                style={{ top: position.top, left: position.left }}
            >
                <div className="p-2 bg-zinc-950 border-b border-border flex items-center gap-2">
                    <Sparkles size={16} className="text-accent" />
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">AI Помощник</span>
                </div>

                {isGenerating ? (
                    <div className="p-4 flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-gray-300">Думаю...</span>
                    </div>
                ) : showCustomInput ? (
                    <form onSubmit={handleCustomSubmit} className="p-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            placeholder="Что нужно сделать?"
                            className="w-full bg-surface text-sm text-white rounded p-2 focus:outline-none focus:ring-1 focus:ring-accent mb-2"
                        />
                        <div className="flex gap-2 justify-end">
                            <button 
                                type="button" 
                                onClick={() => setShowCustomInput(false)}
                                className="text-xs text-secondary hover:text-white px-2 py-1"
                            >
                                Отмена
                            </button>
                            <button 
                                type="submit"
                                className="text-xs bg-accent text-white px-3 py-1 rounded hover:bg-blue-600"
                            >
                                Выполнить
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="py-1">
                        <button 
                            onClick={() => onAction(AIActionType.CONTINUE)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-surface hover:text-white flex items-center gap-2 transition-colors"
                        >
                            <Play size={14} /> Продолжить текст
                        </button>
                        <button 
                            onClick={() => onAction(AIActionType.IMPROVE)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-surface hover:text-white flex items-center gap-2 transition-colors"
                        >
                            <Edit3 size={14} /> Улучшить стиль
                        </button>
                        <button 
                            onClick={() => onAction(AIActionType.FIX_GRAMMAR)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-surface hover:text-white flex items-center gap-2 transition-colors"
                        >
                            <CheckCircle size={14} /> Исправить ошибки
                        </button>
                        <button 
                            onClick={() => onAction(AIActionType.SUMMARIZE)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-surface hover:text-white flex items-center gap-2 transition-colors"
                        >
                            <FileText size={14} /> Краткое содержание
                        </button>
                        <div className="h-px bg-border my-1 mx-2"></div>
                        <button 
                            onClick={() => setShowCustomInput(true)}
                            className="w-full text-left px-4 py-2 text-sm text-accent hover:bg-surface flex items-center gap-2 transition-colors font-medium"
                        >
                            <Type size={14} /> Свой запрос...
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};