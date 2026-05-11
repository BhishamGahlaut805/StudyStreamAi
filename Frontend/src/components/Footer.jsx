import React from "react";
import { Link } from "react-router-dom";
import {
  FiGithub,
  FiTwitter,
  FiLinkedin,
  FiMail,
  FiHeart,
  FiCpu,
  FiShield,
  FiTrendingUp,
} from "react-icons/fi";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    Platform: [
      { name: "Adaptive Practice", path: "/test/practice" },
      { name: "Retention System", path: "/retention/start" },
      { name: "Dashboard", path: "/dashboard" },
      { name: "Design Architecture", path: "/design-architecture" },
    ],
    Resources: [
      { name: "Learning Links", path: "/learning-links" },
      { name: "Documentation", path: "/docs" },
      { name: "Support", path: "/support" },
      { name: "API Status", path: "/status" },
    ],
    Company: [
      { name: "About Us", path: "/about" },
      { name: "Mission", path: "/mission" },
      { name: "Privacy", path: "/privacy" },
      { name: "Terms", path: "/terms" },
    ],
  };

  const socialLinks = [
    { icon: FiGithub, href: "https://github.com", label: "GitHub" },
    { icon: FiTwitter, href: "https://twitter.com", label: "Twitter" },
    { icon: FiLinkedin, href: "https://linkedin.com", label: "LinkedIn" },
    { icon: FiMail, href: "mailto:hello@studystream.ai", label: "Email" },
  ];

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white/80 backdrop-blur-sm dark:border-white/10 dark:bg-dark-200/80">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="py-8 sm:py-12">
          <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-5">
            {/* Brand Column */}
            <div className="lg:col-span-2">
              <div className="flex items-center space-x-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 shadow-md flex-shrink-0">
                  <span className="text-xl font-bold text-white">S</span>
                </div>
                <span className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white line-clamp-1">
                  StudyStream
                  <span className="bg-gradient-to-r from-cyan-600 to-indigo-600 bg-clip-text text-transparent">
                    AI
                  </span>
                </span>
              </div>
              <p className="mt-3 sm:mt-4 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                AI-powered adaptive learning platform that personalizes
                practice, optimizes retention, and helps students achieve
                mastery faster without burnout.
              </p>
              <div className="mt-3 sm:mt-4 flex space-x-3">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-1.5 sm:p-2 text-slate-500 transition-all duration-200 hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-400 dark:hover:bg-dark-300 dark:hover:text-cyan-300"
                    aria-label={social.label}
                  >
                    <social.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Link Columns */}
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h3 className="mb-3 sm:mb-4 text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-white">
                  {title}
                </h3>
                <ul className="space-y-1.5 sm:space-y-2">
                  {links.map((link) => (
                    <li key={link.name}>
                      <Link
                        to={link.path}
                        className="text-xs sm:text-sm text-slate-500 transition-colors duration-200 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-300 line-clamp-2"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom Bar */}
          <div className="mt-6 sm:mt-8 border-t border-slate-200 pt-4 sm:pt-6 dark:border-white/10">
            <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 text-center sm:flex-col md:flex-row md:justify-between md:text-left">
              <div className="flex flex-col items-center md:items-start gap-2 sm:gap-1 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center space-x-1 justify-center md:justify-start flex-wrap">
                  <span className="whitespace-nowrap">
                    © {currentYear} StudyStreamAI.
                  </span>
                  <span className="hidden sm:inline">Made with</span>
                  <FiHeart className="h-3 w-3 text-rose-500 flex-shrink-0" />
                  <span className="hidden sm:inline">for better learning.</span>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 md:gap-3 text-xs">
                <Link
                  to="/privacy"
                  className="text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-300 whitespace-nowrap"
                >
                  Privacy
                </Link>
                <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">
                  •
                </span>
                <Link
                  to="/terms"
                  className="text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-300 whitespace-nowrap"
                >
                  Terms
                </Link>
                <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">
                  •
                </span>
                <Link
                  to="/cookies"
                  className="text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-300 whitespace-nowrap"
                >
                  Cookies
                </Link>
                <span className="text-slate-300 dark:text-slate-600 hidden md:inline">
                  •
                </span>
                <span className="flex items-center gap-1 text-slate-500 whitespace-nowrap">
                  <FiShield className="h-3 w-3 flex-shrink-0" />
                  <span className="hidden md:inline">Secure</span>
                </span>
                <span className="text-slate-300 dark:text-slate-600 hidden md:inline">
                  •
                </span>
                <span className="flex items-center gap-1 text-slate-500 whitespace-nowrap">
                  <FiTrendingUp className="h-3 w-3 flex-shrink-0" />
                  <span className="hidden md:inline">24/7 AI</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
