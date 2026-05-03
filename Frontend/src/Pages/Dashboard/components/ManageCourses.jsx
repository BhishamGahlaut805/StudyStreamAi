import React, { useState, useEffect } from "react";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
  FiBook,
  FiUsers,
  FiLoader,
  FiX,
  FiSave,
  FiTag,
  FiList,
  FiImage,
  FiCamera,
  FiMonitor,
  FiLink,
  FiPlay,
  FiFile,
  FiClock,
  FiCheck,
} from "react-icons/fi";
import courseService from "../../../services/Course/CourseService";
import curriculumService from "../../../services/Course/curriculumService";

const ManageCourses = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState([]);
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCurriculumModal, setShowCurriculumModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [curriculum, setCurriculum] = useState({ chapters: [] });
  const [addingChapter, setAddingChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [expandedChapter, setExpandedChapter] = useState(null);
  const [addingLesson, setAddingLesson] = useState(null);
  const [newLesson, setNewLesson] = useState({
    title: "",
    description: "",
    lessonType: "video",
    videoUrl: "",
    duration: 0,
  });
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    shortDescription: "",
    price: "",
    discountPrice: "",
    category: "",
    tagsText: "",
    level: "all-levels",
    language: "english",
    whatYouWillLearnText: "",
    requirementsText: "",
    targetAudienceText: "",
    maxEnrollments: "",
    status: "draft",
    thumbnailUrl: "",
    thumbnailPublicId: "",
    coverImageUrl: "",
    coverImagePublicId: "",
  });

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await courseService.getTeacherCourses();
      console.log("Fetched courses:", response);

      // Handle different response structures
      const coursesData = response.data || response;
      setCourses(Array.isArray(coursesData) ? coursesData : []);
    } catch (error) {
      console.error("Error fetching courses:", error);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleManageCurriculum = async (course) => {
    setSelectedCourse(course);
    setShowCurriculumModal(true);
    await fetchCurriculum(course._id);
  };

  const fetchCurriculum = async (courseId) => {
    try {
      const response = await curriculumService.getCurriculum(courseId);
      console.log("Fetched curriculum:", response);

      // Handle different response structures
      const curriculumData = response.data || response;
      setCurriculum(
        curriculumData && curriculumData.chapters
          ? curriculumData
          : { chapters: [] },
      );
    } catch (error) {
      console.error("Error fetching curriculum:", error);
      setCurriculum({ chapters: [] });
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      shortDescription: "",
      price: "",
      discountPrice: "",
      category: "",
      tagsText: "",
      level: "all-levels",
      language: "english",
      whatYouWillLearnText: "",
      requirementsText: "",
      targetAudienceText: "",
      maxEnrollments: "",
      status: "draft",
      thumbnailUrl: "",
      thumbnailPublicId: "",
      coverImageUrl: "",
      coverImagePublicId: "",
    });
    setFormError("");
    setSuccessMessage("");
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (formError) setFormError("");
  };

  const splitLines = (value) =>
    value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

  const handleCreateCourse = async (e) => {
    e.preventDefault();

    // Validation
    if (
      !formData.title.trim() ||
      !formData.description.trim() ||
      !formData.category.trim()
    ) {
      setFormError("Title, description, and category are required.");
      return;
    }

    if (
      !formData.price ||
      isNaN(Number(formData.price)) ||
      Number(formData.price) < 0
    ) {
      setFormError("Please provide a valid course price.");
      return;
    }

    if (
      formData.discountPrice &&
      Number(formData.discountPrice) > Number(formData.price)
    ) {
      setFormError("Discount price cannot be greater than the original price.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        shortDescription: formData.shortDescription.trim(),
        price: Number(formData.price),
        category: formData.category.trim(),
        tags: formData.tagsText
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        level: formData.level,
        language: formData.language.trim() || "english",
        whatYouWillLearn: splitLines(formData.whatYouWillLearnText),
        requirements: splitLines(formData.requirementsText),
        targetAudience: splitLines(formData.targetAudienceText),
        status: formData.status,
      };

      // Only add optional fields if they have values
      if (formData.discountPrice && formData.discountPrice !== "") {
        payload.discountPrice = Number(formData.discountPrice);
      }

      if (formData.maxEnrollments && formData.maxEnrollments !== "") {
        payload.maxEnrollments = Number(formData.maxEnrollments);
      }

      if (formData.thumbnailUrl.trim()) {
        payload.thumbnail = {
          url: formData.thumbnailUrl.trim(),
          publicId: formData.thumbnailPublicId.trim() || undefined,
        };
      }

      if (formData.coverImageUrl.trim()) {
        payload.coverImage = {
          url: formData.coverImageUrl.trim(),
          publicId: formData.coverImagePublicId.trim() || undefined,
        };
      }

      console.log("Creating course with payload:", payload);
      const response = await courseService.createCourse(payload);
      console.log("Create course response:", response);

      if (response && response.success === false) {
        throw new Error(
          response.message || response.error || "Course creation failed",
        );
      }

      setSuccessMessage("Course created successfully!");
      await fetchCourses();

      // Reset and close modal
      setTimeout(() => {
        setShowCreateModal(false);
        resetForm();

        // Open curriculum for new course
        const newCourse = response?.data;
        if (newCourse?._id) {
          handleManageCurriculum(newCourse);
        }
      }, 1000);
    } catch (error) {
      console.error("Course creation error:", error);
      setFormError(
        error.message ||
          error.error ||
          "Failed to create course. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddChapter = async () => {
    if (!selectedCourse || !newChapterTitle.trim()) return;

    try {
      setAddingChapter(true);
      const newChapter = {
        title: newChapterTitle.trim(),
        description: "",
        order: curriculum.chapters.length + 1,
      };

      const response = await curriculumService.addChapter(
        selectedCourse._id,
        newChapter,
      );
      console.log("Add chapter response:", response);

      if (response && response.data) {
        setCurriculum(response.data);
      } else {
        // Update local state
        setCurriculum({
          ...curriculum,
          chapters: [
            ...curriculum.chapters,
            { ...newChapter, lessons: [], _id: Date.now().toString() },
          ],
        });
      }

      setNewChapterTitle("");
      setSuccessMessage("Chapter added successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error adding chapter:", error);
      setFormError(error.message || "Failed to add chapter");
    } finally {
      setAddingChapter(false);
    }
  };

  const handleAddLesson = async (chapterId) => {
    if (!selectedCourse || !newLesson.title.trim()) return;

    try {
      setSaving(true);
      const lessonData = {
        title: newLesson.title.trim(),
        description: newLesson.description.trim(),
        lessonType: newLesson.lessonType,
        videoUrl: newLesson.videoUrl.trim(),
        duration: Number(newLesson.duration) || 0,
        order: 1,
      };

      const chapter = curriculum.chapters.find((c) => c._id === chapterId);
      if (chapter) {
        lessonData.order = chapter.lessons.length + 1;
      }

      const response = await curriculumService.addLesson(
        selectedCourse._id,
        chapterId,
        lessonData,
      );
      console.log("Add lesson response:", response);

      if (response && response.data) {
        setCurriculum(response.data);
      }

      setNewLesson({
        title: "",
        description: "",
        lessonType: "video",
        videoUrl: "",
        duration: 0,
      });
      setAddingLesson(null);
      setSuccessMessage("Lesson added successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error adding lesson:", error);
      setFormError(error.message || "Failed to add lesson");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this course? This action cannot be undone.",
      )
    ) {
      try {
        await courseService.deleteCourse(courseId);
        setCourses(courses.filter((c) => c._id !== courseId));
        setSuccessMessage("Course deleted successfully!");
        setTimeout(() => setSuccessMessage(""), 3000);
      } catch (error) {
        console.error("Error deleting course:", error);
        setFormError("Failed to delete course");
      }
    }
  };

  const getLessonIcon = (type) => {
    switch (type) {
      case "video":
        return <FiPlay size={14} />;
      case "article":
        return <FiFile size={14} />;
      case "quiz":
        return <FiCheck size={14} />;
      default:
        return <FiBook size={14} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <FiLoader className="text-4xl text-indigo-600 dark:text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-green-700 dark:text-green-300">
          {successMessage}
        </div>
      )}

      {formError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
          {formError}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Manage Courses
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Create and manage your courses, curriculum, and content
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
        >
          <FiPlus size={18} />
          Create Course
        </button>
      </div>

      {/* Courses List */}
      {courses.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <FiBook className="text-4xl text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            No courses yet
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Create your first course to get started with teaching
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <div
              key={course._id}
              className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="relative h-44 overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500">
                {course.coverImage?.url ? (
                  <img
                    src={course.coverImage.url}
                    alt={course.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.parentElement.classList.add("fallback-gradient");
                    }}
                  />
                ) : (
                  <div className="flex h-full items-end justify-between p-5 text-white">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/80">
                        Teacher Course
                      </p>
                      <h3 className="mt-2 text-2xl font-bold leading-tight">
                        {course.title}
                      </h3>
                    </div>
                    <div className="rounded-full border border-white/25 bg-white/15 p-3 backdrop-blur">
                      <FiBook size={20} />
                    </div>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                <div className="absolute left-4 top-4 flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                      course.status === "published"
                        ? "bg-green-500/90 text-white"
                        : course.status === "pending"
                          ? "bg-amber-500/90 text-white"
                          : "bg-slate-900/80 text-white"
                    }`}
                  >
                    {course.status}
                  </span>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                    {course.level || "all-levels"}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <div className="mb-4 flex items-start gap-4">
                  {course.thumbnail?.url ? (
                    <img
                      src={course.thumbnail.url}
                      alt={`${course.title} thumbnail`}
                      className="h-14 w-14 shrink-0 rounded-xl border border-gray-200 object-cover dark:border-gray-700"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-600 dark:bg-gray-700/50">
                      <FiImage />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {course.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {course.shortDescription ||
                        course.description ||
                        "No description"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Students
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <FiUsers size={18} className="text-blue-500" />
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {course.totalStudents || 0}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Rating
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <FiBook size={18} className="text-yellow-500" />
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {typeof course.rating === "object"
                          ? course.rating?.average?.toFixed(1) || "0.0"
                          : course.rating?.toFixed(1) || "0.0"}
                        /5
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-gray-500 dark:text-gray-400">
                  {course.tags?.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="whitespace-nowrap rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
                  <button
                    onClick={() =>
                      setExpandedCourse(
                        expandedCourse === course._id ? null : course._id,
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    {expandedCourse === course._id ? (
                      <FiChevronUp size={18} />
                    ) : (
                      <FiChevronDown size={18} />
                    )}
                    Details
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleManageCurriculum(course)}
                      className="rounded-lg p-2 text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                      title="Manage Curriculum"
                    >
                      <FiEdit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteCourse(course._id)}
                      className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      title="Delete Course"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedCourse === course._id && (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Description
                      </p>
                      <p className="text-gray-900 dark:text-white">
                        {course.description || "No description provided"}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
                        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                          <FiCamera size={14} /> Thumbnail
                        </p>
                        {course.thumbnail?.url ? (
                          <img
                            src={course.thumbnail.url}
                            alt={`${course.title} thumbnail`}
                            className="h-40 w-full rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-700/30">
                            No thumbnail provided
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
                        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                          <FiMonitor size={14} /> Cover Image
                        </p>
                        {course.coverImage?.url ? (
                          <img
                            src={course.coverImage.url}
                            alt={`${course.title} cover`}
                            className="h-40 w-full rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-700/30">
                            No cover image provided
                          </div>
                        )}
                      </div>
                    </div>

                    {course.whatYouWillLearn?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          What You'll Learn
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          {course.whatYouWillLearn.map((item, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-gray-600 dark:text-gray-400"
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Course Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Create New Course
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Fill in the course details below
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-6 p-6">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                  {formError}
                </div>
              )}

              {successMessage && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
                  {successMessage}
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Course Title *
                    </label>
                    <input
                      value={formData.title}
                      onChange={(e) =>
                        handleFormChange("title", e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="Enter course title"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Short Description
                    </label>
                    <input
                      value={formData.shortDescription}
                      onChange={(e) =>
                        handleFormChange("shortDescription", e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="Brief summary for course listings"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description *
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        handleFormChange("description", e.target.value)
                      }
                      rows={6}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="Detailed course description"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Price *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) =>
                          handleFormChange("price", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Discount Price
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.discountPrice}
                        onChange={(e) =>
                          handleFormChange("discountPrice", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Category *
                      </label>
                      <input
                        value={formData.category}
                        onChange={(e) =>
                          handleFormChange("category", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        placeholder="e.g., Programming"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Language
                      </label>
                      <input
                        value={formData.language}
                        onChange={(e) =>
                          handleFormChange("language", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        placeholder="english"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Level
                      </label>
                      <select
                        value={formData.level}
                        onChange={(e) =>
                          handleFormChange("level", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="all-levels">All Levels</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          handleFormChange("status", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="draft">Draft</option>
                        <option value="pending">Pending Review</option>
                        <option value="published">Published</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <FiTag /> Tags
                    </label>
                    <input
                      value={formData.tagsText}
                      onChange={(e) =>
                        handleFormChange("tagsText", e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="React, JavaScript, Frontend"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Separate tags with commas
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <FiList /> What You Will Learn
                    </label>
                    <textarea
                      value={formData.whatYouWillLearnText}
                      onChange={(e) =>
                        handleFormChange("whatYouWillLearnText", e.target.value)
                      }
                      rows={4}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="Build React components\nManage state with Redux\nConnect to APIs"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      One per line
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Requirements
                    </label>
                    <textarea
                      value={formData.requirementsText}
                      onChange={(e) =>
                        handleFormChange("requirementsText", e.target.value)
                      }
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="Basic JavaScript\nComputer with internet"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Target Audience
                    </label>
                    <textarea
                      value={formData.targetAudienceText}
                      onChange={(e) =>
                        handleFormChange("targetAudienceText", e.target.value)
                      }
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="Students\nProfessionals\nCareer changers"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Max Enrollments
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.maxEnrollments}
                      onChange={(e) =>
                        handleFormChange("maxEnrollments", e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="Leave empty for unlimited"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? <FiLoader className="animate-spin" /> : <FiSave />}
                  {saving ? "Creating..." : "Create Course"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Curriculum Modal */}
      {showCurriculumModal && selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Curriculum - {selectedCourse?.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {curriculum.chapters?.length || 0} chapters,{" "}
                  {curriculum.totalLessons || 0} lessons
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchCurriculum(selectedCourse._id)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Refresh"
                >
                  <FiLoader
                    size={16}
                    className="text-gray-600 dark:text-gray-400"
                  />
                </button>
                <button
                  onClick={() => setShowCurriculumModal(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FiX size={20} className="text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Success/Error Messages */}
              {successMessage && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
                  {successMessage}
                </div>
              )}

              {formError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                  {formError}
                </div>
              )}

              {/* Add Chapter */}
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddChapter()}
                  placeholder="Enter chapter title"
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <button
                  onClick={handleAddChapter}
                  disabled={addingChapter || !newChapterTitle.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {addingChapter ? (
                    <FiLoader className="animate-spin" size={16} />
                  ) : (
                    <FiPlus size={16} />
                  )}
                  Add Chapter
                </button>
              </div>

              {/* Chapters List */}
              {curriculum.chapters && curriculum.chapters.length > 0 ? (
                <div className="space-y-3">
                  {curriculum.chapters.map((chapter, idx) => (
                    <div
                      key={chapter._id || idx}
                      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden"
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              Chapter {idx + 1}: {chapter.title}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {chapter.lessons?.length || 0} lessons •{" "}
                              {chapter.totalDuration || 0} min
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                setExpandedChapter(
                                  expandedChapter === chapter._id
                                    ? null
                                    : chapter._id,
                                )
                              }
                              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                              {expandedChapter === chapter._id ? (
                                <FiChevronUp size={16} />
                              ) : (
                                <FiChevronDown size={16} />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Chapter - Show Lessons */}
                        {expandedChapter === chapter._id && (
                          <div className="mt-4 space-y-3">
                            {chapter.lessons?.map((lesson, lessonIdx) => (
                              <div
                                key={lesson._id || lessonIdx}
                                className="flex items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg"
                              >
                                <span className="text-indigo-600 dark:text-indigo-400">
                                  {getLessonIcon(lesson.lessonType)}
                                </span>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {lesson.title}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {lesson.lessonType}{" "}
                                    {lesson.duration > 0 &&
                                      `• ${lesson.duration} min`}
                                  </p>
                                </div>
                                <span className="text-xs text-gray-400">
                                  Lesson {lessonIdx + 1}
                                </span>
                              </div>
                            ))}

                            {/* Add Lesson Form */}
                            {addingLesson === chapter._id ? (
                              <div className="space-y-3 bg-white dark:bg-gray-800 p-4 rounded-lg">
                                <input
                                  type="text"
                                  value={newLesson.title}
                                  onChange={(e) =>
                                    setNewLesson({
                                      ...newLesson,
                                      title: e.target.value,
                                    })
                                  }
                                  placeholder="Lesson title"
                                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <select
                                    value={newLesson.lessonType}
                                    onChange={(e) =>
                                      setNewLesson({
                                        ...newLesson,
                                        lessonType: e.target.value,
                                      })
                                    }
                                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                  >
                                    <option value="video">Video</option>
                                    <option value="article">Article</option>
                                    <option value="quiz">Quiz</option>
                                    <option value="assignment">
                                      Assignment
                                    </option>
                                  </select>
                                  <input
                                    type="number"
                                    value={newLesson.duration}
                                    onChange={(e) =>
                                      setNewLesson({
                                        ...newLesson,
                                        duration: e.target.value,
                                      })
                                    }
                                    placeholder="Duration (min)"
                                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                  />
                                </div>
                                {newLesson.lessonType === "video" && (
                                  <input
                                    type="text"
                                    value={newLesson.videoUrl}
                                    onChange={(e) =>
                                      setNewLesson({
                                        ...newLesson,
                                        videoUrl: e.target.value,
                                      })
                                    }
                                    placeholder="Video URL (YouTube, Vimeo, etc.)"
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                  />
                                )}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleAddLesson(chapter._id)}
                                    disabled={saving || !newLesson.title.trim()}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {saving ? (
                                      <FiLoader
                                        className="animate-spin"
                                        size={14}
                                      />
                                    ) : (
                                      <FiSave size={14} />
                                    )}
                                    Save Lesson
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAddingLesson(null);
                                      setNewLesson({
                                        title: "",
                                        description: "",
                                        lessonType: "video",
                                        videoUrl: "",
                                        duration: 0,
                                      });
                                    }}
                                    className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAddingLesson(chapter._id)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:border-indigo-400 transition-colors"
                              >
                                <FiPlus size={14} />
                                Add Lesson
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FiBook className="text-4xl text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No chapters added yet
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    Start building your course curriculum by adding chapters
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageCourses;
