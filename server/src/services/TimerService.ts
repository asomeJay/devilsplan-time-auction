export class TimerService {
    private timers: Map<string, any> = new Map();
  
    startTimer(roomCode: string, callback: () => void, delay: number) {
      // 기존 타이머가 있다면 정리
      this.stopTimer(roomCode);
      
      const timer = setTimeout(callback, delay);
      this.timers.set(roomCode, timer);
    }
    
    startInterval(roomCode: string, callback: () => void, interval: number) {
      // 기존 타이머가 있다면 정리
      this.stopTimer(roomCode);
      
      const timer = setInterval(callback, interval);
      this.timers.set(roomCode, timer);
    }
  
    stopTimer(roomCode: string) {
      const timer = this.timers.get(roomCode);
      if (timer) {
        clearTimeout(timer);
        clearInterval(timer);
        this.timers.delete(roomCode);
      }
    }
    
    stopAllTimers() {
      this.timers.forEach(timer => {
        clearTimeout(timer);
        clearInterval(timer);
      });
      this.timers.clear();
    }
  }