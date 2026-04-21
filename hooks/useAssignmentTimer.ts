import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function useAssignmentTimer(minDurationMinutes: number) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (running) return;
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  }, [running]);

  const pause = useCallback(() => {
    setRunning(false);
    clearTimer();
  }, [clearTimer]);

  const reset = useCallback(() => {
    setRunning(false);
    clearTimer();
    setElapsedSeconds(0);
  }, [clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const requiredSeconds = minDurationMinutes * 60;

  const isMinimumMet = useMemo(
    () => elapsedSeconds >= requiredSeconds,
    [elapsedSeconds, requiredSeconds]
  );

  const formattedElapsed = useMemo(() => formatTime(elapsedSeconds), [elapsedSeconds]);

  const formattedRequired = useMemo(() => formatTime(requiredSeconds), [requiredSeconds]);

  return {
    elapsedSeconds,
    running,
    isMinimumMet,
    formattedElapsed,
    formattedRequired,
    start,
    pause,
    reset,
  };
}
