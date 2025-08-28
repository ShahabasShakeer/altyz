export function throttle<T extends (...args: any[]) => void>(fn: T, wait: number) {
    let last = 0;
    let t: number | null = null;
    let lastArgs: any[] | null = null;
  
    const run = () => {
      last = performance.now();
      t = null;
      fn.apply(null, lastArgs as any[]);
      lastArgs = null;
    };
  
    return (...args: Parameters<T>) => {
      const now = performance.now();
      lastArgs = args;
      const remaining = wait - (now - last);
      if (remaining <= 0 || remaining > wait) {
        if (t) { cancelAnimationFrame(t); t = null; }
        run();
      } else if (!t) {
        t = requestAnimationFrame(run);
      }
    };
  }
  