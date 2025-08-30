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
        // finalPrompt = `我现在希望调用fal-ai/nano-banana/edit  对这个图片${imageUrl},进行编辑,prompt is 把相片里的每个人物都变成一个手办人物。每个人只能生成一张图片，生成图片再做一个html网页，然后部署到cloudflare 上去。 `;
        finalPrompt = `我现在希望调用fal-ai/nano-banana/edit  对这个图片${imageUrl},进行编辑(使用url 进行图片编辑而不是我发给你的这张，我发给你的这张用于读取人物的大致的位置),prompt is 把相片里的每个人物都变成一个手办人物（高细节、玩具手办质感（适合展示））。每个人只能生成一张图片，生成图片再做一个html网页，然后部署到cloudflare 上去。 `;
      } else if (imageUrl) {
        // For other templates, append the URL
        finalPrompt = `${template.content} [Additional image URL: ${imageUrl}]`;
        finalPrompt = `我现在希望调用fal-ai/nano-banana/edit  对这个图片${imageUrl},进行编辑(使用url 进行图片编辑而不是我发给你的这张),prompt is 把相片里的每个人物都变成一个手办人物（高细节、玩具手办质感（适合展示）），背景需要保持和当前的一致性，图片需要具有一定的科幻意识感觉。总共生成一张图片，生成图片再做一个html网页，这个网页就是一张图片的展示card，然后点击某个button 就可以进行切换到手办，注意切换的时候动画的流畅性，然后部署到cloudflare 上去。 别问直接干`;
      }
      

      finalPrompt =` 把这个合照${imageUrl} ，使用 fal-ai/nano-banana/edit 生成三张图片，分别是，1. 把每个人的表情替换成经典的meme doge 笑or 惊讶皮卡丘脸，2. 把合照中的背景都换成海边派对 3. 把合照中的每个人都换成超级英雄的服侍。
      在得到这三张照片后，参考如下代码做一个网页，总共包括原图是四张图，然后点击对应的button 就可以进行切换到对应的照片，记得要简约的美且流畅，除了Image and button不能有其他任何元素和如下html 一样的美和简约。做好网页后，记得简单测试下网页，再部署到cloudflare 上去。不要问user问题，直接干直到完成。
      
      参考的代码是 <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Water Videos Music Experience</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background-color: #000;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            overflow: hidden;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }

        /* Video Container */
        .video-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000;
        }

        .video-slide {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0;
            transition: opacity 0.8s ease;
        }

        .video-slide.active {
            opacity: 1;
        }

        video {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        /* Mode buttons */
        .mode-buttons {
            position: absolute;
            bottom: 60px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 15px;
            z-index: 20;
            flex-wrap: wrap;
            justify-content: center;
            max-width: 90%;
        }

        .mode-btn {
            padding: 12px 20px;
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(20px);
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 30px;
            color: #fff;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
            white-space: nowrap;
            min-width: 60px;
            text-align: center;
        }

        .mode-btn:active {
            transform: scale(0.95);
        }

        .mode-btn.active {
            background: rgba(100, 200, 255, 0.4);
            border-color: rgba(100, 200, 255, 0.8);
            box-shadow: 0 0 30px rgba(100, 200, 255, 0.5);
        }

        /* Loading screen */
        .loading {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 20px;
            z-index: 100;
            transition: opacity 0.5s ease;
        }

        .loading.hidden {
            opacity: 0;
            pointer-events: none;
        }

        .spinner {
            width: 50px;
            height: 50px;
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }


        /* Mobile optimization */
        @media (max-width: 768px) {
            .mode-buttons {
                gap: 10px;
                bottom: 40px;
            }
            .mode-btn {
                padding: 10px 16px;
                font-size: 12px;
                min-width: 50px;
            }
        }

        /* Small mobile devices */
        @media (max-width: 380px) {
            .mode-buttons {
                gap: 6px;
            }
            .mode-btn {
                padding: 8px 12px;
                font-size: 11px;
            }
        }
    </style>
</head>
<body>
    <!-- Loading Screen -->
    <div class="loading" id="loadingScreen">
        <div class="spinner"></div>
    </div>

    <!-- Video Container -->
    <div class="video-container">
        <!-- Video 1: Blue Core -->
        <div class="video-slide active" data-mode="blue">
            <video muted loop playsinline preload="metadata">
                <source src="assets/hammondo84_blue-core_caustic_light_volume_rays_god_light_--ar_9764a4ed-2281-48b9-bf96-db4252e7d4e8_0.mp4" type="video/mp4">
            </video>
        </div>
        <!-- Video 2: Desert Lights -->
        <div class="video-slide" data-mode="desert">
            <video muted loop playsinline preload="metadata">
                <source src="assets/hammondo84_pulsing_lights_over_a_desert_landscape_--ar_45_--v_9ce3dd93-d83c-4ec6-bce5-d465613f1978_0.mp4" type="video/mp4">
            </video>
        </div>
        <!-- Video 3: Flowing Light -->
        <div class="video-slide" data-mode="flow">
            <video muted loop playsinline preload="metadata">
                <source src="assets/oestokki_a_flowing_stream_of_light_that_moves_with_breath_shi_88cc85e1-42f2-41d0-bdcc-6234639fb0b7_0.mp4" type="video/mp4">
            </video>
        </div>
        <!-- Video 4: Animated Wallpaper -->
        <div class="video-slide" data-mode="animate">
            <video muted loop playsinline preload="metadata">
                <source src="assets/u1778869178_httpss.mj.rung5GEHOrs7g8_Animated_live_wallpaper__00edef0b-0aaf-4c3d-82bf-ba2c3689ecf5_0.mp4" type="video/mp4">
            </video>
        </div>
        <!-- Video 5: Water Flowers -->
        <div class="video-slide" data-mode="water">
            <video muted loop playsinline preload="metadata">
                <source src="assets/u1778869178_httpss.mj.runzXpDRFUQkwI_Moving_water_and_flowers_dd9d9769-b31e-4a7c-a27f-e9de3f78c07b_0.mp4" type="video/mp4">
            </video>
        </div>
    </div>

    <!-- Mode Buttons -->
    <div class="mode-buttons">
        <button class="mode-btn active" data-mode="blue">1</button>
        <button class="mode-btn" data-mode="desert">2</button>
        <button class="mode-btn" data-mode="flow">3</button>
        <button class="mode-btn" data-mode="animate">4</button>
        <button class="mode-btn" data-mode="water">5</button>
    </div>


    <!-- Audio Element (Hidden) -->
    <audio id="backgroundMusic" loop autoplay preload="auto">
        <source src="assets/1-10 Poor Butterfly.mp3" type="audio/mpeg">
    </audio>

    <script>
        // Elements
        const loadingScreen = document.getElementById('loadingScreen');
        const audio = document.getElementById('backgroundMusic');
        const modeButtons = document.querySelectorAll('.mode-btn');
        const videoSlides = document.querySelectorAll('.video-slide');
        
        // State
        let currentMode = 'blue';
        
        // Initialize
        function init() {
            // Set initial volume
            audio.volume = 0.7;
            
            // Hide loading after delay
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
                // Start first video
                playVideo(currentMode);
                // Try to play audio
                audio.play().catch(() => {
                    // Autoplay might be blocked, user interaction will trigger it
                });
            }, 1500);
            
            // Setup mode buttons
            modeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const mode = btn.dataset.mode;
                    switchMode(mode);
                    // Try to play audio on first interaction
                    audio.play().catch(() => {});
                });
            });
            
        }
        
        // Switch video mode
        function switchMode(mode) {
            if (mode === currentMode) return;
            
            // Update buttons
            modeButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });
            
            // Update videos
            videoSlides.forEach(slide => {
                const isActive = slide.dataset.mode === mode;
                slide.classList.toggle('active', isActive);
                
                const video = slide.querySelector('video');
                if (isActive) {
                    video.currentTime = 0;
                    video.play().catch(() => {});
                } else {
                    video.pause();
                }
            });
            
            currentMode = mode;
        }
        
        // Play video by mode
        function playVideo(mode) {
            const activeSlide = document.querySelector([data-mode=mode]);
            if (activeSlide) {
                const video = activeSlide.querySelector('video');
                video.play().catch(() => {});
            }
        }
      
        // Video loop
        videoSlides.forEach(slide => {
            const video = slide.querySelector('video');
            video.addEventListener('ended', () => {
                video.currentTime = 0;
                video.play();
            });
        });
        
        // Audio loop
        audio.addEventListener('ended', () => {
            audio.currentTime = 0;
            audio.play();
        });
        
        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            const activeSlide = document.querySelector('.video-slide.active');
            const activeVideo = activeSlide ? activeSlide.querySelector('video') : null;
            
            if (document.hidden) {
                if (activeVideo) activeVideo.pause();
                audio.pause();
            } else {
                if (activeVideo) activeVideo.play().catch(() => {});
                audio.play().catch(() => {});
            }
        });
        
        // Initialize
        init();
    </script>
</body>
</html>
      `;



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