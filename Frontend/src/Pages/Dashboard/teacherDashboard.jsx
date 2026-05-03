import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import {
  FiHome,
  FiUsers,
  FiSettings,
  FiLogOut,
  FiBook,
  FiMenu,
  FiX,
  FiBell,
  FiAward,
} from "react-icons/fi";

import AlertMessage from "../../components/AlertMessage";
import { useAuth } from "../../context/authContext";
import DashboardOverview from "./components/DashboardOverview";
import ManageProfile from "./components/ManageProfile";
import ManageCourses from "./components/ManageCourses";
import MyEnrollments from "./components/MyEnrollments";
import MyCourses from "./components/MyCourses";
import SettingsPanel from "./components/SettingsPanel";
import QuestionBankManager from "./components/questionBankManager";
import { FiBarChart2 } from "react-icons/fi";
import StudentAnalytics from "./components/StudentAnalytics";

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(null); // ADDED
  const [alert, setAlert] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "success",
  });

  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });

  const navItems = [
    {
      icon: <FiHome className="text-lg" />,
      label: "Dashboard",
      value: "dashboard",
    },
    {
      icon: <FiUsers className="text-lg" />,
      label: "Manage Profile",
      value: "profile",
    },
    {
      icon: <FiBook className="text-lg" />,
      label: "Manage Courses",
      value: "courses",
    },
    {
      icon: <FiUsers className="text-lg" />,
      label: "My Enrollments",
      value: "enrollments",
    },
    {
      icon: <FiBarChart2 className="text-lg" />,
      label: "Student Analytics",
      value: "student-analytics",
    },
    {
      icon: <FiAward className="text-lg" />,
      label: "My Courses",
      value: "my-courses",
    },
    {
      icon: <FiSettings className="text-lg" />,
      label: "Settings",
      value: "settings",
    },
    {
      icon: <FiBook className="text-lg" />,
      label: "Question Bank",
      value: "question-bank",
    },
  ];

  const handleLogout = async () => {
    try {
      setAlert({
        isOpen: true,
        title: "Logging Out",
        message: "You are being logged out...",
        type: "info",
      });
      await logout();
      navigate("/auth", { replace: true });
    } catch (error) {
      setAlert({
        isOpen: true,
        title: "Error",
        message: "Failed to logout",
        type: "error",
      });
    }
  };

  const renderMainContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardOverview />;
      case "profile":
        return <ManageProfile />;
      case "courses":
        return <ManageCourses />;
      case "enrollments":
        return <MyEnrollments />;
      case "my-courses":
        return <MyCourses />;
      case "settings":
        return <SettingsPanel />;
      case "question-bank":
        return <QuestionBankManager courseId={selectedCourseId} />;
      case "student-analytics":
        return <StudentAnalytics />;
        
      default:
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 flex items-center justify-center h-96">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              Select a menu item to view content
            </p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <AlertMessage
        isOpen={alert.isOpen}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onClose={() => setAlert((prev) => ({ ...prev, isOpen: false }))}
      />

      {isMobile && (
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {showMobileMenu ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>
      )}

      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="h-16 flex items-center justify-center border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Teacher Hub
          </h1>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.value}
              onClick={() => {
                setActiveTab(item.value);
                setShowMobileMenu(false);
              }}
              className={`w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
                activeTab === item.value
                  ? "bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 text-indigo-600 dark:text-indigo-300 font-semibold border-l-4 border-indigo-600 dark:border-indigo-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
              }`}
            >
              <span className="mr-3">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center space-x-3 mb-4 p-2 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.charAt(0).toUpperCase() || "T"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                {user?.name || "Teacher"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.email || "teacher@example.com"}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors font-medium text-sm"
          >
            <FiLogOut className="mr-2" size={18} />
            Logout
          </button>
        </div>
      </aside>

      {isMobile && showMobileMenu && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowMobileMenu(false)}
          />
          <aside className="absolute left-0 top-0 h-screen w-64 bg-white dark:bg-gray-800 shadow-lg overflow-y-auto">
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Teacher Hub
              </h1>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FiX size={24} />
              </button>
            </div>

            <nav className="p-4 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.value}
                  onClick={() => {
                    setActiveTab(item.value);
                    setShowMobileMenu(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${
                    activeTab === item.value
                      ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 font-semibold"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors font-medium"
              >
                <FiLogOut className="mr-2" />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-auto flex flex-col">
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 md:px-8 shadow-sm">
          <div className="flex items-center gap-4">
            {isMobile && (
              <span className="text-sm font-semibold text-gray-800 dark:text-white capitalize">
                {activeTab === "question-bank"
                  ? selectedCourseId
                    ? "Question Bank"
                    : "Select Course"
                  : navItems.find((item) => item.value === activeTab)?.label ||
                    "Dashboard"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 relative">
              <FiBell className="text-gray-600 dark:text-gray-300" size={20} />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {!isMobile && (
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Welcome back, {user?.name?.split(" ")[0] || "Teacher"}!
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    {activeTab === "question-bank" && selectedCourseId
                      ? "Manage questions and topics for your course"
                      : activeTab === "question-bank"
                        ? "Select a course to manage its question bank"
                        : "Manage your courses, profile, and track your teaching performance"}
                  </p>
                </div>
                {/* {activeTab === "question-bank" && selectedCourseId && (
                  <button
                    onClick={() => {
                      setSelectedCourseId(null);
                      setActiveTab("my-courses");
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                  >
                    <FiBook className="w-4 h-4" />
                    Change Course
                  </button>
                )} */}
              </div>
            </div>
          )}

          <div className="space-y-6">{renderMainContent()}</div>
        </div>
      </main>
    </div>
  );
};

export default TeacherDashboard;
