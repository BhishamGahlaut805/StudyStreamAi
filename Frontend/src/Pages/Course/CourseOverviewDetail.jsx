// src/pages/CourseDetailPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Users,
  Star,
  PlayCircle,
  Award,
  Brain,
  Shield,
  CheckCircle,
  Loader2,
  AlertCircle,
  CreditCard,
  X,
  Layers,
  FileText,
  FileQuestion,
  Play,
} from "lucide-react";
import courseService from "../../services/Course/CourseService";
import curriculumService from "../../services/Course/curriculumService";
import enrollmentService from "../../services/Course/enrollmentService";
import StyleCard from "../../components/StyleCard";

const CourseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState("student");
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [userProgress, setUserProgress] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(false);

  useEffect(() => {
    const localUser = JSON.parse(localStorage.getItem("user") || "{}");
    setUserRole(localUser.role || "student");

    const loadCourse = async () => {
      setLoading(true);
      setError(null);
      try {
        const courseResponse = await courseService.getCourse(id);
        // console.log("Course response:", courseResponse);
        if (!courseResponse?.success || !courseResponse?.data) {
          throw new Error("Course not found");
        }

        const courseData = courseResponse.data.course || courseResponse.data;
        setCourse(courseData);

        const curriculumResponse = await curriculumService.getCurriculum(id);
        console.log("Curriculum response:", curriculumResponse);
        if (curriculumResponse?.success && curriculumResponse?.data) {
          setCurriculum(curriculumResponse.data);
        }

        try {
          const enrolledCourses = await enrollmentService.getEnrolledCourses();
          const enrolledList = enrolledCourses?.data || [];
          const enrolled = Array.isArray(enrolledList)
            ? enrolledList.some(
                (item) => item.course?._id === id || item.course === id,
              )
            : false;
          setIsEnrolled(enrolled);

          if (enrolled) {
            const progressResponse =
              await enrollmentService.getCourseProgress(id);
            if (progressResponse?.success && progressResponse?.data) {
              setUserProgress(progressResponse.data);
            }
          }
        } catch (enrollmentError) {
          console.error("Error checking enrollment:", enrollmentError);
        }
      } catch (err) {
        console.error("Error loading course details:", err);
        setError(err.message || "Failed to load course");
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [id]);

  const discountPercent = 100;
  const canEnroll = userRole === "student";

  const descriptionParagraphs = useMemo(
    () =>
      (course?.description || "")
        .split(/\n+/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
    [course?.description],
  );

  const formatDate = (value) => {
    if (!value) return "N/A";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "N/A"
      : date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
  };

  const formatDuration = (minutes) => {
    const totalMinutes = Number(minutes || 0);
    if (!totalMinutes) return "Self-paced";
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getProgressPercentage = () => {
    if (!userProgress) return 0;
    return (
      userProgress.overallProgress ||
      userProgress.progress?.overallProgress ||
      0
    );
  };

  const handleEnrollment = async () => {
    if (!course || !canEnroll) return;
    setEnrolling(true);
    try {
      const response = await enrollmentService.enrollInCourse(id, {
        amount: 0,
        paymentMethod: "free",
      });

      if (!response?.success) {
        throw new Error(response?.message || "Enrollment failed");
      }

      setEnrollmentSuccess(true);
      setIsEnrolled(true);
      setTimeout(() => {
        setShowEnrollDialog(false);
        navigate(`/learn/course/${id}`);
      }, 1600);
    } catch (err) {
      console.error("Enrollment error:", err);
      alert(err.message || "Failed to enroll. Please try again.");
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50 dark:from-slate-950 dark:to-slate-900">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-14 w-14 animate-spin text-indigo-600" />
          <p className="text-slate-600 dark:text-slate-300">
            Loading course details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto max-w-md px-4 text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-rose-500" />
          <h2 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
            Course Not Found
          </h2>
          <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
            {error || "The course you're looking for doesn't exist."}
          </p>
          <button
            onClick={() => navigate("/courses")}
            className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700"
          >
            Browse Courses
          </button>
        </div>
      </div>
    );
  }

  const learningHighlights = (course.whatYouWillLearn || []).slice(0, 8);
  const requirements = course.requirements || [];
  const targetAudience = course.targetAudience || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900 via-purple-900 to-fuchsia-900">
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative mx-auto max-w-7xl px-4 py-8 lg:py-12">
          <button
            onClick={() => navigate("/courses")}
            className="mb-6 inline-flex items-center gap-2 text-white/80 transition hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Courses</span>
          </button>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                  {course.category || "General"}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white capitalize">
                  {course.level || "all-levels"}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white capitalize">
                  {course.language || "english"}
                </span>
                <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                  100% OFF
                </span>
              </div>

              <h1 className="text-3xl font-black leading-tight text-white lg:text-5xl">
                {course.title}
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-8 text-white/80 lg:text-lg">
                {descriptionParagraphs[0] ||
                  course.shortDescription ||
                  "A professionally structured course designed for guided learning and practical mastery."}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-4 text-white/80">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <span>{course.totalStudents || 0} students</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span>{formatDuration(course.totalDuration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  <span>{course.totalLessons || 0} lessons</span>
                </div>
                {course.rating?.average > 0 && (
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span>
                      {course.rating.average} ({course.rating.count} reviews)
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
              <div className="h-52 w-full bg-slate-100 dark:bg-slate-800">
                {course.thumbnail?.url ? (
                  <img
                    src={course.thumbnail.url}
                    alt={course.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
                    <PlayCircle className="h-16 w-16 text-white/30" />
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">
                    Free
                  </span>
                  <span className="text-sm text-slate-400 line-through">
                    ${course.price || 0}
                  </span>
                  <span className="rounded-lg bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                    {discountPercent}% OFF
                  </span>
                </div>

                <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                  Free enrollment is enabled for this course.
                </div>

                {canEnroll ? (
                  isEnrolled ? (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-semibold">You're enrolled!</span>
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-sm text-slate-600 dark:text-slate-300">
                          <span>Your Progress</span>
                          <span>{getProgressPercentage()}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className="h-2 rounded-full bg-emerald-500"
                            style={{ width: `${getProgressPercentage()}%` }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/learn/course/${id}`)}
                        className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700"
                      >
                        Continue Learning
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowEnrollDialog(true)}
                      className="mt-4 w-full rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700"
                    >
                      Enroll Free
                    </button>
                  )
                ) : (
                  <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300">
                    Enrollment is available for student accounts only.
                  </div>
                )}

                <p className="mt-4 border-t border-slate-200 pt-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Secure access • Lifetime access • Free enrollment
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex gap-2 overflow-x-auto">
            {[
              ["overview", "Overview"],
              ["curriculum", "Curriculum"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-semibold transition ${activeTab === key ? "bg-indigo-600 text-white shadow-lg" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
              <StyleCard
                color="indigo"
                title="Course Overview"
                className="shadow-lg"
              >
                <div className="flex flex-wrap gap-2">
                  {(course.tags || []).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-white/10 dark:text-indigo-100"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4 space-y-3">
                  {descriptionParagraphs.slice(0, 3).map((paragraph, index) => (
                    <p
                      key={index}
                      className="text-sm leading-7 text-indigo-950/85 dark:text-indigo-50/90"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </StyleCard>

              <StyleCard
                color="green"
                title="What You Will Learn"
                className="shadow-lg"
              >
                <div className="space-y-3">
                  {learningHighlights.length ? (
                    learningHighlights.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 rounded-xl bg-white/70 p-3 dark:bg-white/10"
                      >
                        <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-300" />
                        <p className="text-sm leading-6 text-green-950/85 dark:text-green-50/90">
                          {item}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-green-950/85 dark:text-green-50/90">
                      Learning outcomes will be shown here once the course
                      author adds them.
                    </p>
                  )}
                </div>
              </StyleCard>

              <StyleCard
                color="orange"
                title="Requirements"
                className="shadow-lg"
              >
                <div className="space-y-3">
                  {requirements.length ? (
                    requirements.map((req, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 rounded-xl bg-white/70 p-3 dark:bg-white/10"
                      >
                        <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-orange-500" />
                        <p className="text-sm leading-6 text-orange-950/85 dark:text-orange-50/90">
                          {req}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-orange-950/85 dark:text-orange-50/90">
                      No prerequisites are listed for this course.
                    </p>
                  )}
                </div>
              </StyleCard>

              <StyleCard
                color="pink"
                title="Target Audience"
                className="shadow-lg"
              >
                <div className="flex flex-wrap gap-2">
                  {targetAudience.length ? (
                    targetAudience.map((audience, index) => (
                      <span
                        key={`${audience}-${index}`}
                        className="rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-pink-800 dark:bg-white/10 dark:text-pink-50"
                      >
                        {audience}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-pink-950/85 dark:text-pink-50/90">
                      The intended audience will be shown here when provided.
                    </p>
                  )}
                </div>
              </StyleCard>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <StyleCard color="blue" title="Media" className="shadow-lg">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-blue-700/70 dark:text-blue-100/70">
                        Thumbnail
                      </p>
                      {course.thumbnail?.url ? (
                        <img
                          src={course.thumbnail.url}
                          alt={course.title}
                          className="mt-3 h-40 w-full rounded-2xl object-cover"
                        />
                      ) : (
                        <p className="mt-3 text-sm text-blue-950/80 dark:text-blue-50/80">
                          No thumbnail available.
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-blue-700/70 dark:text-blue-100/70">
                        Cover Image
                      </p>
                      {course.coverImage?.url ? (
                        <img
                          src={course.coverImage.url}
                          alt={course.title}
                          className="mt-3 h-40 w-full rounded-2xl object-cover"
                        />
                      ) : (
                        <p className="mt-3 text-sm text-blue-950/80 dark:text-blue-50/80">
                          No cover image available.
                        </p>
                      )}
                    </div>
                  </div>
                </StyleCard>

                <StyleCard
                  color="purple"
                  title="Learning Format"
                  className="shadow-lg"
                >
                  <div className="space-y-3 text-sm text-purple-950/85 dark:text-purple-50/90">
                    <p className="leading-7">
                      <strong>Duration:</strong>{" "}
                      {formatDuration(course.totalDuration)}
                    </p>
                    <p className="leading-7">
                      <strong>Chapters:</strong> {course.totalChapters || 0}
                    </p>
                    <p className="leading-7">
                      <strong>Lessons:</strong> {course.totalLessons || 0}
                    </p>
                    <p className="leading-7">
                      <strong>Certificate:</strong>{" "}
                      {course.certificate?.isEnabled
                        ? `${course.certificate.template || "standard"} certificate enabled`
                        : "Not enabled"}
                      .
                    </p>
                    <p className="leading-7">
                      <strong>Discussion Forum:</strong>{" "}
                      {course.settings?.discussionForum
                        ? "Available"
                        : "Disabled"}
                      .
                    </p>
                    <p className="leading-7">
                      <strong>Drip Content:</strong>{" "}
                      {course.settings?.dripContent ? "Enabled" : "Not enabled"}
                      .
                    </p>
                    <p className="leading-7">
                      <strong>Rating:</strong> {course.rating?.average || 0}/5
                      from {course.rating?.count || 0} reviews.
                    </p>
                  </div>
                </StyleCard>
              </div>

              {course.approvalNote && (
                <StyleCard
                  color="yellow"
                  title="Approval Note"
                  className="shadow-lg"
                >
                  <p className="text-sm leading-7 text-yellow-950/85 dark:text-yellow-50/90">
                    {course.approvalNote}
                  </p>
                </StyleCard>
              )}
            </div>

            <div className="space-y-6">
              <StyleCard color="blue" title="Your Access" className="shadow-lg">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 dark:bg-white/10">
                    <span className="text-blue-900/70 dark:text-blue-100/70">
                      Role
                    </span>
                    <span className="font-semibold capitalize text-blue-950 dark:text-white">
                      {userRole}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 dark:bg-white/10">
                    <span className="text-blue-900/70 dark:text-blue-100/70">
                      Enrollment
                    </span>
                    <span className="font-semibold text-blue-950 dark:text-white">
                      {canEnroll ? "Available" : "Restricted"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 dark:bg-white/10">
                    <span className="text-blue-900/70 dark:text-blue-100/70">
                      Course Access
                    </span>
                    <span className="font-semibold text-blue-950 dark:text-white">
                      Free
                    </span>
                  </div>
                </div>
              </StyleCard>

              <StyleCard
                color="indigo"
                title="Course Instructor"
                className="shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-lg font-bold text-indigo-700 dark:bg-white/10 dark:text-indigo-100">
                    {course.instructor?.name?.[0] ||
                      course.instructor?.title?.[0] ||
                      "T"}
                  </div>
                  <div>
                    <p className="font-semibold text-indigo-950 dark:text-white">
                      {course.instructor?.name ||
                        course.instructor?.title ||
                        "Expert Instructor"}
                    </p>
                    <p className="text-sm text-indigo-900/70 dark:text-indigo-100/70">
                      {course.instructor?.email || "Course Creator"}
                    </p>
                  </div>
                </div>
                {course.instructor?.bio && (
                  <p className="mt-4 text-sm leading-7 text-indigo-950/85 dark:text-indigo-50/90">
                    {course.instructor.bio}
                  </p>
                )}
              </StyleCard>

              <StyleCard
                color="green"
                title="Course Snapshot"
                className="shadow-lg"
              >
                <div className="space-y-3 text-sm text-green-950/85 dark:text-green-50/90">
                  <p className="leading-7">
                    <strong>Title:</strong> {course.title}
                  </p>
                  <p className="leading-7">
                    <strong>Slug:</strong> {course.slug}
                  </p>
                  <p className="leading-7">
                    <strong>Published:</strong>{" "}
                    {course.isPublished ? "Yes" : "No"} •{" "}
                    <strong>Approved:</strong>{" "}
                    {course.isApproved ? "Yes" : "No"}
                  </p>
                  <p className="leading-7">
                    <strong>Pricing:</strong> Free access with {discountPercent}
                    % discount shown in the UI.
                  </p>
                  <p className="leading-7">
                    <strong>Created:</strong> {formatDate(course.createdAt)} •{" "}
                    <strong>Updated:</strong> {formatDate(course.updatedAt)}
                  </p>
                </div>
              </StyleCard>
            </div>
          </div>
        )}

        {activeTab === "curriculum" && curriculum && (
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-slate-900">
            <div className="border-b border-slate-200 p-6 dark:border-slate-800">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Course Curriculum
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {curriculum.totalChapters || 0} chapters •{" "}
                {curriculum.totalLessons || 0} lessons • Total duration:{" "}
                {formatDuration(curriculum.totalDuration)}
              </p>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {(curriculum.chapters || []).map((chapter, chapterIndex) => (
                <div key={chapter._id || chapterIndex} className="p-6">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="rounded-2xl bg-indigo-100 p-2 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Chapter {chapterIndex + 1}: {chapter.title}
                      </h3>
                      {chapter.description && (
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {chapter.description}
                        </p>
                      )}
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {(chapter.lessons || []).length} lessons •{" "}
                        {formatDuration(chapter.totalDuration)}
                      </p>
                    </div>
                  </div>

                  <div className="ml-4 space-y-2">
                    {(chapter.lessons || []).map((lesson, lessonIndex) => (
                      <div
                        key={lesson._id || lessonIndex}
                        className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60"
                      >
                        {lesson.lessonType === "video" ? (
                          <Play className="h-4 w-4 text-indigo-500" />
                        ) : lesson.lessonType === "quiz" ? (
                          <FileQuestion className="h-4 w-4 text-amber-500" />
                        ) : (
                          <FileText className="h-4 w-4 text-emerald-500" />
                        )}
                        <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                          {lesson.title}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDuration(lesson.duration)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showEnrollDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Enroll in Course
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  This course is free for students.
                </p>
              </div>
              <button
                onClick={() => setShowEnrollDialog(false)}
                className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {enrollmentSuccess ? (
              <div className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-300" />
                </div>
                <h4 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                  Enrollment Successful!
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  You are now enrolled in {course.title}.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4 p-6">
                  <div className="rounded-2xl bg-indigo-50 p-4 dark:bg-indigo-900/20">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        Course Price
                      </span>
                      <span className="text-2xl font-black text-indigo-600">
                        Free
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                      You save ${course.price || 0} ({discountPercent}% OFF)
                    </p>
                  </div>

                  <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-3">
                      <Shield className="h-4 w-4 text-emerald-500" />
                      <span>Lifetime access to all course materials</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Award className="h-4 w-4 text-blue-500" />
                      <span>Certificate of completion included</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Brain className="h-4 w-4 text-purple-500" />
                      <span>Adaptive learning & retention tracking</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 border-t border-slate-200 p-6 dark:border-slate-800">
                  <button
                    onClick={() => setShowEnrollDialog(false)}
                    className="flex-1 rounded-xl bg-slate-100 px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEnrollment}
                    disabled={enrolling}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-70"
                  >
                    {enrolling ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        Confirm Free Enrollment
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseDetailPage;
