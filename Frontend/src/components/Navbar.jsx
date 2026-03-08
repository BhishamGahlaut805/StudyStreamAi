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
    { name: "Practice", path: "/practice", icon: FiBook, requiresAuth: true },
    {
      name: "Analytics",
      path: "/analytics",
      icon: FiBarChart2,
      requiresAuth: true,
    },
  ];

  const filteredNavItems = navItems.filter(
    (item) => !item.requiresAuth || isAuthenticated,
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-dark-200/85">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and brand */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">S</span>
              </div>
              <span className="font-bold text-xl text-slate-900 dark:text-white">
                StudyStreamAI
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {filteredNavItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-indigo-50 hover:text-primary-600 dark:text-slate-300 dark:hover:bg-dark-300 dark:hover:text-primary-300"
              >
                <div className="flex items-center space-x-1">
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Right side icons */}
          <div className="flex items-center space-x-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-primary-600 dark:text-slate-400 dark:hover:bg-dark-300 dark:hover:text-primary-300"
              aria-label={
                isDark ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {isDark ? (
                <FiSun className="w-5 h-5 text-amber-400" />
              ) : (
                <FiMoon className="w-5 h-5" />
              )}
            </button>

            {/* Notifications (if authenticated) */}
            {isAuthenticated && (
              <button className="relative rounded-full p-2 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-primary-600 dark:text-slate-400 dark:hover:bg-dark-300 dark:hover:text-primary-300">
                <FiBell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
            )}

            {/* User menu */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-2 rounded-full p-2 transition-colors hover:bg-indigo-50 dark:hover:bg-dark-300"
                >
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {user?.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </button>

                <AnimatePresence>
                  {showProfileMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 z-50 mt-2 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-dark-200"
                    >
                      <Link
                        to="/profile"
                        className="block px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 dark:text-slate-200 dark:hover:bg-dark-300"
                        onClick={() => setShowProfileMenu(false)}
                      >
                        <div className="flex items-center space-x-2">
                          <FiUser className="w-4 h-4" />
                          <span>Profile</span>
                        </div>
                      </Link>
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          handleLogout();
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-dark-300"
                      >
                        <div className="flex items-center space-x-2">
                          <FiLogOut className="w-4 h-4" />
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
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500"
              >
                Sign In
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-md p-2 text-slate-600 transition-colors hover:bg-indigo-50 dark:text-slate-300 dark:hover:bg-dark-300 md:hidden"
            >
              {isOpen ? (
                <FiX className="w-6 h-6" />
              ) : (
                <FiMenu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-slate-200 bg-white md:hidden dark:border-slate-700 dark:bg-dark-200"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className="block rounded-md px-3 py-2 text-base font-medium text-slate-700 hover:bg-indigo-50 hover:text-primary-600 dark:text-slate-200 dark:hover:bg-dark-300 dark:hover:text-primary-300"
                  onClick={() => setIsOpen(false)}
                >
                  <div className="flex items-center space-x-2">
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </div>
                </Link>
              ))}
              {isAuthenticated ? (
                <>
                  <Link
                    to="/profile"
                    className="block rounded-md px-3 py-2 text-base font-medium text-slate-700 hover:bg-indigo-50 hover:text-primary-600 dark:text-slate-200 dark:hover:bg-dark-300 dark:hover:text-primary-300"
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="flex items-center space-x-2">
                      <FiUser className="w-5 h-5" />
                      <span>Profile</span>
                    </div>
                  </Link>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      handleLogout();
                    }}
                    className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-dark-300"
                  >
                    <div className="flex items-center space-x-2">
                      <FiLogOut className="w-5 h-5" />
                      <span>Logout</span>
                    </div>
                  </button>
                </>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
