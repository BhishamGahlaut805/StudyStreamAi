// src/pages/CourseCardPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Filter,
  BookOpen,
  Clock,
  Users,
  Star,
  TrendingUp,
  ChevronRight,
  X,
  GraduationCap,
  Target,
  Zap,
  Brain,
  Award,
  BookMarked,
  PlayCircle,
  DollarSign,
  BarChart3,
  Sparkles,
  Layers,
  FolderOpen,
  Loader2,
  AlertCircle,
  ChevronDown,
  Grid3x3,
  List,
  ThumbsUp,
  Shield,
  Calendar,
  MapPin,
  Globe,
} from "lucide-react";
import courseService from "../../services/Course/CourseService";

const CourseCardPage = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'
  const [filters, setFilters] = useState({
    category: "all",
    level: "all",
    price: "all",
    sortBy: "popular",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [stats, setStats] = useState({
    totalCourses: 0,
    avgRating: 0,
    totalStudents: 0,
  });

  useEffect(() => {
    fetchCourses();
    fetchUserRole();
  }, [filters]);

  const fetchUserRole = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        setUserRole(user.role || "student");
      }
    } catch (err) {
      console.error("Error fetching user role:", err);
    }
  };

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const params = {
        search: searchTerm,
      };

      if (filters.category && filters.category !== "all") {
        params.category = filters.category;
      }

      if (filters.level && filters.level !== "all") {
        params.level = filters.level;
      }

      if (filters.sortBy && filters.sortBy !== "popular") {
        params.sort =
          filters.sortBy === "newest"
            ? "-createdAt"
            : filters.sortBy === "price_low"
              ? "price"
              : filters.sortBy === "price_high"
                ? "-price"
                : filters.sortBy === "rating"
                  ? "-rating.average"
                  : "-createdAt";
      } else {
        params.sort = "-createdAt";
      }

      const response = await courseService.getCourses(params);

      if (response.success && response.data) {
        const coursesData = response.data.courses || response.data;
        setCourses(coursesData);

        // Extract unique categories
        const uniqueCategories = [
          ...new Set(coursesData.map((c) => c.category).filter(Boolean)),
        ];
        setCategories(uniqueCategories);

        // Calculate stats
        const totalStudents = coursesData.reduce(
          (sum, c) => sum + (c.totalStudents || 0),
          0,
        );
        const avgRating =
          coursesData.reduce((sum, c) => sum + (c.rating?.average || 0), 0) /
          (coursesData.length || 1);

        setStats({
          totalCourses: coursesData.length,
          avgRating: avgRating.toFixed(1),
          totalStudents: totalStudents,
        });
      } else {
        setCourses([]);
      }
    } catch (err) {
      console.error("Error fetching courses:", err);
      setError(err.message || "Failed to load courses");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCourses();
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      category: "all",
      level: "all",
      price: "all",
      sortBy: "popular",
    });
    setSearchTerm("");
  };

  const getLevelColor = (level) => {
    const colors = {
      beginner:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      intermediate:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      advanced:
        "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
      "all-levels":
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    };
    return colors[level] || colors["all-levels"];
  };

  const getIsFreeCourse = () => true;

  const getCourseDiscountPercent = () => 100;

  const getDisplayPrice = () => 0;

  const CourseCard = ({ course }) => {
    const discountPercent = getCourseDiscountPercent(course);
    const displayPrice = getDisplayPrice(course);
    const originalPrice = course.price;
    const isFreeCourse = getIsFreeCourse(course);

    return (
      <div
        className="group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer border border-gray-100 dark:border-gray-700"
        onClick={() => navigate(`/courses/${course._id}`)}
      >
        {/* Thumbnail with overlay gradient */}
        <div className="relative h-48 overflow-hidden">
          {course.thumbnail?.url ? (
            <img
              src={course.thumbnail.url}
              alt={course.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <BookOpen className="w-16 h-16 text-white/30" />
            </div>
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            {discountPercent > 0 && (
              <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg shadow-lg">
                {discountPercent}% OFF
              </span>
            )}
            {course.isPublished && (
              <span className="px-2 py-1 bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg">
                Published
              </span>
            )}
            {isFreeCourse && (
              <span className="px-2 py-1 bg-amber-500 text-white text-xs font-semibold rounded-lg shadow-lg">
                Free Access
              </span>
            )}
          </div>

          {/* Level badge */}
          <div className="absolute bottom-3 left-3">
            <span
              className={`px-2 py-1 rounded-lg text-xs font-medium shadow-lg ${getLevelColor(course.level)}`}
            >
              {course.level?.charAt(0).toUpperCase() + course.level?.slice(1)}
            </span>
          </div>

          {/* Rating badge */}
          {course.rating?.average > 0 && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-white text-xs font-semibold">
                {course.rating.average}
              </span>
              <span className="text-white/60 text-xs">
                ({course.rating.count})
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Category */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
              {course.category}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {course.title}
          </h3>

          {/* Description */}
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
            {course.shortDescription || course.description}
          </p>

          {/* Stats */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{course.totalStudents || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>
                  {course.totalDuration
                    ? `${Math.floor(course.totalDuration / 60)}h`
                    : "N/A"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                <span>{course.totalLessons || 0} lessons</span>
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
            <div>
              {discountPercent > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {isFreeCourse ? "Free" : `$${displayPrice}`}
                  </span>
                  <span className="text-sm text-gray-400 line-through">
                    ${originalPrice}
                  </span>
                </div>
              ) : (
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {displayPrice === 0 ? "Free" : `$${displayPrice}`}
                </span>
              )}
            </div>

            <button
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 group/btn"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/courses/${course._id}`);
              }}
            >
              <span>View Details</span>
              <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const CourseListItem = ({ course }) => {
    const discountPercent = getCourseDiscountPercent(course);
    const displayPrice = getDisplayPrice(course);
    const isFreeCourse = getIsFreeCourse(course);

    return (
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100 dark:border-gray-700"
        onClick={() => navigate(`/courses/${course._id}`)}
      >
        <div className="flex flex-col md:flex-row">
          {/* Thumbnail */}
          <div className="md:w-64 h-48 md:h-auto relative overflow-hidden rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none">
            {course.thumbnail?.url ? (
              <img
                src={course.thumbnail.url}
                alt={course.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <BookOpen className="w-12 h-12 text-white/30" />
              </div>
            )}

            {discountPercent > 0 && (
              <span className="absolute top-3 left-3 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg">
                {discountPercent}% OFF
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                    {course.category}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getLevelColor(course.level)}`}
                  >
                    {course.level}
                  </span>
                  {isFreeCourse && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                      Free Access
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  {course.title}
                </h3>

                <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                  {course.description}
                </p>

                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{course.totalStudents || 0} students</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>
                      {course.totalDuration
                        ? `${Math.floor(course.totalDuration / 60)}h ${course.totalDuration % 60}m`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-4 h-4" />
                    <span>{course.totalLessons || 0} lessons</span>
                  </div>
                  {course.rating?.average > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span>{course.rating.average}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right ml-4">
                <div className="mb-3">
                  {discountPercent > 0 ? (
                    <div>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">
                        {isFreeCourse ? "Free" : `$${displayPrice}`}
                      </span>
                      <span className="text-sm text-gray-400 line-through ml-2">
                        ${course.price}
                      </span>
                    </div>
                  ) : (
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {displayPrice === 0 ? "Free" : `$${displayPrice}`}
                    </span>
                  )}
                </div>
                <button className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2">
                  <span>View Course</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-900 dark:via-purple-900 dark:to-pink-900 overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative container mx-auto px-4 py-12 lg:py-16">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-4">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span className="text-white text-sm font-medium">
                Discover Your Learning Path
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
              Expand Your Knowledge
              <span className="block text-yellow-300">With Expert Courses</span>
            </h1>
            <p className="text-white/90 text-lg max-w-2xl mx-auto mb-8">
              Join thousands of learners worldwide and access premium courses
              taught by industry experts
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search courses by title, category, or instructor..."
                  className="w-full px-6 py-4 pl-14 pr-32 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl shadow-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                />
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all duration-300"
                >
                  Search
                </button>
              </div>
            </form>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-12">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                {stats.totalCourses}+
              </div>
              <div className="text-white/80 text-sm">Premium Courses</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                {stats.avgRating}
              </div>
              <div className="text-white/80 text-sm">Average Rating</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                {stats.totalStudents.toLocaleString()}+
              </div>
              <div className="text-white/80 text-sm">Active Students</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Filters Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
                />
              </button>

              {/* View Toggle */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? "bg-white dark:bg-gray-600 shadow-sm" : ""}`}
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-lg transition-all ${viewMode === "list" ? "bg-white dark:bg-gray-600 shadow-sm" : ""}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange("sortBy", e.target.value)}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="popular">Most Popular</option>
                <option value="newest">Newest First</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) =>
                      handleFilterChange("category", e.target.value)
                    }
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Level
                  </label>
                  <select
                    value={filters.level}
                    onChange={(e) =>
                      handleFilterChange("level", e.target.value)
                    }
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Levels</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Price
                  </label>
                  <select
                    value={filters.price}
                    onChange={(e) =>
                      handleFilterChange("price", e.target.value)
                    }
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Prices</option>
                    <option value="free">Free</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={resetFilters}
                    className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Loading amazing courses...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={fetchCourses}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Courses Grid */}
        {!loading && !error && (
          <>
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {courses.length} Courses Available
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Find the perfect course for your learning journey
                </p>
              </div>

              {/* Adaptive Learning Notice */}
              <div className="hidden md:flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 px-4 py-2 rounded-full">
                <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  Adaptive Learning Ready
                </span>
              </div>
            </div>

            {courses.length === 0 ? (
              <div className="text-center py-20">
                <BookMarked className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No courses found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Try adjusting your search or filters
                </p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map((course) => (
                  <CourseCard key={course._id} course={course} />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {courses.map((course) => (
                  <CourseListItem key={course._id} course={course} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer CTA */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-900 dark:to-purple-900 mt-16">
        <div className="container mx-auto px-4 py-12 text-center">
          <h3 className="text-2xl font-bold text-white mb-4">
            Ready to start your learning journey?
          </h3>
          <p className="text-white/80 mb-6 max-w-md mx-auto">
            Join our community of lifelong learners and unlock your potential
          </p>
          <button className="px-8 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:shadow-lg transition-all">
            Explore All Courses
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseCardPage;
