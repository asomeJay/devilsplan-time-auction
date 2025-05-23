export function useVibration() {
    const vibrate = (pattern: number | number[]) => {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    };
  
    return vibrate;
  }