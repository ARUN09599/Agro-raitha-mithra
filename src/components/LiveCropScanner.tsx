import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  RotateCcw,
  SwitchCamera,
  X,
  Zap,
} from 'lucide-react';
import {
  compressImageFile,
  compressVideoFrameToPayload,
} from '../utils/compressImage.ts';

export interface ScannedPhotoPayload {
  mimeType: string;
  dataBase64: string;
  previewUrl: string;
  thumbUrl: string;
  name: string;
  source: 'camera' | 'upload';
}

interface LiveCropScannerProps {
  mode?: 'krishi' | 'chat';
  cropName?: string;
  dayNumber?: number;
  isEn: boolean;
  onClose: () => void;
  onScanCaptured: (payload: ScannedPhotoPayload, autoAnalyze: boolean) => void;
}

export const LiveCropScanner: React.FC<LiveCropScannerProps> = ({
  mode = 'krishi',
  cropName = 'Crop',
  dayNumber = 1,
  isEn,
  onClose,
  onScanCaptured,
}) => {
  const isChatMode = mode === 'chat';
  const prefersReduced = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(
    'environment'
  );
  const [startingCamera, setStartingCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [captured, setCaptured] = useState<ScannedPhotoPayload | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      stopCamera();
      setStartingCamera(true);
      setCameraError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setStartingCamera(false);
        setCameraError(
          isEn
            ? 'Live camera stream is unavailable here. Use the Native Camera / Photo Upload button below.'
            : 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಲೈವ್ ಕ್ಯಾಮೆರಾ ಲಭ್ಯವಿಲ್ಲ. ಕೆಳಗಿನ ಫೋಟೋ/ಕ್ಯಾಮೆರಾ ಬಟನ್ ಬಳಸಿ.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }

        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as
          | (MediaTrackCapabilities & { torch?: boolean })
          | undefined;
        setTorchSupported(Boolean(caps?.torch));
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Camera permission denied';
        setCameraError(
          isEn
            ? `Could not open live camera (${msg}). You can still capture or upload a daily photo below.`
            : `ಲೈವ್ ಕ್ಯಾಮೆರಾ ತೆರೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ (${msg}). ಕೆಳಗಿನ ಬಟನ್‌ನಿಂದ ಫೋಟೋ ತೆಗೆಯಿರಿ ಅಥವಾ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.`
        );
      } finally {
        setStartingCamera(false);
      }
    },
    [isEn, stopCamera]
  );

  useEffect(() => {
    if (!captured) {
      void startCamera(facingMode);
    }
    return () => {
      stopCamera();
    };
  }, [facingMode, captured, startCamera, stopCamera]);

  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  };

  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    try {
      const compressed = compressVideoFrameToPayload(video);
      stopCamera();
      setCaptured({
        ...compressed,
        name: isChatMode
          ? `chat_crop_${Date.now()}.jpg`
          : `${cropName.toLowerCase().replace(/\s+/g, '_')}_day_${dayNumber}.jpg`,
        source: 'camera',
      });
    } catch {
      setCameraError(
        isEn
          ? 'Could not capture frame. Try uploading photo directly.'
          : 'ಫೋಟೋ ಸೆರೆಹಿಡಿಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ನೇರವಾಗಿ ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.'
      );
    }
  };

  const handleFallbackFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const compressed = await compressImageFile(file);
    stopCamera();
    setCaptured({
      ...compressed,
      name: file.name || `day_${dayNumber}_scan.jpg`,
      source: 'upload',
    });
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B140E]/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <motion.div
        initial={prefersReduced ? false : { opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl bg-white border border-[#D4DAD4] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-[#13221A] text-white flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold flex items-center gap-2 truncate">
              <Camera className="w-4 h-4 text-[#86EFAC] shrink-0" />
              <span>
                {isChatMode
                  ? isEn
                    ? 'Live Camera · Ask Agron'
                    : 'ಲೈವ್ ಕ್ಯಾಮೆರಾ · ರೈತ ಮಿತ್ರ ಚಾಟ್'
                  : isEn
                  ? `Live Crop Scanner · ${cropName} (Day ${dayNumber})`
                  : `ಲೈವ್ ಬೆಳೆ ಸ್ಕ್ಯಾನರ್ · ${cropName} (ದಿನ ${dayNumber})`}
              </span>
            </div>
            <p className="text-[11px] text-[#C6DCC6] truncate mt-0.5">
              {isChatMode
                ? isEn
                  ? 'Point camera at crop, leaf, pest, or soil — capture & ask AI instantly'
                  : 'ಬೆಳೆ, ಎಲೆ, ಹುಳು ಅಥವಾ ಮಣ್ಣಿನ ಕಡೆ ಕ್ಯಾಮೆರಾ ಹಿಡಿದು ಫೋಟೋ ತೆಗೆಯಿರಿ'
                : isEn
                ? 'Point camera at leaves, stem, flower, or fruit for instant stage & disease scan'
                : 'ಎಲೆ, ಕಾಂಡ, ಹೂವು ಅಥವಾ ಕಾಯಿಯ ಕಡೆ ಕ್ಯಾಮೆರಾ ಹಿಡಿಯಿರಿ — ಹಂತ ಮತ್ತು ರೋಗ ಗುರುತಿಸುತ್ತದೆ'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label={isEn ? 'Close camera' : 'ಕ್ಯಾಮೆರಾ ಮುಚ್ಚಿ'}
            className="p-1.5 rounded-lg text-[#C6DCC6] hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder or Captured Preview */}
        <div className="relative bg-[#0D1610] aspect-[4/3] w-full overflow-hidden flex items-center justify-center">
          {captured ? (
            <img
              src={captured.previewUrl}
              alt="Captured crop scan"
              className="w-full h-full object-contain"
            />
          ) : cameraError ? (
            <div className="p-6 text-center space-y-3 max-w-md">
              <Camera className="w-10 h-10 text-[#86EFAC] mx-auto opacity-80" />
              <p className="text-xs text-[#E5ECE6] leading-relaxed">
                {cameraError}
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#166534] hover:bg-[#14532D] text-white text-xs font-semibold cursor-pointer">
                <Camera className="w-4 h-4" />
                <span>
                  {isEn
                    ? 'Open Phone Camera / Pick Photo'
                    : 'ಫೋನ್ ಕ್ಯಾಮೆರಾ / ಫೋಟೋ ಆಯ್ಕೆ ಮಾಡಿ'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFallbackFile}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />

              {/* Scanning Reticle Frame */}
              <div className="pointer-events-none absolute inset-6 sm:inset-8 border border-white/25 rounded-xl">
                <span className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-2 border-l-2 border-[#4ADE80] rounded-tl-lg" />
                <span className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-2 border-r-2 border-[#4ADE80] rounded-tr-lg" />
                <span className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-2 border-l-2 border-[#4ADE80] rounded-bl-lg" />
                <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-2 border-r-2 border-[#4ADE80] rounded-br-lg" />

                {!prefersReduced && !startingCamera && (
                  <motion.div
                    initial={{ top: '6%' }}
                    animate={{ top: ['6%', '92%', '6%'] }}
                    transition={{
                      duration: 3.2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="absolute inset-x-3 h-0.5 bg-gradient-to-r from-transparent via-[#4ADE80] to-transparent opacity-80"
                  />
                )}
              </div>

              {startingCamera && (
                <div className="absolute inset-0 bg-[#0B140E]/70 flex flex-col items-center justify-center gap-2 text-white text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-[#4ADE80]" />
                  <span>
                    {isEn ? 'Opening live camera...' : 'ಲೈವ್ ಕ್ಯಾಮೆರಾ ತೆರೆಯುತ್ತಿದೆ...'}
                  </span>
                </div>
              )}

              {/* Camera Top Controls */}
              {!startingCamera && (
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  {torchSupported && (
                    <button
                      type="button"
                      onClick={() => void handleToggleTorch()}
                      className={`p-2 rounded-lg text-xs font-medium inline-flex items-center gap-1 cursor-pointer ${
                        torchOn
                          ? 'bg-[#FACC15] text-[#111814]'
                          : 'bg-black/60 text-white hover:bg-black/80'
                      }`}
                      title={isEn ? 'Flashlight' : 'ಫ್ಲ್ಯಾಶ್ ಲೈಟ್'}
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setFacingMode((m) =>
                        m === 'environment' ? 'user' : 'environment'
                      )
                    }
                    className="p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                    title={isEn ? 'Switch Camera' : 'ಕ್ಯಾಮೆರಾ ಬದಲಿಸಿ'}
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="p-4 bg-[#FAFBF9] border-t border-[#E2E5E0] flex flex-wrap items-center justify-between gap-2.5">
          {captured ? (
            <>
              <button
                type="button"
                onClick={() => setCaptured(null)}
                className="h-10 px-3.5 rounded-lg border border-[#D4DAD4] bg-white hover:bg-[#F1F4EF] text-xs font-medium text-[#141A16] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isEn ? 'Retake Photo' : 'ಮತ್ತೆ ತೆಗೆಯಿರಿ'}</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onScanCaptured(captured, false);
                    onClose();
                  }}
                  className="h-10 px-3.5 rounded-lg border border-[#166534] text-[#166534] hover:bg-[#EEF4EE] text-xs font-semibold cursor-pointer"
                >
                  {isChatMode
                    ? isEn
                      ? 'Attach to Chat'
                      : 'ಚಾಟ್‌ಗೆ ಸೇರಿಸಿ'
                    : isEn
                    ? 'Attach Only'
                    : 'ಫೋಟೋ ಮಾತ್ರ ಸೇರಿಸಿ'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onScanCaptured(captured, true);
                    onClose();
                  }}
                  className="h-10 px-4 rounded-lg bg-[#166534] hover:bg-[#14532D] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isChatMode
                      ? isEn
                        ? 'Send & Ask AI'
                        : 'ಕಳುಹಿಸಿ ಮತ್ತು AI ಕೇಳಿ'
                      : isEn
                      ? 'Scan & Identify Stage, Disease & Days'
                      : 'ಸ್ಕ್ಯಾನ್ ಮಾಡಿ: ಹಂತ, ರೋಗ & ದಿನ ತಿಳಿಯಿರಿ'}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="h-10 px-3.5 rounded-lg border border-[#D4DAD4] bg-white hover:bg-[#F1F4EF] text-xs font-medium text-[#3B473F] inline-flex items-center gap-1.5 cursor-pointer">
                <ImagePlus className="w-4 h-4 text-[#166534]" />
                <span>
                  {isEn ? 'Upload from Gallery' : 'ಗ್ಯಾಲರಿಯಿಂದ ಹಾಕಿ'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFallbackFile}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                disabled={startingCamera || Boolean(cameraError)}
                onClick={handleCaptureFrame}
                className="h-10 px-5 rounded-lg bg-[#166534] hover:bg-[#14532D] disabled:bg-[#9CA69F] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>
                  {isChatMode
                    ? isEn
                      ? 'Capture Photo'
                      : 'ಫೋಟೋ ತೆಗೆಯಿರಿ'
                    : isEn
                    ? 'Capture Daily Photo'
                    : 'ಇಂದಿನ ಫೋಟೋ ತೆಗೆಯಿರಿ'}
                </span>
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
