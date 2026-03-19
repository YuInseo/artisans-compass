import React, { useState, useEffect, useRef } from 'react';
import { Download, ZoomIn, ZoomOut, Maximize, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ImageModalProps {
    src: string;
    onClose: () => void;
}

export const ImageModal = ({ src, onClose }: ImageModalProps) => {
    const [scale, setScale] = useState(1);
    const positionRef = useRef({ x: 0, y: 0 });
    const imgRef = useRef<HTMLImageElement>(null);
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    // Reset position when scale drops to 1
    useEffect(() => {
        if (scale <= 1) {
            positionRef.current = { x: 0, y: 0 };
            if (imgRef.current) {
                imgRef.current.style.transform = `translate3d(0px, 0px, 0) scale(${scale})`;
            }
        }
    }, [scale]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === '=' || e.key === '+') setScale(s => Math.min(s + 0.25, 3));
            if (e.key === '-') setScale(s => Math.max(s - 0.25, 1));
            if (e.key === '0') {
                setScale(1);
                positionRef.current = { x: 0, y: 0 };
                if (imgRef.current) {
                    imgRef.current.style.transform = `translate3d(0px, 0px, 0) scale(1)`;
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        const a = document.createElement('a');
        a.href = src;
        a.download = `image-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (scale <= 1 || !imgRef.current) return;
        isDraggingRef.current = true;
        dragStartRef.current = {
            x: e.clientX - positionRef.current.x,
            y: e.clientY - positionRef.current.y
        };
        imgRef.current.style.transition = 'none';
        imgRef.current.style.cursor = 'grabbing';
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDraggingRef.current || scale <= 1 || !imgRef.current) return;

        positionRef.current = {
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        };

        // Directly update style to prevent lag from React re-renders during drag
        imgRef.current.style.transform = `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0) scale(${scale})`;
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDraggingRef.current = false;
        if (imgRef.current) {
            imgRef.current.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)';
            imgRef.current.style.cursor = scale > 1 ? 'grab' : 'zoom-out';
        }
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <div className="absolute top-4 right-4 z-50">
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <div
                className="relative flex items-center justify-center w-full h-full overflow-hidden"
                style={{ cursor: scale > 1 ? 'default' : 'zoom-out' }}
            >
                <img
                    ref={imgRef}
                    src={src}
                    alt="Expanded"
                    className="max-w-[90vw] max-h-[90vh] object-contain"
                    style={{
                        transform: `translate3d(${scale <= 1 ? 0 : positionRef.current.x}px, ${scale <= 1 ? 0 : positionRef.current.y}px, 0) scale(${scale})`,
                        cursor: scale > 1 ? 'grab' : 'zoom-out',
                        transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
                        willChange: 'transform'
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (scale <= 1) onClose();
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    draggable={false}
                />
            </div>

            <div
                className="absolute bottom-6 flex items-center gap-4 bg-[#2f2f2f]/95 text-[#a5a5a5] px-4 py-2.5 rounded-[6px] shadow-xl border border-white/10"
                onClick={(e) => e.stopPropagation()}
            >
                <button title="Zoom Out" className="hover:text-white transition-colors" onClick={() => setScale(s => Math.max(s - 0.25, 1))}>
                    <ZoomOut size={16} />
                </button>
                <span className="text-sm font-medium w-12 text-center text-white select-none">
                    {Math.round(scale * 100)}%
                </span>
                <button title="Zoom In" className="hover:text-white transition-colors" onClick={() => setScale(s => Math.min(s + 0.25, 3))}>
                    <ZoomIn size={16} />
                </button>
                <div className="w-[1px] h-4 bg-white/20 mx-1" />
                <button title="Download" className="hover:text-white transition-colors" onClick={handleDownload}>
                    <Download size={16} />
                </button>
                <button title="Original Size" className="hover:text-white transition-colors" onClick={() => {
                    setScale(1);
                    positionRef.current = { x: 0, y: 0 };
                    if (imgRef.current) {
                        imgRef.current.style.transform = `translate3d(0px, 0px, 0) scale(1)`;
                    }
                }}>
                    <Maximize size={16} />
                </button>
            </div>
        </div>,
        document.body
    );
};
