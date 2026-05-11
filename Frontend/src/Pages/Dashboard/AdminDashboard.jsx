import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  FiUsers,
  FiBookOpen,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiCheck,
  FiTrash2,
  FiFilter,
  FiRefreshCw,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiMail,
  FiMenu,
  FiX,
  FiHome,
  FiSettings,
  FiUser,
  FiShield,
  FiBell,
  FiBarChart2,
  FiLogOut,
  FiMoon,
  FiGlobe,
  FiLock,
  FiSave,
  FiCalendar,
  FiLayers,
  FiBarChart,
} from "react-icons/fi";
import adminService from "../../services/adminService";
import profileService from "../../services/profileService";
import ProfileComponent from "../../components/profileComponent";
import { useAuth } from "../../context/authContext";

const initialPreferences = {
  emailAlerts: true,
  securityDigest: true,
  allowTeacherSelfApproval: false,
  smartInsights: true,
  maintenanceMode: false,
};

const initialSecurity = {
  forceMfa: true,
  sessionTimeout: "30",
  passwordRotationDays: "90",
  geoBlocking: false,
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [courses, setCourses] = useState([]);
  const [courseSummary, setCourseSummary] = useState({});
  const [coursePage, setCoursePage] = useState(1);
  const [coursePages, setCoursePages] = useState(1);
  const [courseTotal, setCourseTotal] = useState(0);
  const [coursePageSize, setCoursePageSize] = useState(8);
  const [courseSearchTerm, setCourseSearchTerm] = useState("");
  const [courseStatusFilter, setCourseStatusFilter] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedCourseAnalytics, setSelectedCourseAnalytics] = useState(null);
  const [selectedCourseStudents, setSelectedCourseStudents] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [courseDetailsLoading, setCourseDetailsLoading] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [verifyingUserId, setVerifyingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [security, setSecurity] = useState(initialSecurity);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: user?.name || "Admin User",
    email: user?.email || "admin@studystream.ai",
    role: "Platform Administrator",
    department: "Academic Operations",
    phone: "+91 98XXXXXX10",
    bio: "Managing platform health, user onboarding, and teacher verification workflows.",
  });

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const response = await profileService.getMyProfile();
      const profile = response?.data || response || {};
      setProfileForm({
        fullName: profile.fullName || user?.name || "Admin User",
        email: user?.email || profile.additionalEmail || "admin@studystream.ai",
        role: user?.role || "Platform Administrator",
        department: profile.currentPosition || "Academic Operations",
        phone: profile.phoneNumber || profile.contactNumber || "+91 98XXXXXX10",
        bio:
          profile.bio ||
          profile.aboutMe ||
          "Managing platform health, user onboarding, and teacher verification workflows.",
      });
    } catch (err) {
      toast.error(err.message || "Failed to load admin profile");
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminService.getAllUsers(
        currentPage,
        pageSize,
        includeInactive,
      );
      setUsers(Array.isArray(response?.users) ? response.users : []);
      setTotalPages(Number(response?.pages) || 1);
      setTotalUsers(Number(response?.total) || 0);
    } catch (err) {
      setError(err.message || "Failed to fetch users");
      toast.error(err.message || "Failed to fetch users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, includeInactive]);

  const fetchCourses = useCallback(async () => {
    setCoursesLoading(true);
    setError("");
    try {
      const response = await adminService.getCourses({
        page: coursePage,
        limit: coursePageSize,
        search: courseSearchTerm || undefined,
        status: courseStatusFilter || undefined,
      });

      setCourses(Array.isArray(response?.courses) ? response.courses : []);
      setCoursePages(Number(response?.pages) || 1);
      setCourseTotal(Number(response?.total) || 0);
      setCourseSummary(response?.summary || {});

      if (response?.courses?.length > 0) {
        setSelectedCourseId(
          (current) =>
            current || response.courses[0].id || response.courses[0]._id,
        );
      }
    } catch (err) {
      setError(err.message || "Failed to fetch courses");
      toast.error(err.message || "Failed to fetch courses");
      setCourses([]);
      setCourseSummary({});
    } finally {
      setCoursesLoading(false);
    }
  }, [coursePage, coursePageSize, courseSearchTerm, courseStatusFilter]);

  const fetchSelectedCourse = useCallback(async (courseId) => {
    if (!courseId) return;
    setCourseDetailsLoading(true);
    try {
      const [analytics, students] = await Promise.all([
        adminService.getCourseAnalytics(courseId),
        adminService.getCourseStudents(courseId),
      ]);

      setSelectedCourseAnalytics(analytics || null);
      setSelectedCourseStudents(
        Array.isArray(students?.students) ? students.students : [],
      );
      setSelectedCourse({
        ...(analytics || {}),
        ...(students?.course || {}),
      });
    } catch (err) {
      toast.error(err.message || "Failed to load course details");
      setSelectedCourseAnalytics(null);
      setSelectedCourseStudents([]);
      setSelectedCourse(null);
    } finally {
      setCourseDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    if (activeSection === "courses" && selectedCourseId) {
      fetchSelectedCourse(selectedCourseId);
    }
  }, [activeSection, selectedCourseId, fetchSelectedCourse]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const filteredUsers = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();
    if (!searchLower) return users;
    return users.filter((item) => {
      const name = item?.name?.toLowerCase() || "";
      const email = item?.email?.toLowerCase() || "";
      const role = item?.role?.toLowerCase() || "";
      return (
        name.includes(searchLower) ||
        email.includes(searchLower) ||
        role.includes(searchLower)
      );
    });
  }, [users, searchTerm]);

  const stats = useMemo(
    () => ({
      totalUsers,
      verifiedUsers: users.filter((u) => u.isVerified).length,
      pendingUsers: users.filter((u) => !u.isVerified && u.role !== "student")
        .length,
      teacherCount: users.filter((u) => u.role === "teacher").length,
    }),
    [users, totalUsers],
  );

  const courseStats = useMemo(
    () => ({
      totalCourses: Number(courseSummary?.totalCourses || courseTotal || 0),
      totalEnrollments: Number(courseSummary?.totalEnrollments || 0),
      uniqueStudents: Number(courseSummary?.uniqueStudents || 0),
      publishedCourses: Number(courseSummary?.publishedCourses || 0),
    }),
    [courseSummary, courseTotal],
  );

  const filteredCourses = useMemo(() => {
    const query = courseSearchTerm.trim().toLowerCase();
    if (!query) return courses;
    return courses.filter((course) => {
      const title = course?.title?.toLowerCase() || "";
      const instructor = course?.instructor?.name?.toLowerCase() || "";
      const category = course?.category?.toLowerCase() || "";
      const status = course?.status?.toLowerCase() || "";
      return (
        title.includes(query) ||
        instructor.includes(query) ||
        category.includes(query) ||
        status.includes(query)
      );
    });
  }, [courses, courseSearchTerm]);

  const handleVerifyUser = async (userId) => {
    setVerifyingUserId(userId);
    try {
      const response = await adminService.verifyUser(userId);
      toast.success(response.message || "User verified");
      fetchUsers();
    } catch (err) {
      toast.error(err.message || "Could not verify user");
    } finally {
      setVerifyingUserId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmId) return;
    setDeletingUserId(deleteConfirmId);
    try {
      const response = await adminService.deleteUser(deleteConfirmId);
      toast.success(response.message || "User deleted");
      setShowDeleteConfirm(false);
      setDeleteConfirmId(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || "Could not delete user");
    } finally {
      setDeletingUserId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getRoleBadge = (role) => {
    const roleStyle = {
      admin: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
      teacher:
        "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
      student:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
    return (
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
          roleStyle[role] || roleStyle.student
        }`}
      >
        {role || "student"}
      </span>
    );
  };

  const getVerificationBadge = (isVerified, role) => {
    if (isVerified) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <FiCheckCircle className="h-3.5 w-3.5" />
          Verified
        </span>
      );
    }
    if (role !== "student") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <FiClock className="h-3.5 w-3.5" />
          Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        Auto
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const map = {
      published: "bg-emerald-100 text-emerald-800",
      draft: "bg-slate-100 text-slate-800",
      pending: "bg-amber-100 text-amber-800",
      rejected: "bg-rose-100 text-rose-800",
      archived: "bg-slate-50 text-slate-600",
    };
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${map[status] || "bg-slate-100 text-slate-800"}`}
      >
        {status || "draft"}
      </span>
    );
  };

  const navItems = [
    { id: "overview", label: "Overview", icon: FiHome },
    { id: "users", label: "User Control", icon: FiUsers },
    { id: "courses", label: "Course Analytics", icon: FiBookOpen },
    { id: "analytics", label: "Analytics", icon: FiBarChart2 },
    { id: "profile", label: "Profile", icon: FiUser },
    { id: "settings", label: "Settings", icon: FiSettings },
  ];

  const SectionButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => {
        setActiveSection(id);
        setSidebarOpen(false);
      }}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all ${
        activeSection === id
          ? "bg-white/80 text-sky-700 shadow-lg shadow-sky-500/20 dark:bg-slate-900/70 dark:text-sky-300"
          : "text-slate-700 hover:bg-white/50 dark:text-slate-300 dark:hover:bg-slate-900/40"
      }`}
      type="button"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  const renderOverview = () => (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-br from-sky-100 via-white to-indigo-100 p-6 shadow-xl shadow-sky-200/40 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950"
      >
        {/* Decorative Blobs */}
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/10" />
        <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-pink-300/20 blur-3xl dark:bg-indigo-500/10" />
        <div className="absolute left-0 top-1/2 h-28 w-28 rounded-full bg-cyan-200/30 blur-2xl dark:bg-cyan-500/10" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Content */}
          <div className="max-w-2xl">
            <p className="inline-flex items-center rounded-full bg-sky-200/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:bg-slate-800 dark:text-sky-300">
              Admin Command Center
            </p>

            <h1 className="mt-4 text-3xl font-black leading-tight text-slate-800 dark:text-white md:text-4xl">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent dark:from-sky-400 dark:to-indigo-400">
                {user?.name || "Administrator"}
              </span>
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300 md:text-base">
              Review onboarding health, verify teachers quickly, and keep
              platform operations stable with one focused control panel.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchUsers}
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-300/40 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-400/40 dark:shadow-sky-900/30"
            >
              <FiRefreshCw
                className={`${loading ? "animate-spin" : ""} h-4 w-4`}
              />
              Sync Data
            </button>

            <button
              onClick={() => setActiveSection("users")}
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white/70 px-5 py-3 text-sm font-semibold text-slate-700 backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FiUsers className="h-4 w-4" />
              Open User Queue
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Users",
            value: stats.totalUsers,
            icon: FiUsers,
            color: "from-fuchsia-500 to-violet-600",
          },
          {
            label: "Verified",
            value: stats.verifiedUsers,
            icon: FiCheckCircle,
            color: "from-emerald-500 to-teal-600",
          },
          {
            label: "Pending",
            value: stats.pendingUsers,
            icon: FiClock,
            color: "from-amber-400 to-orange-400",
          },
          {
            label: "Teachers",
            value: stats.teacherCount,
            icon: FiMail,
            color: "from-cyan-400 to-blue-500",
          },
        ].map((card) => (
          <motion.div
            key={card.label}
            whileHover={{ y: -3 }}
            className="rounded-2xl p-5 shadow-md bg-white/70 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">
                  {card.label}
                </p>
                <p className="mt-2 text-3xl font-extrabold text-slate-900">
                  {card.value}
                </p>
              </div>
              <div
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 bg-gradient-to-r ${card.color} text-white shadow-lg`}
              >
                <div className="rounded-lg bg-white/20 p-2">
                  <card.icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <motion.div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Course Intelligence
              </p>
              <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                At-a-glance platform course view
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection("courses")}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
            >
              <FiLayers className="h-4 w-4" />
              Open Courses
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Courses",
                value: courseStats.totalCourses,
                icon: FiBookOpen,
                color: "from-indigo-100 to-indigo-50",
              },
              {
                label: "Enrollments",
                value: courseStats.totalEnrollments,
                icon: FiUsers,
                color: "from-emerald-100 to-emerald-50",
              },
              {
                label: "Students",
                value: courseStats.uniqueStudents,
                icon: FiUser,
                color: "from-pink-100 to-pink-50",
              },
              {
                label: "Published",
                value: courseStats.publishedCourses,
                icon: FiCheckCircle,
                color: "from-amber-100 to-amber-50",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`rounded-xl p-4 bg-gradient-to-br ${item.color} shadow-sm`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-600">
                        {item.label}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {item.value}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/30 p-2">
                      <Icon className="h-5 w-5 text-slate-900" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        <div className="rounded-2xl p-5 shadow-sm bg-gradient-to-br from-indigo-50 via-white to-pink-50">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Selected Course
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {selectedCourseAnalytics?.title || selectedCourse?.title || "None"}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {selectedCourseAnalytics?.instructor?.name ||
              selectedCourse?.instructor?.name ||
              "Choose a course in Course Analytics"}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl p-3 bg-gradient-to-br from-white to-sky-50">
              <p className="text-slate-500">Students</p>
              <p className="font-semibold text-slate-900">
                {selectedCourseAnalytics?.enrollmentSummary?.totalEnrolled ||
                  selectedCourseStudents.length ||
                  0}
              </p>
            </div>
            <div className="rounded-xl p-3 bg-gradient-to-br from-white to-emerald-50">
              <p className="text-slate-500">Avg Progress</p>
              <p className="font-semibold text-slate-900">
                {selectedCourseAnalytics?.enrollmentSummary?.averageProgress ||
                  0}
                %
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCourses = () => {
    const currentCourse = selectedCourseAnalytics;

    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Course Analytics
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Inspect who created each course, who joined, and how the cohort
                is progressing.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={fetchCourses}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                <FiRefreshCw
                  className={`${coursesLoading ? "animate-spin" : ""} h-4 w-4`}
                />
                Refresh Courses
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="relative lg:col-span-2">
              <FiSearch className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                value={courseSearchTerm}
                onChange={(e) => {
                  setCourseSearchTerm(e.target.value);
                  setCoursePage(1);
                }}
                type="text"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Search course title, instructor, category, status"
              />
            </div>
            <select
              value={courseStatusFilter}
              onChange={(e) => {
                setCourseStatusFilter(e.target.value);
                setCoursePage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="published">Published</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Courses
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {courseTotal} total courses, {filteredCourses.length}{" "}
                  currently shown.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSelectedCourseId(
                    filteredCourses[0]?.id || filteredCourses[0]?._id || "",
                  )
                }
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Focus first
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-[1100px] w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    {[
                      "Course",
                      "Instructor",
                      "Students",
                      "Progress",
                      "Status",
                      "Capacity",
                      "Updated",
                      "Action",
                    ].map((head) => (
                      <th
                        key={head}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300"
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
                  {coursesLoading ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        Loading courses...
                      </td>
                    </tr>
                  ) : filteredCourses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        No courses found.
                      </td>
                    </tr>
                  ) : (
                    filteredCourses.map((course) => {
                      const courseId = course.id || course._id;
                      const selected = selectedCourseId === courseId;
                      return (
                        <tr
                          key={courseId}
                          className={`${selected ? "bg-sky-50/60 dark:bg-sky-950/20" : "hover:bg-slate-50/80 dark:hover:bg-slate-800/60"}`}
                        >
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setSelectedCourseId(courseId)}
                              className="text-left"
                            >
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {course.title}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                {course.category} · {course.level}
                              </p>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                            {course.instructor?.name || "Unknown"}
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {course.instructor?.email || ""}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                            {course.enrollmentSummary?.totalEnrolled ??
                              course.totals?.totalStudents ??
                              0}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                            {course.enrollmentSummary?.averageProgress ?? 0}%
                          </td>
                          <td className="px-4 py-3">
                            {getStatusBadge(course.status)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                            {course.totals?.capacityUsage !== null &&
                            course.totals?.capacityUsage !== undefined
                              ? `${course.totals.capacityUsage}%`
                              : "Unlimited"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                            {formatDate(course.updatedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setSelectedCourseId(courseId)}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-slate-900"
                            >
                              <FiBarChart className="h-3.5 w-3.5" />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!coursesLoading && coursePages > 1 && (
              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-500">
                <p>
                  Page {coursePage} of {coursePages} ({courseTotal} courses)
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCoursePage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={coursePage === 1}
                    className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40 dark:border-slate-700"
                  >
                    <FiChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCoursePage((prev) => Math.min(coursePages, prev + 1))
                    }
                    disabled={coursePage === coursePages}
                    className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40 dark:border-slate-700"
                  >
                    <FiChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Selected Course Drilldown
              </h3>
              {courseDetailsLoading ? (
                <p className="mt-4 text-sm text-slate-500">
                  Loading details...
                </p>
              ) : currentCourse ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Title
                    </p>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {currentCourse.title}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="text-slate-500 dark:text-slate-400">
                        Students
                      </p>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {currentCourse.enrollmentSummary?.totalEnrolled || 0}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="text-slate-500 dark:text-slate-400">
                        Completed
                      </p>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {currentCourse.enrollmentSummary?.completed || 0}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="text-slate-500 dark:text-slate-400">
                        Avg Time
                      </p>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {currentCourse.analysis?.averageTimeSpent || 0} min
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="text-slate-500 dark:text-slate-400">
                        Rating
                      </p>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {currentCourse.totals?.ratingAverage || 0}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Instructor
                    </p>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {currentCourse.instructor?.name || "Unknown"}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {currentCourse.instructor?.email || ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Cohort split
                    </p>
                    <div className="mt-2 space-y-2 text-sm">
                      {Object.entries(
                        currentCourse.analysis?.progressBands || {},
                      ).map(([label, value]) => (
                        <div
                          key={label}
                          className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
                        >
                          <span className="capitalize text-slate-600 dark:text-slate-300">
                            {label}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Select a course to inspect details.
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Enrolled Students
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Student names, progress, and recent activity.
              </p>
              <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-1">
                {courseDetailsLoading ? (
                  <p className="text-sm text-slate-500">Loading students...</p>
                ) : selectedCourseStudents.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No student data available for this course.
                  </p>
                ) : (
                  selectedCourseStudents.map((item) => (
                    <div
                      key={item.enrollmentId || item.student?.id}
                      className="rounded-2xl p-4 bg-white/60 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {item.student?.name || "Unknown student"}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item.student?.email || ""}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Joined {formatDate(item.enrolledAt)}
                          </p>
                        </div>
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                          {item.progress?.overallProgress || 0}%
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
                          <p className="text-slate-500 dark:text-slate-400">
                            Lessons
                          </p>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {item.progress?.completedLessons || 0}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
                          <p className="text-slate-500 dark:text-slate-400">
                            Quizzes
                          </p>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {item.progress?.completedQuizzes || 0}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
                          <p className="text-slate-500 dark:text-slate-400">
                            Assignments
                          </p>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {item.progress?.completedAssignments || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {!coursesLoading && coursePages > 1 && (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Course Page Controls
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Move across course pages and adjust how many are shown.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={coursePageSize}
                  onChange={(e) => {
                    setCoursePageSize(parseInt(e.target.value, 10));
                    setCoursePage(1);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value={4}>4 per page</option>
                  <option value={8}>8 per page</option>
                  <option value={12}>12 per page</option>
                  <option value={20}>20 per page</option>
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCoursePage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={coursePage === 1}
                    className="rounded-xl border border-slate-300 px-3 py-2 disabled:opacity-40 dark:border-slate-700"
                  >
                    <FiChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCoursePage((prev) => Math.min(coursePages, prev + 1))
                    }
                    disabled={coursePage === coursePages}
                    className="rounded-xl border border-slate-300 px-3 py-2 disabled:opacity-40 dark:border-slate-700"
                  >
                    <FiChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderUsers = () => (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            User Operations
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Approve teachers, remove invalid users, and monitor account status.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          type="button"
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          <FiRefreshCw className={`${loading ? "animate-spin" : ""} h-4 w-4`} />
          Refresh
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            type="text"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            placeholder="Search name, email, role"
          />
        </div>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(parseInt(e.target.value, 10));
            setCurrentPage(1);
          }}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value={10}>10 per page</option>
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
        </select>
        <label className="flex items-center gap-3 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => {
              setIncludeInactive(e.target.checked);
              setCurrentPage(1);
            }}
            className="h-4 w-4 rounded"
          />
          <span className="inline-flex items-center gap-2">
            <FiFilter className="h-4 w-4" />
            Include inactive users
          </span>
        </label>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
          >
            <FiAlertCircle className="h-4 w-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[850px]">
          <thead className="bg-slate-50 dark:bg-slate-800/80">
            <tr>
              {[
                "User",
                "Role",
                "Status",
                "Joined",
                "Last Login",
                "Actions",
              ].map((head) => (
                <th
                  key={head}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300"
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
            {loading ? (
              <tr>
                <td
                  className="px-4 py-10 text-center text-sm text-slate-500"
                  colSpan={6}
                >
                  Loading users...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-10 text-center text-sm text-slate-500"
                  colSpan={6}
                >
                  No users found for current filters.
                </td>
              </tr>
            ) : (
              filteredUsers.map((row) => (
                <tr
                  key={row._id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-sm font-semibold text-white">
                        {(row.name?.charAt(0) || "U").toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {row.name || "Unknown"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {row.email || "No email"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{getRoleBadge(row.role)}</td>
                  <td className="px-4 py-3">
                    {getVerificationBadge(row.isVerified, row.role)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    {formatDate(row.lastLogin)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {!row.isVerified && row.role !== "student" && (
                        <button
                          onClick={() => handleVerifyUser(row._id)}
                          disabled={verifyingUserId === row._id}
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-60 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          <FiCheck className="h-3.5 w-3.5" />
                          {verifyingUserId === row._id ? "Verifying" : "Verify"}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setDeleteConfirmId(row._id);
                          setShowDeleteConfirm(true);
                        }}
                        disabled={deletingUserId === row._id}
                        type="button"
                        className="rounded-lg bg-rose-100 p-1.5 text-rose-700 transition hover:bg-rose-200 disabled:opacity-60 dark:bg-rose-950/40 dark:text-rose-300"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && totalPages > 1 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 text-sm text-slate-500 md:flex-row">
          <p>
            Page{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {currentPage}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {totalPages}
            </span>{" "}
            ({totalUsers} users)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              type="button"
              className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FiChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
              type="button"
              className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FiChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderAnalytics = () => {
    const roleBuckets = {
      student: users.filter((u) => u.role === "student").length,
      teacher: users.filter((u) => u.role === "teacher").length,
      admin: users.filter((u) => u.role === "admin").length,
    };

    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Verification Funnel
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Live account state from current dataset.
          </p>
          <div className="mt-6 space-y-4">
            {[
              {
                label: "Verified",
                value: stats.verifiedUsers,
                tone: "bg-emerald-500",
              },
              {
                label: "Pending",
                value: stats.pendingUsers,
                tone: "bg-amber-500",
              },
              {
                label: "Remaining",
                value: Math.max(
                  totalUsers - stats.verifiedUsers - stats.pendingUsers,
                  0,
                ),
                tone: "bg-slate-400",
              },
            ].map((item) => {
              const percentage = totalUsers
                ? Math.round((item.value / totalUsers) * 100)
                : 0;
              return (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {item.label}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {item.value} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-2.5 rounded-full ${item.tone}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Role Split
          </h3>
          <div className="mt-5 space-y-3 text-sm">
            {Object.entries(roleBuckets).map(([role, value]) => (
              <div
                key={role}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
              >
                <span className="capitalize text-slate-600 dark:text-slate-300">
                  {role}
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderProfile = () => <ProfileComponent user={user} />;

  const renderSettings = () => (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
          Platform Preferences
        </h3>
        <div className="mt-5 space-y-4">
          {[
            [
              "emailAlerts",
              "Email alerts for pending teacher approvals",
              FiMail,
            ],
            ["securityDigest", "Weekly security digest summary", FiShield],
            [
              "allowTeacherSelfApproval",
              "Allow teacher self-verification request",
              FiUser,
            ],
            ["smartInsights", "Enable AI smart operational insights", FiGlobe],
            [
              "maintenanceMode",
              "Maintenance mode banner for all users",
              FiMoon,
            ],
          ].map(([key, label, Icon]) => (
            <label
              key={key}
              className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700"
            >
              <span className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <Icon className="h-4 w-4" />
                {label}
              </span>
              <input
                type="checkbox"
                checked={preferences[key]}
                onChange={(e) =>
                  setPreferences((prev) => ({
                    ...prev,
                    [key]: e.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
          Security and Access
        </h3>
        <div className="mt-5 space-y-4 text-sm">
          <label className="block">
            <span className="mb-1 inline-flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
              <FiLock className="h-4 w-4" /> Force MFA for Admins
            </span>
            <select
              value={security.forceMfa ? "enabled" : "disabled"}
              onChange={(e) =>
                setSecurity((prev) => ({
                  ...prev,
                  forceMfa: e.target.value === "enabled",
                }))
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 inline-flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
              <FiClock className="h-4 w-4" /> Session timeout (minutes)
            </span>
            <select
              value={security.sessionTimeout}
              onChange={(e) =>
                setSecurity((prev) => ({
                  ...prev,
                  sessionTimeout: e.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
              <option value="120">120 minutes</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 inline-flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
              <FiCalendar className="h-4 w-4" /> Password rotation policy (days)
            </span>
            <input
              value={security.passwordRotationDays}
              onChange={(e) =>
                setSecurity((prev) => ({
                  ...prev,
                  passwordRotationDays: e.target.value,
                }))
              }
              type="number"
              min="30"
              max="365"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
            <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <FiGlobe className="h-4 w-4" /> Geo-block suspicious regions
            </span>
            <input
              type="checkbox"
              checked={security.geoBlocking}
              onChange={(e) =>
                setSecurity((prev) => ({
                  ...prev,
                  geoBlocking: e.target.checked,
                }))
              }
              className="h-4 w-4"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={() => toast.success("Settings applied successfully")}
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            <FiSave className="h-4 w-4" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-50 text-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-200">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-white/40 bg-gradient-to-b from-cyan-100/90 via-sky-100/80 to-indigo-100/80 p-5 backdrop-blur-xl dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 lg:block">
          <div className="mb-8 flex items-center gap-3 rounded-2xl bg-white/70 p-4 shadow dark:bg-slate-900/70">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white">
              <FiShield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                StudyStream
              </p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Admin Suite
              </p>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <SectionButton
                key={item.id}
                id={item.id}
                label={item.label}
                icon={item.icon}
              />
            ))}
          </nav>

          <button
            onClick={logout}
            type="button"
            className="mt-10 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600"
          >
            <FiLogOut className="h-4 w-4" />
            Logout
          </button>
        </aside>

        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ duration: 0.2 }}
                className="h-full w-72 bg-white p-5 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-6 flex items-center justify-between">
                  <div className="text-sm font-bold">Admin Suite</div>
                  <button type="button" onClick={() => setSidebarOpen(false)}>
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
                <nav className="space-y-2">
                  {navItems.map((item) => (
                    <SectionButton
                      key={item.id}
                      id={item.id}
                      label={item.label}
                      icon={item.icon}
                    />
                  ))}
                </nav>
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mb-6 rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="rounded-xl border border-slate-300 p-2 lg:hidden dark:border-slate-700"
                >
                  <FiMenu className="h-5 w-5" />
                </button>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Control Panel
                  </p>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {navItems.find((n) => n.id === activeSection)?.label ||
                      "Overview"}
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative hidden md:block">
                  <FiSearch className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64 rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                    placeholder="Quick search users"
                  />
                </div>
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 p-2 dark:border-slate-700"
                >
                  <FiBell className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-xs font-bold text-white">
                    {(user?.name?.charAt(0) || "A").toUpperCase()}
                  </div>
                  <div className="hidden text-left md:block">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {user?.name || "Admin"}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Administrator
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {activeSection === "overview" && renderOverview()}
            {activeSection === "users" && renderUsers()}
            {activeSection === "courses" && renderCourses()}
            {activeSection === "analytics" && renderAnalytics()}
            {activeSection === "profile" && renderProfile()}
            {activeSection === "settings" && renderSettings()}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"
            >
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                <FiAlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-center text-lg font-bold text-slate-900 dark:text-white">
                Delete user account?
              </h3>
              <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                This action cannot be undone and will remove the user
                permanently.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmId(null);
                  }}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={deletingUserId !== null}
                  className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                >
                  {deletingUserId !== null ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
