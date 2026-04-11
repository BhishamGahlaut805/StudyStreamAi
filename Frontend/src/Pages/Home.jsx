import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiActivity,
  FiArrowRight,
  FiBarChart2,
  FiBookOpen,
  FiAirplay as FiBrain,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiDatabase,
  FiGitBranch,
  FiLayers,
  FiShield,
  FiZap,
  FiTrendingUp,
  FiTarget,
  FiUsers,
} from "react-icons/fi";

const Home = () => {
  const studentFeatures = [
    {
      icon: FiZap,
      title: "Adaptive Difficulty",
      description:
        "Questions adjust instantly to match your skill level, keeping you challenged but never overwhelmed.",
      accent: "from-cyan-500 to-sky-600",
    },
    {
      icon: FiTarget,
      title: "Real Exam Simulations",
      description:
        "Practice under real exam conditions with timed tests, detailed scoring, and performance insights.",
      accent: "from-orange-500 to-amber-600",
    },
    {
      icon: FiCalendar,
      title: "Smart Revision Scheduling",
      description:
        "Automatically tells you when to review topics for maximum retention and lasting memory.",
      accent: "from-emerald-500 to-lime-600",
    },
    {
      icon: FiBarChart2,
      title: "Deep Analytics & Insights",
      description:
        "Understand your strengths, weaknesses, and progress with crystal-clear charts and recommendations.",
      accent: "from-violet-500 to-purple-600",
    },
  ];

  const studentBenefits = [
    {
      title: "Study Smarter, Not Harder",
      text: "AI adapts to your pace and learning style, removing guesswork and wasted time on topics you already know.",
    },
    {
      title: "Never Forget What You Learn",
      text: "Our intelligent revision scheduler reminds you exactly when to review for perfect memory retention.",
    },
    {
      title: "Beat Burnout & Stay Healthy",
      text: "We monitor your focus and stress levels, automatically adjusting intensity to keep study sustainable and enjoyable.",
    },
  ];

  const functionalRoutes = [
    {
      icon: FiBookOpen,
      title: "Practice Setup",
      subtitle: "Start adaptive practice journey",
      to: "/test/practice",
      style:
        "from-cyan-500/20 via-sky-500/15 to-transparent border-cyan-300/60",
      buttonClass: "bg-cyan-600 hover:bg-cyan-700",
    },
    {
      icon: FiActivity,
      title: "Practice Interface",
      subtitle: "Live question flow and tracking",
      to: "/test/interface",
      style:
        "from-indigo-500/20 via-blue-500/15 to-transparent border-indigo-300/60",
      buttonClass: "bg-indigo-600 hover:bg-indigo-700",
    },
    {
      icon: FiTarget,
      title: "Real Exam Interface",
      subtitle: "Serious timed exam simulation",
      to: "/test/real/interface",
      style:
        "from-orange-500/20 via-amber-500/15 to-transparent border-orange-300/60",
      buttonClass: "bg-orange-600 hover:bg-orange-700",
    },
    {
      icon: FiCalendar,
      title: "Retention Start",
      subtitle: "Begin spaced-learning session",
      to: "/retention/start",
      style:
        "from-emerald-500/20 via-teal-500/15 to-transparent border-emerald-300/60",
      buttonClass: "bg-emerald-600 hover:bg-emerald-700",
    },
    {
      icon: FiBarChart2,
      title: "Retention Analytics",
      subtitle: "Inspect deep retention insights",
      to: "/retention/analytics",
      style:
        "from-fuchsia-500/20 via-violet-500/15 to-transparent border-fuchsia-300/60",
      buttonClass: "bg-violet-600 hover:bg-violet-700",
    },
    {
      icon: FiUsers,
      title: "Student Dashboard",
      subtitle: "View progress and learning status",
      to: "/dashboard",
      style:
        "from-rose-500/20 via-pink-500/15 to-transparent border-rose-300/60",
      buttonClass: "bg-rose-600 hover:bg-rose-700",
    },
  ];

  const howItWorks = [
    "📝 You answer practice questions and take real exams.",
    "⚡ Our AI analyzes your answers, speed, and confidence in real time.",
    "🎯 We instantly adjust difficulty to keep you in the learning sweet spot.",
    "📊 Your dashboard shows clear insights about what to focus on next.",
    "🔄 Smart reminders tell you exactly when to review for lasting memory.",
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-dark-100 dark:text-gray-100">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_20%_20%,#cffafe_0%,transparent_36%),radial-gradient(circle_at_80%_0%,#fef3c7_0%,transparent_34%)] dark:bg-[radial-gradient(circle_at_20%_20%,#083344_0%,transparent_34%),radial-gradient(circle_at_80%_0%,#3f1d0a_0%,transparent_34%)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/30 blur-3xl"></div>
          <div className="absolute right-0 top-12 h-64 w-64 rounded-full bg-amber-500/20 blur-3xl"></div>
          <div className="absolute bottom-0 left-12 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl"></div>
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <span className="mb-6 inline-flex rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 py-1 text-sm font-semibold text-cyan-700 dark:border-cyan-400/30 dark:text-cyan-200">
              Smart Learning Powered by AI
            </span>
            <h1 className="mb-5 text-4xl font-black leading-tight text-slate-900 sm:text-5xl md:text-6xl dark:text-white">
              StudyStream AI
              <span className="block bg-gradient-to-r from-cyan-600 via-indigo-600 to-emerald-600 bg-clip-text text-transparent">
                Adaptive Practice, Real Exams, Retention Intelligence
              </span>
            </h1>
            <p className="mx-auto mb-8 max-w-4xl text-base text-slate-700 sm:text-lg dark:text-slate-200">
              Master any subject with AI-powered adaptive tests, real exam
              simulations, and intelligent revision scheduling. Get personalized
              insights, prevent burnout, and actually remember what you learn.
              Study smarter, perform better, succeed faster.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-7 py-3 font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:scale-[1.03]"
              >
                Open Dashboard <FiArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/auth"
                className="rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-700 transition hover:scale-[1.03] hover:border-cyan-400/60 dark:border-slate-600 dark:bg-dark-200 dark:text-slate-100"
              >
                Sign In / Register
              </Link>
              <Link
                to="/retention/start"
                className="rounded-xl border border-emerald-400/50 bg-emerald-500/10 px-7 py-3 font-semibold text-emerald-700 transition hover:scale-[1.03] dark:text-emerald-200"
              >
                Start Retention Flow
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-10 text-center"
          >
            <h2 className="mb-3 text-3xl font-black text-slate-900 dark:text-white">
              Features Built for You
            </h2>
            <p className="text-slate-600 dark:text-slate-300">
              Everything you need to study effectively, remember longer, and
              achieve your best results.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {studentFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                <div
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.accent} text-white`}
                >
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-300">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              Why Students Love Us
            </h2>
            <div className="mt-4 space-y-3">
              {studentBenefits.map((benefit) => (
                <div
                  key={benefit.title}
                  className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"
                >
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <FiCheckCircle className="h-5 w-5 text-emerald-500" />
                    {benefit.title}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {benefit.text}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="rounded-3xl bg-gradient-to-br from-indigo-600 via-cyan-600 to-emerald-600 p-6 text-white shadow-xl"
          >
            <h2 className="text-2xl font-black">How It Works</h2>
            <p className="mt-2 text-sm text-indigo-50">
              A simple, powerful journey from each question to mastery.
            </p>
            <ol className="mt-4 space-y-3">
              {howItWorks.map((step, idx) => (
                <li
                  key={step}
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium"
                >
                  <span className="mr-2 text-base">{step.charAt(0)}</span>
                  {step.substring(2)}
                </li>
              ))}
            </ol>
          </motion.div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">
              Navigate to Core Functionalities
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Jump directly into your learning workflow from setup to analytics.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {functionalRoutes.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
                className={`rounded-2xl border bg-gradient-to-br p-5 ${item.style} dark:border-slate-700 dark:from-slate-800/70 dark:via-slate-900/70 dark:to-slate-900`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {item.subtitle}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-2 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                    <item.icon className="h-5 w-5" />
                  </div>
                </div>
                <Link
                  to={item.to}
                  className={`mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${item.buttonClass}`}
                >
                  Open <FiArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-700 via-indigo-700 to-violet-700 px-8 py-12 text-white shadow-xl"
          >
            <h2 className="text-3xl font-black md:text-4xl">Our Mission</h2>
            <p className="mt-3 max-w-3xl text-cyan-50">
              Deliver equitable, adaptive, and retention-driven learning support
              at scale so every student gets personalized guidance, healthier
              study rhythm, and stronger long-term outcomes.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full bg-white/20 px-4 py-1 text-sm font-medium">
                <FiShield className="mr-1 inline h-4 w-4" /> Secure by design
              </span>
              <span className="rounded-full bg-white/20 px-4 py-1 text-sm font-medium">
                <FiTrendingUp className="mr-1 inline h-4 w-4" /> Explainable
                analytics
              </span>
              <span className="rounded-full bg-white/20 px-4 py-1 text-sm font-medium">
                <FiClock className="mr-1 inline h-4 w-4" /> Smarter revision
                timing
              </span>
              <span className="rounded-full bg-white/20 px-4 py-1 text-sm font-medium">
                <FiZap className="mr-1 inline h-4 w-4" /> Real-time adaptation
              </span>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;
