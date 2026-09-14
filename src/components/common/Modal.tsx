/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Reusable Modal Component
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Maximize2, Minimize2, Grip } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  resizable?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'md',
  resizable = true,
}) => {
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const [isDraggingResize, setIsDraggingResize] = useState<boolean>(false);
  const modalCardRef = useRef<HTMLDivElement>(null);

  // Reset sizing when opened/closed
  useEffect(() => {
    if (!isOpen) {
      setIsMaximized(false);
      setCustomWidth(null);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Drag-to-resize logic (mouse and touch support)
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingResize(true);

    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const initialWidth = modalCardRef.current ? modalCardRef.current.offsetWidth : 500;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = (currentX - startX) * 2; // symmetric expansion from center
      const newWidth = Math.max(340, Math.min(window.innerWidth - 32, initialWidth + deltaX));
      setCustomWidth(newWidth);
    };

    const onEnd = () => {
      setIsDraggingResize(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  }, []);

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    full: 'max-w-[96vw]',
  }[maxWidth];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto overflow-x-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Dialog Card */}
          <motion.div
            ref={modalCardRef}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              width: isMaximized
                ? 'min(96vw, 1150px)'
                : customWidth
                ? `${customWidth}px`
                : undefined,
              maxWidth: isMaximized ? '96vw' : customWidth ? '96vw' : undefined,
            }}
            className={`relative w-full ${!customWidth && !isMaximized ? widthClasses : ''} ${
              isMaximized ? 'max-h-[95vh]' : ''
            } bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden z-10 my-auto transition-[width] duration-150 ease-out select-text`}
          >
            {/* Header */}
            <div
              onDoubleClick={() => resizable && setIsMaximized(!isMaximized)}
              className="flex items-start justify-between px-5 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-neutral-800/80 bg-neutral-900/95 cursor-default select-none"
            >
              <div className="min-w-0 pr-3">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">{title}</h3>
                {subtitle && <p className="text-xs text-neutral-400 mt-0.5 truncate">{subtitle}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Maximize / Restore Toggle */}
                {resizable && (
                  <button
                    type="button"
                    id="modal-resize-toggle-btn"
                    onClick={() => {
                      setIsMaximized(!isMaximized);
                      setCustomWidth(null);
                    }}
                    className="p-1.5 text-neutral-400 hover:text-amber-400 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 transition-colors"
                    title={isMaximized ? 'Réduire la taille' : 'Agrandir la fenêtre (Plein écran)'}
                    aria-label={isMaximized ? 'Réduire' : 'Agrandir'}
                  >
                    {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                )}

                {/* Close Button */}
                <button
                  id="modal-close-button"
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-lg bg-neutral-800/50 hover:bg-neutral-800 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className={`p-4 sm:p-6 ${isMaximized ? 'max-h-[84vh]' : 'max-h-[80vh]'} overflow-y-auto overflow-x-hidden`}>
              {children}
            </div>

            {/* Corner Resize Handle */}
            {resizable && !isMaximized && (
              <div
                onMouseDown={handleResizeStart}
                onTouchStart={handleResizeStart}
                title="Glisser pour redimensionner la fenêtre"
                className={`absolute bottom-0 right-0 p-1.5 cursor-nwse-resize select-none text-neutral-600 hover:text-amber-400 active:text-amber-300 transition-colors z-20 ${
                  isDraggingResize ? 'text-amber-400' : ''
                }`}
              >
                <Grip className="w-3.5 h-3.5 rotate-90" />
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
