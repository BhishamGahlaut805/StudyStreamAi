import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiZap,
  FiTrendingUp,
  FiShield,
  FiUsers,
  FiBookOpen,
  FiBarChart2,
} from "react-icons/fi";

const Home = () => {
  const features = [
    {
      icon: FiZap,
      title: "Adaptive Learning",
      description:
        "AI-powered tests that adapt to your skill level in real-time",
    },
    {
      icon: FiTrendingUp,
      title: "Performance Analytics",
      description:
        "Deep insights into your strengths, weaknesses, and progress",
    },
    {
      icon: FiShield,
      title: "Stress Detection",
      description: "Smart burnout prevention with real-time stress monitoring",
    },
    {
      icon: FiUsers,
      title: "Personalized Path",
      description: "Custom study plans tailored to your learning style",
    },
    {
      icon: FiBookOpen,
      title: "Practice Mode",
      description: "Endless practice with intelligent difficulty adjustment",
    },
    {
      icon: FiBarChart2,
      title: "Serious Tests",
      description: "Real exam simulations with behavioral tracking",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-dark-100 dark:text-gray-100">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary-600/20 blur-3xl"></div>
          <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl"></div>
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <span className="mb-6 inline-flex rounded-full border border-primary-400/40 bg-primary-500/10 px-4 py-1 text-sm font-medium text-primary-700 dark:border-primary-400/30 dark:text-primary-200">
              Smart learning for ambitious students
            </span>
            <h1 className="mb-6 text-5xl font-bold text-slate-900 md:text-6xl dark:text-white">
              Master Any Subject with
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-primary-800">
                AI-Powered Intelligence
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-3xl text-xl text-slate-600 dark:text-slate-300">
              Experience the future of learning with adaptive tests, real-time
              stress monitoring, and personalized study paths powered by
              advanced AI.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/auth"
                className="rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-8 py-3 font-semibold text-white shadow-lg shadow-primary-800/30 transition hover:scale-105 hover:from-primary-500 hover:to-primary-600"
              >
                Start Learning
              </Link>
              <Link
                to="/auth"
                className="rounded-xl border border-slate-300 bg-white px-8 py-3 font-semibold text-slate-700 transition hover:scale-105 hover:border-primary-400/60 dark:border-slate-600 dark:bg-dark-200 dark:text-slate-100"
              >
                Learn More
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-slate-50 py-20 dark:bg-dark-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="mb-4 text-3xl font-bold text-slate-900 dark:text-white">
              Why Choose StudyStreamAI?
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Intelligent features designed to optimize your learning experience
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="gradient-border rounded-2xl bg-white/80 p-6 shadow-lg shadow-slate-200/70 transition-all duration-300 hover:-translate-y-1 hover:bg-white dark:bg-dark-200/70 dark:shadow-black/20 dark:hover:bg-dark-200"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-500/15">
                  <feature.icon className="h-6 w-6 text-primary-600 dark:text-primary-300" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
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

      {/* CTA Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="gradient-border overflow-hidden rounded-3xl bg-gradient-to-r from-primary-700/70 to-primary-900/80 px-8 py-14 shadow-xl shadow-primary-900/30"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Transform Your Learning?
            </h2>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              Join thousands of students who are already mastering subjects with
              AI
            </p>
            <Link
              to="/auth"
              className="inline-block rounded-xl bg-white px-8 py-3 font-semibold text-primary-700 transition hover:scale-105 hover:bg-slate-100 dark:bg-slate-100"
            >
              Get Started Free
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;
