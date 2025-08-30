import { X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraControlsProps {
  onClose: () => void;
}

export function CameraControls({ onClose }: CameraControlsProps) {
  return (
    <>
      {/* 顶部控制栏 */}
      <div className="fixed top-0 left-0 w-full z-50" 
           style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 1rem))' }}>
        <div className="flex justify-between items-center px-4 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-black/20 backdrop-blur-sm text-white hover:bg-black/40"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* 底部控制栏 */}
      <div className="fixed bottom-0 left-0 w-full z-50"
           style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))' }}>
        <div className="flex items-center justify-center px-8 py-6">
          <div className="flex items-center justify-between w-full max-w-sm">
            {/* Template 按钮 */}
            <Button
              variant="ghost"
              className="text-white font-medium text-base px-4 py-2 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40"
            >
              Template
            </Button>

            {/* 拍摄按钮 */}
            <div className="relative">
              <Button
                size="icon"
                className="h-20 w-20 rounded-full bg-white text-black hover:bg-gray-100 shadow-lg"
              >
                <div className="w-16 h-16 rounded-full border-4 border-black/10"></div>
              </Button>
            </div>

            {/* 发送按钮 */}
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full bg-black/20 backdrop-blur-sm text-white hover:bg-black/40"
            >
              <Send className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}