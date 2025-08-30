import { useEffect, useRef, useState } from 'react';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const initCamera = async () => {
    try {
      console.log('🎥 Starting camera initialization...');
      setIsLoading(true);
      setPermissionDenied(false);
      
      // Check if getUserMedia is available with fallback
      if (!navigator.mediaDevices?.getUserMedia) {
        // Try older API for compatibility
        const getUserMedia = (navigator as any).getUserMedia || 
                            (navigator as any).webkitGetUserMedia || 
                            (navigator as any).mozGetUserMedia;
        
        if (!getUserMedia) {
          throw new Error('Camera not supported in this browser');
        }
      }

      console.log('📱 Requesting camera permission...');
      
      // Use the same simple constraints as working test
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      
      console.log('✅ Camera permission granted, stream:', stream);
      streamRef.current = stream;
      setHasPermission(true);
      
      if (videoRef.current) {
        console.log('📺 Setting video srcObject...');
        videoRef.current.srcObject = stream;
        console.log('📺 SrcObject set, stream active:', stream.active);
        
        try {
          await videoRef.current.play();
          console.log('✅ Video playing');
        } catch (playError) {
          console.error('❌ Play failed:', playError);
        }
      } else {
        console.warn('⚠️ Video ref is null');
      }
    } catch (error) {
      console.error('❌ Camera access error:', error);
      setPermissionDenied(true);
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setHasPermission(false);
    setPermissionDenied(false);
    setIsLoading(false);
  };

  return {
    videoRef,
    hasPermission,
    permissionDenied,
    isLoading,
    initCamera,
    stopCamera
  };
}