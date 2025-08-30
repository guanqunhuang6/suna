import { Camera, AlertCircle } from 'lucide-react';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  hasPermission: boolean;
  permissionDenied: boolean;
  isLoading: boolean;
}

export function CameraPreview({ 
  videoRef, 
  hasPermission, 
  permissionDenied, 
  isLoading 
}: CameraPreviewProps) {
  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
          <div className="text-white/60 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-white/20 flex items-center justify-center animate-pulse">
              <Camera className="w-8 h-8" />
            </div>
            <p className="text-sm">Requesting camera access...</p>
          </div>
        </div>
      </div>
    );
  }

  if (permissionDenied) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
          <div className="text-white/60 text-center px-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-sm font-medium mb-2">Camera not available</p>
            <p className="text-xs text-white/40 leading-relaxed">
              This may be due to:
              <br />• Browser compatibility
              <br />• Camera permissions
              <br />• HTTPS requirement
            </p>
            <p className="text-xs text-white/60 mt-3">
              Try using Chrome or Safari on desktop
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay
        playsInline
        muted
      />
    </div>
  );
}