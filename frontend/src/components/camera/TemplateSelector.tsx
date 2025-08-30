'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTemplateData, Template } from './hooks/useTemplateData';

interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: Template | null, customText?: string) => void;
  onDirectSend?: (template: Template) => void;
}

export function TemplateSelector({ isOpen, onClose, onSelectTemplate, onDirectSend }: TemplateSelectorProps) {
  const { templates, isLoading, customText, setCustomText, fetchTemplates } = useTemplateData();

  // Fetch templates when opening
  useEffect(() => {
    if (isOpen && templates.length === 0) {
      fetchTemplates();
    }
  }, [isOpen, templates.length, fetchTemplates]);



  const handleTemplateClick = async (template: Template) => {
    if (onDirectSend) {
      try {
        await onDirectSend(template);
        // 只有成功发送后才关闭
        onClose();
      } catch (error) {
        console.error('❌ Failed to send template:', error);
        // 发送失败时不关闭，让用户可以重试
      }
    } else {
      onSelectTemplate(template);
      onClose();
    }
  };

  const handleCustomTextSubmit = () => {
    onSelectTemplate(null, customText);
    onClose();
  };

  if (!isOpen) return null;



  return (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'auto' }}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onPointerUp={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      />
      
      {/* Content - positioned absolutely */}
      <div 
        className="absolute bottom-32 left-0 right-0 flex justify-center px-4" 
        style={{ pointerEvents: 'auto', zIndex: 10000 }}
      >
        <div className="w-full max-w-sm space-y-3">

              {/* Loading state */}
              {isLoading && (
                <div className="px-6 py-4 bg-black/80 backdrop-blur-md rounded-2xl shadow-xl">
                  <div className="text-white text-center">加载模版中...</div>
                </div>
              )}

              {/* Template options */}
              {!isLoading && templates.length > 0 && (
                <>
                  {/* Template 1 */}
                  <button
                    type="button"
                    className="w-full px-6 py-4 bg-black/80 backdrop-blur-md rounded-2xl shadow-xl cursor-pointer hover:bg-black/90 transition-colors text-white font-medium text-center"
                    style={{ pointerEvents: 'auto', position: 'relative', zIndex: 1000 }}
                    onPointerUp={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (templates[0]) {
                        handleTemplateClick(templates[0]);
                      }
                    }}
                  >
                    {templates[0]?.title || 'Loading...'}
                  </button>

                  {/* Template 2 */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-6 py-4 bg-black/80 backdrop-blur-md rounded-2xl shadow-xl cursor-pointer hover:bg-black/90 transition-colors"
                    onPointerUp={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (templates[1]) {
                        handleTemplateClick(templates[1]);
                      }
                    }}
                  >
                    <div className="text-white font-medium text-center">[模版2]</div>
                  </motion.div>

                  {/* Custom input */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="px-4 py-3 bg-black/80 backdrop-blur-md rounded-2xl shadow-xl"
                  >
                    <div className="flex gap-3 items-center">
                      <input
                        type="text"
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleCustomTextSubmit();
                          }
                        }}
                        className="flex-1 px-4 py-2 text-white bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-transparent placeholder-white/60"
                        placeholder="what is something happening"
                        autoFocus
                      />
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onPointerUp={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCustomTextSubmit();
                        }}
                        className="px-3 py-2 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-colors"
                      >
                        <svg 
                          className="w-4 h-4" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth={2}
                        >
                          <path d="M7 17L17 7" />
                          <path d="M7 7h10v10" />
                        </svg>
                      </motion.button>
                    </div>
                  </motion.div>
                </>
              )}
        </div>
      </div>
    </div>
  );
}