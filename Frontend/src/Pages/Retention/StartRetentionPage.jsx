import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiBookOpen,
  FiCheckCircle,
  FiLayers,
  FiMoon,
  FiSun,
} from "react-icons/fi";
import { useAuth } from "../../context/authContext";
import authService from "../../services/authService";
import retentionService from "../../services/RetentionModel/RetentionService";

const SUBJECT_OPTIONS = {
  english: {
    label: "English",
    description:
      "Vocabulary, Idioms, Phrases, Synonyms, Antonyms, One Word Substitution",
    accent: "from-orange-400 via-amber-500 to-yellow-500",
    topics: [
      "vocabulary",
      "idioms",
      "phrases",
      "synonyms",
      "antonyms",
      "one_word_substitution",
    ],
  },
  gk: {
    label: "GK",
    description: "History, Geography, Science, Current Affairs",
    accent: "from-cyan-400 via-sky-500 to-blue-600",
    topics: ["history", "geography", "science", "current_affairs"],
  },
};

const START_RETENTION_THEME_KEY = "retention_start_theme";

const StartRetentionPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [subject, setSubject] = useState("english");
  const [selectedTopics, setSelectedTopics] = useState(
    SUBJECT_OPTIONS.english.topics,
  );
  const [sessionType, setSessionType] = useState("practice");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const savedTheme = localStorage.getItem(START_RETENTION_THEME_KEY);
      if (savedTheme === "dark") return true;
      if (savedTheme === "light") return false;
      return Boolean(
        window.matchMedia?.("(prefers-color-scheme: dark)")?.matches,
      );
    } catch {
      return false;
    }
  });

  const studentId = useMemo(
    () => user?.studentId || user?.id || authService.getStudentId(),
    [user],
  );

  useEffect(() => {
    setSelectedTopics(SUBJECT_OPTIONS[subject].topics);
  }, [subject]);

  useEffect(() => {
    try {
      localStorage.setItem(
        START_RETENTION_THEME_KEY,
        isDarkMode ? "dark" : "light",
      );
    } catch {
      // Non-blocking if persistence is unavailable.
    }
  }, [isDarkMode]);

  const toggleTopic = (topic) => {
    setSelectedTopics((prev) => {
      if (prev.includes(topic)) {
        const next = prev.filter((item) => item !== topic);
        return next.length > 0 ? next : prev;
      }
      return [...prev, topic];
    });
  };

  const startSession = async () => {
    setError("");
    if (!studentId) {
      setError("Student identity is missing. Please login again.");
      return;
    }

    try {
      setStarting(true);

      const token = authService.getToken();
      retentionService.initialize(studentId);
      if (token) {
        retentionService.setAuthToken(token);
      }

      const response = await retentionService.startSession(
        subject,
        selectedTopics,
        sessionType,
      );

      if (!response.success) {
        throw new Error(response.error || "Unable to start retention session");
      }

      const startedAt = response.startTime || new Date().toISOString();
      localStorage.setItem(
        "retention_active_session",
        JSON.stringify({
          sessionId: response.sessionId,
          studentId,
          subject,
          topics: selectedTopics,
          sessionType,
          startedAt,
        }),
      );

      navigate("/retention/interface", {
        state: {
          session: response,
          config: {
            studentId,
            subject,
            topics: selectedTopics,
            sessionType,
            startedAt,
          },
        },
      });
    } catch (err) {
      setError(err.message || "Failed to start session.");
    } finally {
      setStarting(false);
    }
  };

  const pageShellClass = isDarkMode
    ? "min-h-screen bg-[radial-gradient(circle_at_top,_#1e293b_0%,_#0f172a_40%,_#020617_100%)] px-4 py-8 sm:px-8 text-slate-100"
    : "min-h-screen bg-[radial-gradient(circle_at_top,_#fef3c7_0%,_#fee2e2_25%,_#dbeafe_70%,_#f8fafc_100%)] px-4 py-8 sm:px-8 text-slate-900";

  const cardClass = isDarkMode
    ? "rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur sm:p-8"
    : "rounded-3xl border border-white/60 bg-white/80 p-6 shadow-2xl shadow-indigo-100/80 backdrop-blur sm:p-8";

  const sectionClass = isDarkMode
    ? "rounded-2xl border border-slate-700 bg-slate-900/75 p-5"
    : "rounded-2xl border border-slate-200 bg-white/80 p-5";

  return (
    <div className={pageShellClass}>
      <div className="mx-auto max-w-5xl">
        <div className={cardClass}>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p
                className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                  isDarkMode ? "text-amber-300" : "text-orange-600"
                }`}
              >
                Retention Practice Launcher
              </p>
              <h1
                className={`mt-2 text-3xl font-black sm:text-4xl ${
                  isDarkMode ? "text-slate-100" : "text-slate-900"
                }`}
              >
                Start Dedicated Retention Session
              </h1>
              <p
                className={`mt-2 max-w-2xl text-sm sm:text-base ${
                  isDarkMode ? "text-slate-300" : "text-slate-600"
                }`}
              >
                Select a subject and topic set. Questions will stream from
                Node.js and be adapted from Flask retention model predictions.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDarkMode((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  isDarkMode
                    ? "border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {isDarkMode ? (
                  <>
                    <FiSun className="h-4 w-4" />
                    Day Mode
                  </>
                ) : (
                  <>
                    <FiMoon className="h-4 w-4" />
                    Night Mode
                  </>
                )}
              </button>
              <div
                className={`rounded-2xl px-4 py-3 ${
                  isDarkMode
                    ? "bg-slate-950 text-slate-100"
                    : "bg-slate-900 text-white"
                }`}
              >
                <p className="text-xs uppercase tracking-wider text-slate-300">
                  Student
                </p>
                <p className="text-sm font-semibold">
                  {studentId || "Not found"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(SUBJECT_OPTIONS).map(([key, item]) => {
              const active = key === subject;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSubject(key)}
                  className={`group rounded-2xl border p-5 text-left transition-all ${
                    active
                      ? "border-transparent bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl"
                      : isDarkMode
                        ? "border-slate-700 bg-slate-900/70 hover:border-slate-500"
                        : "border-slate-200 bg-white/90 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold">{item.label}</p>
                    {active && <FiCheckCircle className="text-xl" />}
                  </div>
                  <p
                    className={`mt-2 text-sm ${
                      active
                        ? "text-slate-200"
                        : isDarkMode
                          ? "text-slate-300"
                          : "text-slate-600"
                    }`}
                  >
                    {item.description}
                  </p>
                  <div
                    className={`mt-4 h-2 w-full rounded-full bg-gradient-to-r ${item.accent} ${
                      active ? "opacity-100" : "opacity-40"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <div
            className={`mt-8 ${sectionClass} ${
              isDarkMode
                ? "bg-gradient-to-br from-slate-900/90 via-slate-900 to-indigo-950/30"
                : "bg-gradient-to-br from-white via-amber-50/60 to-rose-50/40"
            }`}
          >
            <div className="mb-4 flex items-center gap-2">
              <FiLayers
                className={`text-lg ${isDarkMode ? "text-amber-300" : "text-slate-700"}`}
              />
              <h2
                className={`text-lg font-bold ${
                  isDarkMode ? "text-slate-100" : "text-slate-900"
                }`}
              >
                Topic Selection
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
              {SUBJECT_OPTIONS[subject].topics.map((topic) => {
                const checked = selectedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      checked
                        ? "border-transparent bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 text-white shadow-md"
                        : isDarkMode
                          ? "border-slate-600 bg-slate-900 text-slate-200 hover:border-slate-400"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                    }`}
                  >
                    {topic.replaceAll("_", " ")}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={`mt-6 flex flex-wrap items-center justify-between gap-4 ${sectionClass} ${
              isDarkMode
                ? "bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/30"
                : "bg-gradient-to-r from-white via-cyan-50/70 to-blue-50/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <FiBookOpen
                className={`text-lg ${isDarkMode ? "text-cyan-300" : "text-slate-600"}`}
              />
              <div>
                <p
                  className={`text-sm font-semibold ${
                    isDarkMode ? "text-slate-100" : "text-slate-900"
                  }`}
                >
                  Session Mode
                </p>
                <p
                  className={`text-xs ${
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Use practice for adaptive retention learning loop.
                </p>
              </div>
            </div>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold outline-none ${
                isDarkMode
                  ? "border-slate-600 bg-slate-900 text-slate-100"
                  : "border-slate-300 bg-white text-slate-900"
              }`}
            >
              <option value="practice">Practice</option>
              <option value="review">Review</option>
              <option value="test">Test</option>
            </select>
          </div>

          {error && (
            <div
              className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                isDarkMode
                  ? "border-rose-400/50 bg-rose-950/40 text-rose-200"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {error}
            </div>
          )}

          <div className="mt-8 flex items-center justify-end">
            <button
              type="button"
              onClick={startSession}
              disabled={starting || selectedTopics.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-pink-500 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:from-orange-600 hover:via-pink-600 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {starting ? "Starting Session..." : "Start Retention Session"}
              <FiArrowRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StartRetentionPage;
