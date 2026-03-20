import { useState, useRef, useCallback, useEffect } from "react";

interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
}

export function usePlayback(totalDuration: number): PlaybackState {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

  const tick = useCallback(
    (timestamp: number) => {
      if (lastFrameRef.current === 0) lastFrameRef.current = timestamp;
      const delta = (timestamp - lastFrameRef.current) / 1000;
      lastFrameRef.current = timestamp;

      setCurrentTime((prev) => {
        const next = prev + delta;
        if (next >= totalDuration) {
          setIsPlaying(false);
          return totalDuration;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    },
    [totalDuration]
  );

  useEffect(() => {
    if (isPlaying) {
      lastFrameRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, tick]);

  const play = useCallback(() => {
    setCurrentTime((t) => (t >= totalDuration ? 0 : t));
    setIsPlaying(true);
  }, [totalDuration]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const stop = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const seekTo = useCallback(
    (time: number) => setCurrentTime(Math.max(0, Math.min(time, totalDuration))),
    [totalDuration]
  );

  return { isPlaying, currentTime, play, pause, stop, seekTo };
}
