import React from "react";
import { Link } from "react-router-dom";
import {
  FiGithub,
  FiTwitter,
  FiLinkedin,
  FiMail,
  FiHeart,
} from "react-icons/fi";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    Product: [
      { name: "Features", path: "/features" },
      { name: "Pricing", path: "/pricing" },
      { name: "Testimonials", path: "/testimonials" },
      { name: "FAQ", path: "/faq" },
    ],
    Resources: [
      { name: "Blog", path: "/blog" },
      { name: "Documentation", path: "/docs" },
      { name: "Guides", path: "/guides" },
      { name: "Support", path: "/support" },
    ],
    Company: [
      { name: "About", path: "/about" },
      { name: "Careers", path: "/careers" },
      { name: "Privacy", path: "/privacy" },
      { name: "Terms", path: "/terms" },
    ],
  };

  const socialLinks = [
    { icon: FiGithub, href: "https://github.com", label: "GitHub" },
    { icon: FiTwitter, href: "https://twitter.com", label: "Twitter" },
    { icon: FiLinkedin, href: "https://linkedin.com", label: "LinkedIn" },
    { icon: FiMail, href: "mailto:contact@StudyStreamAI.com", label: "Email" },
  ];

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white dark:border-white/10 dark:bg-dark-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main footer content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand section */}
          <div className="col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">S</span>
              </div>
              <span className="font-bold text-xl text-slate-900 dark:text-white">
                StudyStreamAI
              </span>
            </div>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              Revolutionizing learning with AI-powered adaptive testing and
              personalized study experiences.
            </p>
            {/* Social links */}
            <div className="flex space-x-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 transition-colors hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-300"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links sections */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title} className="col-span-1">
              <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">
                {title}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.path}
                      className="text-sm text-slate-600 transition-colors hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-300"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-200 pt-8 dark:border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="flex items-center text-sm text-slate-500 dark:text-slate-400">
              © {currentYear} StudyStreamAI. Made with
              <FiHeart className="w-4 h-4 mx-1 text-red-500" />
              for better learning
            </p>
            <div className="flex space-x-6 text-sm">
              <Link
                to="/privacy"
                className="text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-300"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-300"
              >
                Terms
              </Link>
              <Link
                to="/cookies"
                className="text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-300"
              >
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
