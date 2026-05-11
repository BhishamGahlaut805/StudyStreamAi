import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { useTheme } from "../context/ThemeContext";
import {
  FiHome,
  FiBook,
  FiBarChart2,
  FiUser,
  FiLogOut,
  FiMoon,
  FiSun,
  FiMenu,
  FiX,
  FiBell,
  FiGrid,
  FiCalendar,
  FiTarget,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  const navItems = [
    { name: "Home", path: "/", icon: FiHome },
    {
      name: "Practice",
      path: "/test/practice",
      icon: FiTarget,
      requiresAuth: true,
    },
    {
      name: "Retention",
      path: "/retention/start",
      icon: FiCalendar,
      requiresAuth: true,
    },
    {
      name: "Analytics",
      path: "/dashboard",
      icon: FiBarChart2,
      requiresAuth: true,
    },
  ];

  const filteredNavItems = navItems.filter(
    (item) => !item.requiresAuth || isAuthenticated,
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md shadow-sm dark:border-white/10 dark:bg-dark-200/85">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex h-14 sm:h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0">
            <Link
              to="/"
              className="flex items-center space-x-1 sm:space-x-2 group"
            >
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 shadow-md transition-all duration-300 group-hover:scale-105">
                <span className="text-lg sm:text-xl font-bold text-white">
                  S
                </span>
              </div>
              <span className="hidden sm:inline text-base sm:text-xl font-bold text-slate-900 dark:text-white">
                StudyStream
                <span className="text-transparent bg-gradient-to-r from-cyan-600 to-indigo-600 bg-clip-text">
                  AI
                </span>
              </span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center space-x-1">
            {filteredNavItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className="rounded-lg px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-indigo-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-dark-300 dark:hover:text-cyan-300"
              >
                <div className="flex items-center space-x-1 sm:space-x-1.5">
                  <item.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.name}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Right icons */}
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={toggleTheme}
              className="rounded-full p-1.5 sm:p-2 text-slate-500 transition-all duration-200 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-indigo-50 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-dark-300 dark:hover:text-cyan-300"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <FiSun className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
              ) : (
                <FiMoon className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </button>

            {isAuthenticated && (
              <button className="relative rounded-full p-1.5 sm:p-2 text-slate-500 transition-all duration-200 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-indigo-50 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-dark-300 dark:hover:text-cyan-300">
                <FiBell className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-dark-200"></span>
              </button>
            )}

            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-2 rounded-full p-0.5 sm:p-1 transition-all duration-200 hover:ring-2 hover:ring-cyan-400"
                >
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-xs sm:text-sm font-semibold text-white">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}
                </button>

                <AnimatePresence>
                  {showProfileMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 z-50 mt-1 w-40 sm:w-48 rounded-xl border border-slate-200 bg-white/90 py-1 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-dark-200/90"
                    >
                      <Link
                        to="/profile"
                        className="block px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-700 hover:bg-cyan-50 dark:text-slate-200 dark:hover:bg-dark-300"
                        onClick={() => setShowProfileMenu(false)}
                      >
                        <div className="flex items-center space-x-2">
                          <FiUser className="h-4 w-4" />
                          <span>Profile</span>
                        </div>
                      </Link>
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          handleLogout();
                        }}
                        className="block w-full px-3 sm:px-4 py-2 text-left text-xs sm:text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-dark-300"
                      >
                        <div className="flex items-center space-x-2">
                          <FiLogOut className="h-4 w-4" />
                          <span>Logout</span>
                        </div>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                to="/auth"
                className="hidden sm:block rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-3 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg whitespace-nowrap"
              >
                Sign In
              </Link>
            )}

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-md p-1.5 sm:p-2 text-slate-600 transition-all hover:bg-cyan-50 dark:text-slate-300 dark:hover:bg-dark-300 lg:hidden"
            >
              {isOpen ? (
                <FiX className="h-5 w-5 sm:h-6 sm:w-6" />
              ) : (
                <FiMenu className="h-5 w-5 sm:h-6 sm:w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-dark-200 lg:hidden"
          >
            <div className="space-y-1 px-3 sm:px-4 py-2 sm:py-3">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className="flex items-center space-x-2 rounded-md px-3 py-2 text-sm sm:text-base font-medium text-slate-700 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-indigo-50 hover:text-indigo-600 dark:text-slate-200 dark:hover:bg-dark-300"
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              ))}

              {!isAuthenticated && (
                <Link
                  to="/auth"
                  className="block sm:hidden rounded-md px-3 py-2 text-sm font-medium text-center bg-gradient-to-r from-cyan-600 to-indigo-600 text-white hover:shadow-lg transition-all mt-2"
                  onClick={() => setIsOpen(false)}
                >
                  Sign In
                </Link>
              )}

              {isAuthenticated && (
                <>
                  <hr className="my-2 dark:border-slate-700" />
                  <Link
                    to="/profile"
                    className="flex items-center space-x-2 rounded-md px-3 py-2 text-sm sm:text-base font-medium text-slate-700 hover:bg-cyan-50 dark:text-slate-200 dark:hover:bg-dark-300"
                    onClick={() => setIsOpen(false)}
                  >
                    <FiUser className="h-5 w-5" />
                    <span>Profile</span>
                  </Link>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center space-x-2 rounded-md px-3 py-2 text-left text-sm sm:text-base font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-dark-300"
                  >
                    <FiLogOut className="h-5 w-5" />
                    <span>Logout</span>
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
