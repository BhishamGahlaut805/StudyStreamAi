// usePracticeTimers.jsx - Add persistence on timer updates

import testService from "../../../services/testService";
import { useEffect } from "react";

export const usePracticeTimers = ({
  session,
  currentQuestion,
  answerSubmitted,
  metrics,
  setMetrics,
  questionTime,
  setQuestionTime,
  sessionClockBaseRef,
  questionClockStartRef,
  sessionTimerRef,
  questionTimerRef,
}) => {
  // ==================== SESSION TIMER ====================
  useEffect(() => {
    if (session?.status !== "active" || !session) {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
      return;
    }

    // Set base time from metrics sessionTime
    const currentSessionTime = metrics?.sessionTime || 0;

    if (!sessionClockBaseRef.current) {
      if (currentSessionTime > 0) {
        sessionClockBaseRef.current = Date.now() - currentSessionTime * 1000;
      } else {
        sessionClockBaseRef.current = Date.now();
      }
      console.log(
        `[Timer] Session base time set to ${sessionClockBaseRef.current}, starting from ${currentSessionTime}s`,
      );
    }

    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
    }

    let lastPersistedTime = 0;

    sessionTimerRef.current = setInterval(() => {
      if (sessionClockBaseRef.current) {
        const elapsed = Math.max(
          0,
          Math.floor((Date.now() - sessionClockBaseRef.current) / 1000),
        );

        // Update metrics
        setMetrics((prev) => ({
          ...prev,
          sessionTime: elapsed,
        }));

        // ==================== FIX: Persist session time periodically ====================
        // Persist every 5 seconds or when time changes significantly
        if (elapsed - lastPersistedTime >= 5 || elapsed % 10 === 0) {
          // Update testService with current session time
          testService.updateSessionTime(elapsed);
          lastPersistedTime = elapsed;
        }
      }
    }, 1000);

    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
      // ==================== FIX: Persist final time on cleanup ====================
      const finalTime = metrics?.sessionTime || 0;
      if (finalTime > 0) {
        testService.updateSessionTime(finalTime);
      }
    };
  }, [session?.status, session?.sessionId]);

  // ==================== QUESTION TIMER ====================
  useEffect(() => {
    if (!currentQuestion || answerSubmitted) return;

    if (!questionClockStartRef.current) {
      questionClockStartRef.current = Date.now();
    }

    if (questionTimerRef.current) {
      clearInterval(questionTimerRef.current);
    }

    questionTimerRef.current = setInterval(() => {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - questionClockStartRef.current) / 1000),
      );
      setQuestionTime(elapsed);
      setMetrics((prev) => ({
        ...prev,
        questionTime: elapsed,
      }));
    }, 500);

    return () => {
      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
        questionTimerRef.current = null;
      }
    };
  }, [currentQuestion, answerSubmitted]);

  return {
    startSessionTimer: () => {},
    startQuestionTimer: () => {},
  };
};

