import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiArrowRight,
  FiActivity,
  FiBookOpen,
  FiAirplay as FiBrain,
  FiBarChart2,
  FiCpu,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiGrid,
  FiClock,
  FiShield,
  FiCommand,
  FiRefreshCw,
  FiMonitor,
} from "react-icons/fi";

const Home = () => {
  const coreFeatures = [
    {
      icon: FiBrain,
      title: "Adaptive Learning Intelligence",
      description:
        "AI dynamically adjusts learning difficulty, pacing, and question selection based on student performance patterns.",
      gradient: "from-fuchsia-500 via-purple-500 to-violet-600",
    },
    {
      icon: FiRefreshCw,
      title: "Retention Learning System",
      description:
        "Spaced repetition and revision scheduling ensure concepts remain in long-term memory.",
      gradient: "from-cyan-500 via-sky-500 to-indigo-600",
    },
    {
      icon: FiBarChart2,
      title: "Deep Analytics Dashboard",
      description:
        "Track focus, weak topics, confidence levels, retention quality, and learning consistency visually.",
      gradient: "from-indigo-500 via-purple-500 to-pink-500",
    },
    {
      icon: FiUsers,
      title: "Teacher Course Ecosystem",
      description:
        "Teachers can create courses, manage learning paths, monitor students, and assign adaptive practice modules.",
      gradient: "from-emerald-500 via-teal-500 to-cyan-600",
    },
  ];

  const architectureLinks = [
    {
      title: "Adaptive Learning Design",
      subtitle:
        "See how StudyStream AI personalizes practice sessions dynamically.",
      to: "/design/adaptive",
      icon: FiBrain,
      gradient: "from-fuchsia-500 via-purple-500 to-violet-600",
    },
    {
      title: "Retention Learning Design",
      subtitle:
        "Understand the spaced repetition and retention intelligence system.",
      to: "/design/retention",
      icon: FiRefreshCw,
      gradient: "from-cyan-500 via-blue-500 to-indigo-600",
    },
  ];

  const platformPulse = [
    {
      label: "Daily Active Learners",
      value: "1.2K+",
      icon: FiActivity,
      accent: "from-fuchsia-500 to-violet-500",
    },
    {
      label: "Goals Tracked Per Week",
      value: "24K+",
      icon: FiTarget,
      accent: "from-cyan-500 to-indigo-500",
    },
    {
      label: "Adaptive Sessions Completed",
      value: "58K+",
      icon: FiClock,
      accent: "from-indigo-500 to-purple-500",
    },
    {
      label: "Secure Learning Workflows",
      value: "99.9%",
      icon: FiShield,
      accent: "from-emerald-500 to-teal-500",
    },
  ];

  const workspaceLinks = [
    {
      title: "Dashboard",
      desc: "Go to Dashboard and view your AI-powered workspace.",
      cta: "Go to Dashboard",
      icon: FiGrid,
      to: "/dashboard",
      gradient: "from-violet-500 via-fuchsia-500 to-pink-500",
    },
    {
      title: "Practice",
      desc: "Start adaptive practice sessions with smart question flow.",
      cta: "Start Practice",
      icon: FiBookOpen,
      to: "/test/practice",
      gradient: "from-indigo-500 via-purple-500 to-fuchsia-500",
    },
    {
      title: "Retention Learning",
      desc: "Try retention learning with spaced repetition scheduling.",
      cta: "Try Retention Learning",
      icon: FiRefreshCw,
      to: "/retention/start",
      gradient: "from-cyan-500 via-sky-500 to-indigo-600",
    },
    {
      title: "Create A Course",
      desc: "Create and manage courses from the teacher workspace.",
      cta: "Open Teacher Dashboard",
      icon: FiMonitor,
      to: "/teacher/dashboard",
      gradient: "from-emerald-500 via-teal-500 to-cyan-600",
    },
    {
      title: "Architecture",
      desc: "Check our architecture and explore adaptive system design.",
      cta: "Check Architecture",
      icon: FiBrain,
      to: "/design/adaptive",
      gradient: "from-fuchsia-500 via-purple-500 to-violet-600",
    },
    {
      title: "course Overview",
      desc: "Check our course overview and explore course details.",
      cta: "Go to Course Overview",
      icon: FiShield,
      to: "/courses",
      gradient: "from-slate-600 via-slate-700 to-slate-900",
    },
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-[#f7f7ff] text-slate-900 dark:bg-[#050816] dark:text-white">
      {/* BACKGROUND */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.18),transparent_35%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(6,182,212,0.14),transparent_35%)]" />
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      {/* HERO SECTION */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
          <div className="grid items-center gap-20 lg:grid-cols-2">
            {/* LEFT SIDE */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-200/60 bg-white/70 px-5 py-2 text-sm font-semibold text-purple-700 shadow-lg backdrop-blur-xl dark:border-purple-900/50 dark:bg-slate-900/70 dark:text-purple-300">
                <FiCpu className="h-4 w-4" />
                Intelligent Learning Ecosystem
              </div>

              <h1 className="mt-8 text-5xl font-black tracking-tight text-slate-900 sm:text-6xl lg:text-7xl dark:text-white">
                AI-Powered
                <span className="mt-3 block bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent">
                  Adaptive Learning
                </span>
                For Modern Education
              </h1>

              <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300 lg:mx-0">
                StudyStream AI combines adaptive intelligence, retention-focused
                revision systems, student dashboards, teacher course management,
                and real-time analytics into one deeply connected smart learning
                platform.
              </p>

              {/* BUTTONS */}
              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  to="/dashboard"
                  className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-500 px-7 py-4 text-sm font-semibold text-white shadow-xl shadow-purple-500/20 transition-all duration-300 hover:scale-[1.03]"
                >
                  Open Dashboard
                  <FiArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>

                <Link
                  to="/test/practice"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200/70 bg-white/70 px-7 py-4 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur-xl transition-all duration-300 hover:border-purple-300 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200"
                >
                  Start Adaptive Practice
                </Link>
              </div>

              {/* FEATURE TAGS */}
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                {[
                  "Adaptive Questioning",
                  "Retention Intelligence",
                  "Teacher Course System",
                  "Student Analytics",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-full border border-white/30 bg-white/60 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* RIGHT SIDE DASHBOARD */}
            {/* ================= HERO RIGHT SIDE - REPLACE WHOLE OLD DASHBOARD PREVIEW ================= */}

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7 }}
              className="relative"
            >
              {/* OUTER GLOW */}
              <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-r from-fuchsia-500/20 via-violet-500/20 to-cyan-500/20 blur-3xl dark:from-fuchsia-500/10 dark:via-violet-500/10 dark:to-cyan-500/10" />

              {/* MAIN CONTAINER */}
              <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/70 p-6 shadow-[0_25px_80px_rgba(88,28,135,0.15)] backdrop-blur-2xl dark:border-white/5 dark:bg-[#0b1120]/80 dark:shadow-[0_25px_80px_rgba(168,85,247,0.15)]">
                {/* TOP BAR */}
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-5 dark:border-slate-800/80">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      StudyStream AI Workspace
                    </p>

                    <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      Intelligent Learning Platform
                    </h3>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-500 p-3 text-white shadow-xl shadow-purple-500/20">
                    <FiCommand className="h-5 w-5" />
                  </div>
                </div>

                {/* FEATURE GRID */}
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {/* CARD 1 */}
                  <div className="group rounded-[1.8rem] border border-white/10 bg-gradient-to-br from-fuchsia-500/10 via-violet-500/10 to-transparent p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-fuchsia-500/20 hover:shadow-[0_15px_40px_rgba(168,85,247,0.15)] dark:border-slate-800 dark:from-fuchsia-500/5 dark:via-violet-500/5">
                    <div className="flex items-start justify-between">
                      <div className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-500 p-3 text-white shadow-lg">
                        <FiBrain className="h-5 w-5" />
                      </div>

                      <div className="rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold text-fuchsia-600 dark:text-fuchsia-300">
                        AI Adaptive
                      </div>
                    </div>

                    <h4 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">
                      Adaptive Learning
                    </h4>

                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      AI dynamically personalizes question flow, learning pace,
                      and topic progression according to student performance.
                    </p>
                  </div>

                  {/* CARD 2 */}
                  <div className="group rounded-[1.8rem] border border-white/10 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-transparent p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/20 hover:shadow-[0_15px_40px_rgba(6,182,212,0.15)] dark:border-slate-800 dark:from-cyan-500/5 dark:via-blue-500/5">
                    <div className="flex items-start justify-between">
                      <div className="rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 p-3 text-white shadow-lg">
                        <FiRefreshCw className="h-5 w-5" />
                      </div>

                      <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-600 dark:text-cyan-300">
                        Retention AI
                      </div>
                    </div>

                    <h4 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">
                      Retention Learning
                    </h4>

                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      Smart revision scheduling and spaced repetition workflows
                      improve long-term memory retention naturally.
                    </p>
                  </div>

                  {/* CARD 3 */}
                  <div className="group rounded-[1.8rem] border border-white/10 bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-transparent p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/20 hover:shadow-[0_15px_40px_rgba(139,92,246,0.15)] dark:border-slate-800 dark:from-violet-500/5 dark:via-purple-500/5">
                    <div className="flex items-start justify-between">
                      <div className="rounded-2xl bg-gradient-to-r from-violet-500 to-purple-500 p-3 text-white shadow-lg">
                        <FiUsers className="h-5 w-5" />
                      </div>

                      <div className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-600 dark:text-violet-300">
                        Course System
                      </div>
                    </div>

                    <h4 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">
                      Teacher & Student Courses
                    </h4>

                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      Teachers create structured AI-powered learning spaces
                      while students join and learn collaboratively.
                    </p>
                  </div>

                  {/* CARD 4 */}
                  <div className="group rounded-[1.8rem] border border-white/10 bg-gradient-to-br from-indigo-500/10 via-fuchsia-500/10 to-transparent p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/20 hover:shadow-[0_15px_40px_rgba(99,102,241,0.15)] dark:border-slate-800 dark:from-indigo-500/5 dark:via-fuchsia-500/5">
                    <div className="flex items-start justify-between">
                      <div className="rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 p-3 text-white shadow-lg">
                        <FiBarChart2 className="h-5 w-5" />
                      </div>

                      <div className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                        Smart Analytics
                      </div>
                    </div>

                    <h4 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">
                      Learning Dashboards
                    </h4>

                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      Clean visual dashboards help students and teachers monitor
                      learning progress, focus flow, and retention activity.
                    </p>
                  </div>
                </div>

                {/* BOTTOM NAVIGATION LINKS */}
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Link
                    to="/dashboard"
                    className="group rounded-[1.8rem] border border-white/10 bg-gradient-to-r from-fuchsia-500/10 via-violet-500/10 to-cyan-500/10 p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(168,85,247,0.15)] dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                          Unified Workspace
                        </p>

                        <h4 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                          Dashboard
                        </h4>
                      </div>

                      <div className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 p-3 text-white shadow-lg">
                        <FiGrid className="h-5 w-5" />
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      Access analytics, adaptive learning sessions, retention
                      workflows, courses, and AI learning insights.
                    </p>

                    <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-purple-600 transition-all duration-300 group-hover:gap-3 dark:text-purple-400">
                      Open Dashboard
                      <FiArrowRight />
                    </div>
                  </Link>

                  <div className="grid gap-4">
                    <Link
                      to="/design/adaptive"
                      className="group flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/60 p-4 shadow-sm backdrop-blur-xl transition-all duration-300 hover:border-fuchsia-500/20 hover:bg-white/80 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:bg-slate-900"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 p-2.5 text-white shadow-lg">
                          <FiBrain className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            Adaptive Design
                          </p>

                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Personalized learning flow
                          </p>
                        </div>
                      </div>

                      <FiArrowRight className="text-slate-400 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>

                    <Link
                      to="/design/retention"
                      className="group flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/60 p-4 shadow-sm backdrop-blur-xl transition-all duration-300 hover:border-cyan-500/20 hover:bg-white/80 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:bg-slate-900"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 p-2.5 text-white shadow-lg">
                          <FiRefreshCw className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            Retention Design
                          </p>

                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Memory & revision intelligence
                          </p>
                        </div>
                      </div>

                      <FiArrowRight className="text-slate-400 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>

                    <Link
                      to="/test/practice"
                      className="group flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/60 p-4 shadow-sm backdrop-blur-xl transition-all duration-300 hover:border-violet-500/20 hover:bg-white/80 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:bg-slate-900"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 p-2.5 text-white shadow-lg">
                          <FiBookOpen className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            Adaptive Practice
                          </p>

                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Smart AI-driven sessions
                          </p>
                        </div>
                      </div>

                      <FiArrowRight className="text-slate-400 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CORE FEATURES */}
      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight">
              Smart AI Learning Features
            </h2>

            <p className="mt-5 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              Built around adaptive intelligence, retention science, course
              ecosystems, and deep analytics for both students and educators.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {coreFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="group rounded-[2rem] border border-white/20 bg-white/70 p-7 shadow-[0_12px_40px_rgba(124,58,237,0.08)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl dark:border-slate-800 dark:bg-slate-900/70"
              >
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-r ${feature.gradient} text-white shadow-xl`}
                >
                  <feature.icon className="h-7 w-7" />
                </div>

                <h3 className="mt-7 text-xl font-bold">{feature.title}</h3>

                <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-400">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ARCHITECTURE LINKS */}
      <section className="py-24 bg-white/40 dark:bg-slate-900/40">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            {architectureLinks.map((item) => (
              <Link
                key={item.title}
                to={item.to}
                className="group relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/70 p-8 shadow-[0_15px_60px_rgba(124,58,237,0.12)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl dark:border-slate-800 dark:bg-slate-900/70"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-10`}
                />

                <div
                  className={`inline-flex rounded-2xl bg-gradient-to-r ${item.gradient} p-4 text-white shadow-lg`}
                >
                  <item.icon className="h-6 w-6" />
                </div>

                <h3 className="mt-6 text-2xl font-bold">{item.title}</h3>

                <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-400">
                  {item.subtitle}
                </p>

                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-purple-600 dark:text-purple-400">
                  Explore Design
                  <FiArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* DASHBOARDS */}
      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight">
              Smart Dashboards & Learning Spaces
            </h2>

            <p className="mt-5 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              Dedicated intelligent workspaces for students, teachers, and
              retention-focused learning analysis.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {workspaceLinks.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="group rounded-[1.8rem] border border-white/30 bg-white/75 p-6 shadow-[0_12px_40px_rgba(124,58,237,0.1)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl dark:border-slate-800 dark:bg-slate-900/75"
              >
                <div
                  className={`inline-flex rounded-2xl bg-gradient-to-r ${item.gradient} p-3.5 text-white shadow-xl`}
                >
                  <item.icon className="h-6 w-6" />
                </div>

                <h3 className="mt-5 text-xl font-bold sm:text-2xl">
                  {item.title}
                </h3>

                <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-400">
                  {item.desc}
                </p>

                <Link
                  to={item.to}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl border border-purple-200/70 bg-purple-50/80 px-4 py-2.5 text-sm font-semibold text-purple-700 transition-all duration-300 hover:gap-3 hover:border-purple-300 hover:bg-purple-100 dark:border-purple-900/60 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/40"
                >
                  {item.cta}
                  <FiArrowRight />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-fuchsia-500 via-purple-600 to-cyan-500 px-8 py-16 shadow-[0_20px_80px_rgba(124,58,237,0.3)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.15),transparent_35%)]" />

            <div className="relative mx-auto max-w-3xl text-center text-white">
              <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
                Build The Future Of Intelligent Learning
              </h2>

              <p className="mt-6 text-lg leading-relaxed text-purple-100">
                Adaptive intelligence, retention-focused learning, teacher
                ecosystems, analytics dashboards, and AI-driven education —
                unified inside one modern platform.
              </p>

              <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-7 py-4 text-sm font-semibold text-slate-900 shadow-lg transition-all duration-300 hover:scale-[1.03]"
                >
                  Launch Dashboard
                </Link>

                <Link
                  to="/design/adaptive"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-7 py-4 text-sm font-semibold text-white backdrop-blur-xl transition-all duration-300 hover:bg-white/20"
                >
                  Explore Design
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
