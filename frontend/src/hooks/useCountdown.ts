import { useEffect, useState } from 'react';

/** Seconds left on a resend timer. `restart()` starts it again from `seconds`. */
export function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [run]);

  const restart = () => {
    setLeft(seconds);
    setRun((r) => r + 1);
  };

  return { left, restart, label: `0:${String(left).padStart(2, '0')}` };
}
