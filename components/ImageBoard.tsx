import React, { useState, useEffect, useRef } from 'react';
import { Note, ImageItem } from '../types';
import { Upload, Trash2, Plus, Image as ImageIcon, AlertTriangle, X } from 'lucide-react';

interface ImageBoardProps {
    note: Note;
    onUpdate: (content: string) => void;
}

export const ImageBoard: React.FC<ImageBoardProps> = ({ note, onUpdate }) => {
    const [images, setImages] = useState<ImageItem[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [imageToDelete, setImageToDelete] = useState<string | null>(null);
    const [zoomImage, setZoomImage] = useState<ImageItem | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            const parsed = JSON.parse(note.content);
            if (Array.isArray(parsed)) {
                setImages(parsed);
            }
        } catch (e) {
            setImages([]);
        }
    }, [note.id]);

    const saveImages = (newImages: ImageItem[]) => {
        setImages(newImages);
        onUpdate(JSON.stringify(newImages));
    };

    const processFile = (file: File) => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Resize logic to prevent huge JSONs
                const MAX_WIDTH = 800;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = height * (MAX_WIDTH / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                
                // Compress to jpeg 0.7
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                
                const newItem: ImageItem = {
                    id: crypto.randomUUID(),
                    url: dataUrl,
                    createdAt: Date.now()
                };
                
                saveImages([newItem, ...images]);
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            Array.from(e.target.files).forEach(processFile);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const confirmDelete = () => {
        if (imageToDelete) {
            saveImages(images.filter(img => img.id !== imageToDelete));
            setImageToDelete(null);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            Array.from(e.dataTransfer.files).forEach(processFile);
        }
    };

    return (
        <div 
            className="w-full h-full flex flex-col p-6 overflow-hidden relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag Overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-blue-500/20 backdrop-blur-sm border-2 border-dashed border-blue-500 m-4 rounded-3xl flex items-center justify-center pointer-events-none">
                    <div className="text-blue-200 text-xl font-bold flex items-center gap-3">
                        <Upload size={32} />
                        Перетащите изображения сюда
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-6 shrink-0">
                <h2 className="text-zinc-500 text-sm font-medium uppercase tracking-wider">
                    {images.length} изображений
                </h2>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl font-medium text-sm hover:scale-105 transition-transform"
                >
                    <Plus size={16} /> Добавить
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    multiple 
                    accept="image/*"
                    onChange={handleFileUpload}
                />
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
                {images.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4 border-2 border-dashed border-white/5 rounded-3xl">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                            <ImageIcon size={32} />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-medium text-zinc-400">Доска пуста</p>
                            <p className="text-sm mt-1">Перетащите сюда файлы или нажмите кнопку добавить</p>
                        </div>
                    </div>
                ) : (
                    <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4 pb-20">
                        {images.map((img) => (
                            <div 
                                key={img.id} 
                                className="relative group break-inside-avoid cursor-zoom-in"
                                onClick={() => setZoomImage(img)}
                            >
                                <img 
                                    src={img.url} 
                                    alt="Reference" 
                                    className="w-full h-auto rounded-xl border border-white/5 shadow-lg bg-zinc-900 transition-transform duration-300 group-hover:brightness-110"
                                    loading="lazy"
                                />
                                {/* Overlay gradient for button visibility */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-xl pointer-events-none" />
                                
                                {/* Corner Delete Button */}
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setImageToDelete(img.id);
                                    }}
                                    className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm transform scale-90 group-hover:scale-100 shadow-lg"
                                    title="Удалить изображение"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Lightbox Viewer */}
            {zoomImage && (
                <div 
                    className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setZoomImage(null)}
                >
                    <button 
                        onClick={() => setZoomImage(null)}
                        className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50"
                    >
                        <X size={32} />
                    </button>
                    <img 
                        src={zoomImage.url} 
                        alt="Zoomed Reference" 
                        className="max-w-full max-h-full rounded-lg shadow-2xl object-contain scale-100 animate-fade-in"
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
                    />
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {imageToDelete && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden scale-100 transition-transform" onClick={e => e.stopPropagation()}>
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4 text-red-500">
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <AlertTriangle size={20} />
                                </div>
                                <h3 className="text-lg font-bold text-white">
                                    Удалить изображение?
                                </h3>
                            </div>
                            
                            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                                Это действие необратимо. Изображение будет удалено из вашей коллекции референсов.
                            </p>

                            <div className="flex gap-3 justify-end">
                                <button 
                                    onClick={() => setImageToDelete(null)}
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