import { useCallback, useEffect, useRef, useState } from 'react';
import { hashVariantsFromSource, thumbnailFromSource } from '../lib/perceptualHash';

export type CameraStatus = 'idle' | 'starting' | 'ready' | 'denied' | 'unsupported' | 'error';

export interface CaptureResult {
  /** hashVariantsFromSource output — index 0 is the canonical unrotated hash */
  hashes: string[];
  thumbnail: string;
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async (facingMode: 'environment' | 'user' = 'environment') => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }
    stop();
    setStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('ready');
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        setStatus('denied');
      } else {
        setStatus('error');
      }
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  const capture = useCallback((): CaptureResult | null => {
    const video = videoRef.current;
    if (!video || status !== 'ready') return null;
    return { hashes: hashVariantsFromSource(video), thumbnail: thumbnailFromSource(video) };
  }, [status]);

  return { videoRef, status, start, stop, capture };
}
