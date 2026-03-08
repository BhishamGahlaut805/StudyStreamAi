class TimerService {
  constructor(io) {
    this.io = io;
    this.timers = new Map(); // sessionId -> { timer, endTime, duration }
    this.intervals = new Map(); // sessionId -> interval for practice mode
  }

  // Start timer for real test
  startSessionTimer(sessionId, durationSeconds, onComplete) {
    if (this.timers.has(sessionId)) {
      return;
    }

    const endTime = Date.now() + durationSeconds * 1000;

    const timer = setTimeout(() => {
      if (onComplete) {
        onComplete(sessionId);
      }
      this.timers.delete(sessionId);
    }, durationSeconds * 1000);

    this.timers.set(sessionId, {
      timer,
      endTime,
      duration: durationSeconds,
      onComplete,
    });

    // Emit timer updates every second
    const interval = setInterval(() => {
      const remaining = this.getTimeRemaining(sessionId);
      if (remaining !== null) {
        this.io
          .of("/test")
          .to(`test:${sessionId}`)
          .emit("timer-update", {
            sessionId,
            timeRemaining: remaining,
            formattedTime: this.formatTime(remaining),
          });

        // Emit warnings at specific intervals
        if (remaining === 300) {
          // 5 minutes
          this.io.of("/test").to(`test:${sessionId}`).emit("timer-warning", {
            message: "5 minutes remaining!",
            timeRemaining: remaining,
          });
        } else if (remaining === 60) {
          // 1 minute
          this.io.of("/test").to(`test:${sessionId}`).emit("timer-warning", {
            message: "1 minute remaining!",
            timeRemaining: remaining,
          });
        }
      }
    }, 1000);

    this.intervals.set(sessionId, interval);
  }

  // Start practice mode (no timer, just tracking)
  startPracticeMode(sessionId, sessionStartTime = null) {
    if (this.intervals.has(sessionId)) {
      return;
    }

    // Practice mode doesn't have a timer, but we track session duration
    const startTime = sessionStartTime
      ? new Date(sessionStartTime).getTime()
      : Date.now();

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      this.io
        .of("/test")
        .to(`test:${sessionId}`)
        .emit("practice-duration", {
          sessionId,
          elapsedSeconds: elapsed,
          formattedTime: this.formatTime(elapsed),
        });
    }, 1000);

    this.intervals.set(sessionId, interval);
  }

  // Pause timer
  pauseSessionTimer(sessionId) {
    const timerData = this.timers.get(sessionId);
    if (!timerData) return;

    clearTimeout(timerData.timer);

    const remaining = this.getTimeRemaining(sessionId);
    this.timers.set(sessionId, {
      ...timerData,
      paused: true,
      remainingOnPause: remaining,
    });

    // Clear the update interval
    if (this.intervals.has(sessionId)) {
      clearInterval(this.intervals.get(sessionId));
      this.intervals.delete(sessionId);
    }
  }

  // Resume timer
  resumeSessionTimer(sessionId) {
    const timerData = this.timers.get(sessionId);
    if (!timerData || !timerData.paused) return;

    const remaining = timerData.remainingOnPause;

    // Start new timer with remaining time
    this.startSessionTimer(sessionId, remaining, timerData.onComplete);
  }

  // Clear timer
  clearSessionTimer(sessionId) {
    if (this.timers.has(sessionId)) {
      clearTimeout(this.timers.get(sessionId).timer);
      this.timers.delete(sessionId);
    }
    if (this.intervals.has(sessionId)) {
      clearInterval(this.intervals.get(sessionId));
      this.intervals.delete(sessionId);
    }
  }

  // Get time remaining in seconds
  getTimeRemaining(sessionId) {
    const timerData = this.timers.get(sessionId);
    if (!timerData) return null;
    if (timerData.paused) return timerData.remainingOnPause;

    const remaining = Math.max(
      0,
      Math.floor((timerData.endTime - Date.now()) / 1000),
    );
    return remaining;
  }

  // Format time as MM:SS
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  // Clean up all timers
  cleanup() {
    this.timers.forEach((data, sessionId) => {
      clearTimeout(data.timer);
    });
    this.intervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.timers.clear();
    this.intervals.clear();
  }
}

module.exports = (io) => new TimerService(io);
