import { useEffect, useRef } from 'react';

/** `ref.current` is false once the screen is gone, so async work can skip navigating from it. */
export function useMounted() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
