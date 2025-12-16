import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, X, RotateCcw, Check, Upload, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onFileSelect?: (file: File) => void;
  className?: string;
  buttonText?: string;
  existingImage?: string | null;
}

export function CameraCapture({ 
  onCapture, 
  onFileSelect,
  className, 
  buttonText = "التقاط صورة",
  existingImage 
}: CameraCaptureProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError("لا يمكن الوصول إلى الكاميرا. تأكد من منح الإذن.");
      console.error("Camera error:", err);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setCapturedImage(null);
      setError(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL("image/jpeg", 0.8);
        setCapturedImage(imageData);
        stopCamera();
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const confirmPhoto = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      setIsOpen(false);
      setCapturedImage(null);
    }
  };

  const switchCamera = async () => {
    stopCamera();
    setFacingMode(prev => prev === "user" ? "environment" : "user");
    setTimeout(startCamera, 100);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (onFileSelect) {
        onFileSelect(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          onCapture(result);
        };
        reader.readAsDataURL(file);
      }
      setIsOpen(false);
    }
  };

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  return (
    <div className={cn("flex gap-2", className)}>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" data-testid="button-camera-capture">
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">{buttonText}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-right">التقاط صورة</DialogTitle>
          </DialogHeader>
          
          <div className="relative bg-black aspect-[4/3] flex items-center justify-center">
            {error ? (
              <div className="text-white text-center p-4">
                <p className="mb-4">{error}</p>
                <Button onClick={startCamera} variant="secondary" size="sm">
                  إعادة المحاولة
                </Button>
              </div>
            ) : capturedImage ? (
              <img 
                src={capturedImage} 
                alt="Captured" 
                className="w-full h-full object-contain"
              />
            ) : (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover"
              />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="p-4 flex items-center justify-center gap-3 bg-background">
            {capturedImage ? (
              <>
                <Button 
                  variant="outline" 
                  size="lg" 
                  onClick={retakePhoto}
                  className="gap-2"
                  data-testid="button-retake-photo"
                >
                  <RotateCcw className="w-4 h-4" />
                  إعادة
                </Button>
                <Button 
                  size="lg" 
                  onClick={confirmPhoto}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                  data-testid="button-confirm-photo"
                >
                  <Check className="w-4 h-4" />
                  تأكيد
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload-image"
                >
                  <Upload className="w-4 h-4" />
                </Button>
                {isMobile && (
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={switchCamera}
                    data-testid="button-switch-camera"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                )}
                <Button 
                  size="lg" 
                  onClick={capturePhoto}
                  className="w-16 h-16 rounded-full"
                  disabled={!!error}
                  data-testid="button-take-photo"
                >
                  <Camera className="w-6 h-6" />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {existingImage && (
        <div className="w-12 h-12 rounded border overflow-hidden">
          <img src={existingImage} alt="Current" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}

export function MobileImageInput({ 
  onImageSelect,
  className,
  label = "إضافة صورة"
}: {
  onImageSelect: (file: File) => void;
  className?: string;
  label?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImageSelect(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-2">
        <Button 
          type="button"
          variant="outline" 
          onClick={() => fileInputRef.current?.click()}
          className="gap-2 flex-1"
          data-testid="button-add-image"
        >
          <ImageIcon className="w-4 h-4" />
          {label}
        </Button>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {preview && (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden border">
          <img src={preview} alt="Preview" className="w-full h-full object-contain bg-muted" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 left-2 h-8 w-8"
            onClick={() => setPreview(null)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
