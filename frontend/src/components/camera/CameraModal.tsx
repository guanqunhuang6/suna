'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TemplateSelector } from './TemplateSelector';
import { Template } from './hooks/useTemplateData';
import { useInitiateAgentMutation } from '@/hooks/react-query/dashboard/use-initiate-agent';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CameraModal({ isOpen, onClose }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [capturedImage, setCapturedImage] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedCustomText, setSelectedCustomText] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  
  const initiateAgentMutation = useInitiateAgentMutation();
  const router = useRouter();

  // 初始化相机 - 每次打开模态框时重新获取
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [isOpen]);

  const startCamera = async () => {
    try {
      console.log('🎥 Starting camera...');
      console.log('📱 Platform:', navigator.userAgent);
      console.log('🔒 HTTPS:', location.protocol === 'https:');
      setCameraReady(false);
      
      // Check if we're on mobile and if getUserMedia is available
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.log('📱 Mobile detected:', isMobile);
      
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API not supported on this device/browser');
      }
      
      // For mobile, try with more specific constraints
      let constraints;
      if (isMobile) {
        constraints = {
          video: {
            facingMode: 'user', // Front camera
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        };
      } else {
        constraints = {
          video: true,
          audio: false
        };
      }
      
      console.log('📷 Requesting camera with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Got stream:', stream.active, stream.getVideoTracks().length, 'tracks');
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // For mobile, wait a bit before playing
        if (isMobile) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        await videoRef.current.play();
        setCameraReady(true);
        console.log('✅ Camera ready');
      }
    } catch (error) {
      console.error('❌ Camera error:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      
      // Set user-friendly error message
      if (error.name === 'NotAllowedError') {
        setErrorMessage('Camera permission denied. Please allow camera access and try again.');
      } else if (error.name === 'NotFoundError') {
        setErrorMessage('No camera found on this device.');
      } else if (error.name === 'NotSupportedError') {
        setErrorMessage('Camera not supported on this browser/device.');
      } else if (location.protocol !== 'https:') {
        setErrorMessage('Camera requires HTTPS. Please use https:// instead of http://');
      } else {
        setErrorMessage(`Camera error: ${error.message}`);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setErrorMessage('');
    setCapturedImage('');
    setIsCapturing(false);
    setShowTemplateSelector(false);
    setSelectedTemplate(null);
    setSelectedCustomText('');
    setIsSending(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;

    try {
      setIsCapturing(true);
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw current video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get image data as base64
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageDataUrl);

      
      // Add capture animation delay
      setTimeout(() => {
        setIsCapturing(false);
      }, 200);
      
    } catch (error) {
      console.error('❌ Capture error:', error);
      setIsCapturing(false);
    }
  };

  const handleTemplateSelect = (template: Template | null, customText?: string) => {
    if (template) {
      setSelectedTemplate(template);
      setSelectedCustomText('');
    } else if (customText) {
      setSelectedTemplate(null);
      setSelectedCustomText(customText);
    }
  };

  // Convert base64 image to File object
  const base64ToFile = (base64String: string, filename: string): File => {
    const arr = base64String.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Direct send when template is clicked
  const handleDirectSend = async (template: Template) => {
    
    if (!capturedImage) {
      toast.error('Please capture an image first');
      throw new Error('No captured image available');
    }
    
    setIsSending(true);
    
    try {
      // First, upload the image to get URL
      let imageUrl = '';
      try {
        const uploadResponse = await fetch('/api/images/upload-base64', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            base64_data: capturedImage,
            bucket_name: 'browser-screenshots'
          }),
        });
        
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          imageUrl = uploadData.url;
          console.log('📷 Image uploaded to:', imageUrl);
        }
      } catch (uploadError) {
        console.error('Failed to upload image:', uploadError);
        // Continue without URL if upload fails
      }
      
      // Modify prompt to include image URL if available
      let finalPrompt = template.content;
      if (imageUrl && template.id === '1') {
        // Special prompt for template 1 with image URL
        finalPrompt = `is there any one in the image I just give you and could you please tell me what is your model? Another image url is ${imageUrl}, please also try to tell me which hair color the human have in the image url`;
      } else if (imageUrl) {
        // For other templates, append the URL
        finalPrompt = `${template.content} [Additional image URL: ${imageUrl}]`;
      }
      
      const formData = new FormData();
      formData.append('prompt', finalPrompt);
      
      // Convert base64 to file
      const imageFile = base64ToFile(capturedImage, `photo-${Date.now()}.jpg`);
      formData.append('files', imageFile);
      formData.append('stream', 'true');
      formData.append('enable_thinking', 'false');

      const result = await initiateAgentMutation.mutateAsync(formData);
      toast.success('Sent successfully!');
      
      // Close camera and return to home page
      onClose();
      router.push('/');
      
    } catch (error) {
      console.error('❌ Error:', error);
      toast.error('Failed to send');
      throw error; // Re-throw so TemplateSelector can handle it
    } finally {
      setIsSending(false);
    }
  };

  // Simple send function
  const handleSendCapture = async () => {
    
    if (!capturedImage) {
      toast.error('Please capture an image first');
      return;
    }
    
    const prompt = selectedTemplate?.content || selectedCustomText;
    if (!prompt?.trim()) {
      toast.error('Please enter some text');
      return;
    }
    
    // Close template selector
    setShowTemplateSelector(false);
    setIsSending(true);
    
    try {
      // First, upload the image to get URL
      let imageUrl = '';
      try {
        const uploadResponse = await fetch('/api/images/upload-base64', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            base64_data: capturedImage,
            bucket_name: 'browser-screenshots'
          }),
        });
        
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          imageUrl = uploadData.url;
          console.log('📷 Image uploaded to:', imageUrl);
        }
      } catch (uploadError) {
        console.error('Failed to upload image:', uploadError);
        // Continue without URL if upload fails
      }
      
      // Modify prompt to include image URL if available
      let finalPrompt = prompt.trim();
      if (imageUrl && selectedTemplate?.id === '1') {
        // Special prompt for template 1 with image URL
        finalPrompt = `is there any one in the image I just give you and could you please tell me what is your model? Another image url is ${imageUrl}, please also try to tell me which hair color the human have in the image url`;
        finalPrompt = `我现在希望调用fal-ai/nano-banana/edit  对这个图片${imageUrl},进行编辑,prompt is 把相片里的每个人物都变成一个手办人物。每个人只能生成一张图片，生成图片再做一个html网页，然后部署到cloudflare 上去。 `;
      } else if (imageUrl) {
        // For other cases, append the URL
        // finalPrompt = `${prompt.trim()} [Additional image URL: ${imageUrl}]`;
        finalPrompt = `我现在希望调用fal-ai/nano-banana/edit  对这个图片${imageUrl},进行编辑,prompt is 把相片里的每个人物都变成一个手办人物。每个人只能生成一张图片，生成图片再做一个html网页，然后部署到cloudflare 上去。 `;
      }
      
      const formData = new FormData();
      formData.append('prompt', finalPrompt);
      
      // Convert base64 to file
      const imageFile = base64ToFile(capturedImage, `photo-${Date.now()}.jpg`);
      formData.append('files', imageFile);
      formData.append('stream', 'true');
      formData.append('enable_thinking', 'false');

      const result = await initiateAgentMutation.mutateAsync(formData);
      toast.success('Sent successfully!');
      console.log('Success!', result);
      
      // Close camera and return to home page
      onClose();
      router.push('/');
      
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to send');
    } finally {
      console.log('Sending finished');
      setIsSending(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="camera-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
          >
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black"
            onClick={onClose}
          />

          {/* 相机内容 */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ 
              type: 'tween',
              duration: 0.3,
              ease: [0.32, 0.72, 0, 1]
            }}
            className="relative w-full h-full bg-black overflow-hidden"
          >
            {/* 相机预览区域 - TikTok风格 */}
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <div className="relative w-full max-w-[320px] aspect-[9/16] bg-black rounded-t-[24px] overflow-hidden shadow-2xl" 
                   style={{ marginTop: '60px', marginBottom: '160px' }}>
                {/* Video stream */}
                <video
                  ref={videoRef}
                  className={`w-full h-full object-cover transition-opacity duration-200 ${
                    capturedImage ? 'opacity-0' : 'opacity-100'
                  }`}
                  autoPlay
                  playsInline
                  muted
                />

                {/* Captured photo overlay */}
                {capturedImage && (
                  <div className="absolute inset-0">
                    <img
                      src={capturedImage}
                      alt="Captured photo"
                      className="w-full h-full object-cover"
                    />
                    {/* Retake button overlay */}
                    <div className="absolute top-4 left-4">
                      <button
                        onClick={() => setCapturedImage('')}
                        className="px-3 py-1 text-sm bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                      >
                        Retake
                      </button>
                    </div>
                  </div>
                )}

                {/* Capture flash effect */}
                {isCapturing && (
                  <div className="absolute inset-0 bg-white opacity-80 animate-pulse"></div>
                )}
                
                {/* Hidden canvas for photo capture */}
                <canvas
                  ref={canvasRef}
                  className="hidden"
                />
                
                {/* 加载状态和错误信息 */}
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-3xl">
                    <div className="text-white text-center px-8">
                      {errorMessage ? (
                        <div>
                          <div className="text-red-400 text-lg mb-2">⚠️</div>
                          <div className="text-sm leading-relaxed">{errorMessage}</div>
                          {location.protocol !== 'https:' && (
                            <div className="text-xs text-gray-400 mt-3">
                              Try: https://{location.host}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="animate-pulse text-lg mb-2">📷</div>
                          <div>Loading camera...</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 顶部控制栏 */}
            <div className="fixed top-0 left-0 w-full z-50" 
                 style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0.5rem))' }}>
              <div className="flex justify-between items-center px-4 py-1">
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

            {/* 拍照按钮 - 居中位置，TikTok风格 */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50">
              <div className="py-2">
                <div className="relative">
                  {/* 外圈白色边框 */}
                  <div 
                    className="h-16 w-16 rounded-full bg-transparent border-4 border-white flex items-center justify-center cursor-pointer"
                    onClick={capturePhoto}
                  >
                    {/* 内部白色圆点 */}
                    <div className="w-12 h-12 rounded-full bg-white hover:bg-gray-100 transition-colors"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* 左侧按钮 - Template */}
            <div className="absolute bottom-8 left-12 z-[100]">
              <div className="py-2 flex items-center">
                <Button
                  variant="ghost"
                  onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                  className="text-white font-medium text-base px-4 py-2 h-16 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 relative"
                >
                  Template
                  {(selectedTemplate || selectedCustomText) && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full"></div>
                  )}
                </Button>
              </div>
            </div>

            {/* 右侧按钮 - 发送 */}
            <div className="absolute bottom-8 right-12 z-[80]">
              <div className="py-2 flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSendCapture}
                  disabled={!capturedImage || (!selectedTemplate && !selectedCustomText) || isSending}
                  className="h-16 w-16 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>

      {/* Template Selector - Outside of main modal to avoid z-index conflicts */}
      {showTemplateSelector && (
        <TemplateSelector
          key="template-selector"
          isOpen={showTemplateSelector}
          onClose={() => setShowTemplateSelector(false)}
          onSelectTemplate={handleTemplateSelect}
          onDirectSend={handleDirectSend}
        />
      )}
    </>
  );
}