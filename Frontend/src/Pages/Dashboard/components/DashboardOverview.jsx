import React, { useState, useEffect } from "react";
import {
  FiBook,
  FiUsers,
  FiTrendingUp,
  FiAward,
  FiArrowRight,
  FiLoader,
} from "react-icons/fi";
import teacherService from "../../../services/Teacher/teacherService";

const StatCard = ({ icon: Icon, label, value, color, trend }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">
          {label}
        </p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
          {value}
        </p>
        {trend && (
          <p className="text-green-600 dark:text-green-400 text-sm mt-2">
            ↑ {trend} from last month
          </p>
        )}
      </div>
      <div className={`p-4 rounded-lg ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
  </div>
);

const DashboardOverview = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    totalCourses: 0,
    publishedCourses: 0,
    totalStudents: 0,
    averageRating: 0,
    recentCourses: [],
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await teacherService.getTeacherDashboard();
      if (response.success || response.data) {
        const data = response.data || response;
        setDashboardData({
          totalCourses: data.statistics?.totalCourses || 0,
          publishedCourses: data.statistics?.publishedCourses || 0,
          totalStudents: data.statistics?.totalStudents || 0,
          averageRating: data.statistics?.averageRating || 0,
          recentCourses: data.recentCourses || [],
        });
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <FiLoader className="text-4xl text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Statistics Grid */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={FiBook}
            label="Total Courses"
            value={dashboardData.totalCourses}
            color="bg-indigo-500"
            trend="20%"
          />
          <StatCard
            icon={FiTrendingUp}
            label="Published"
            value={dashboardData.publishedCourses}
            color="bg-green-500"
            trend="10%"
          />
          <StatCard
            icon={FiUsers}
            label="Total Students"
            value={dashboardData.totalStudents}
            color="bg-blue-500"
            trend="15%"
          />
          <StatCard
            icon={FiAward}
            label="Average Rating"
            value={`${dashboardData.averageRating.toFixed(1)}/5`}
            color="bg-yellow-500"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-indigo-200 dark:border-indigo-800 cursor-pointer hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Create New Course
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Start creating your next course
                </p>
              </div>
              <FiArrowRight
                className="text-indigo-600 dark:text-indigo-400"
                size={24}
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800 cursor-pointer hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  View Students
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Check your enrolled students
                </p>
              </div>
              <FiArrowRight
                className="text-green-600 dark:text-green-400"
                size={24}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Courses */}
      {dashboardData.recentCourses.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Courses
          </h3>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {dashboardData.recentCourses.slice(0, 5).map((course) => (
                <div
                  key={course._id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {course.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {course.totalStudents || 0} students
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      course.status === "published"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                        : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                    }`}
                  >
                    {course.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
