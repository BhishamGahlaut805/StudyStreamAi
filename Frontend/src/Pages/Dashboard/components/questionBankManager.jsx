// components/Teacher/QuestionBankManager.jsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import courseService from "../../../services/Course/CourseService";
import questionBankService from "../../../services/Course/questionBankService";

// Icons
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSave,
  FiX,
  FiUpload,
  FiDownload,
  FiSearch,
  FiFilter,
  FiBook,
  FiTarget,
  FiAlertCircle,
  FiCheckCircle,
  FiChevronRight,
  FiRefreshCw,
  FiLayers,
} from "react-icons/fi";

// const API_URL = import.meta.env.VITE_API_URL;

const QuestionBankManager = ({ courseId: propCourseId }) => {
  const [selectedCourseId, setSelectedCourseId] = useState(
    propCourseId || null,
  );
  const [teacherCourses, setTeacherCourses] = useState([]);
  const [questionBank, setQuestionBank] = useState(null);
  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [filterTopic, setFilterTopic] = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [newTopic, setNewTopic] = useState({
    name: "",
    description: "",
    weightage: 0,
  });

  const [newQuestion, setNewQuestion] = useState({
    questionId: "",
    text: "",
    type: "MCQ",
    difficulty: 0.3,
    difficulty_level: "easy",
    topic: "",
    options: [
      { id: "A", text: "" },
      { id: "B", text: "" },
      { id: "C", text: "" },
      { id: "D", text: "" },
    ],
    correct_answer: "A",
    explanation: "",
    marks: 2,
    expected_time: 60,
  });

  // Load teacher's courses on mount
  useEffect(() => {
    loadTeacherCourses();
  }, []);

  // Load question bank when course is selected
  useEffect(() => {
    if (selectedCourseId) {
      loadQuestionBank();
    }
  }, [selectedCourseId]);

  // Update selectedCourseId if prop changes
  useEffect(() => {
    if (propCourseId && propCourseId !== selectedCourseId) {
      setSelectedCourseId(propCourseId);
    }
  }, [propCourseId]);

  const loadTeacherCourses = async () => {
    try {
      setLoadingCourses(true);
      const response = await courseService.getTeacherCourses();
      if (response?.success) {
        setTeacherCourses(response.data || []);
      } else if (Array.isArray(response)) {
        setTeacherCourses(response);
      }
    } catch (err) {
      console.error("Error loading teacher courses:", err);
      setError("Failed to load your courses");
    } finally {
      setLoadingCourses(false);
    }
  };

  const loadQuestionBank = async () => {
    if (!selectedCourseId) return;

    try {
      setLoading(true);
      setError(null);
      const response =
        await questionBankService.getQuestionBankTeacher(selectedCourseId);

      if (response?.success) {
        setQuestionBank(response.data);
        setTopics(response.data?.topics || []);
        setQuestions(response.data?.questions || []);
      }
    } catch (err) {
      if (err.status === 404) {
        // Question bank doesn't exist yet - that's okay
        setQuestionBank(null);
        setTopics([]);
        setQuestions([]);
      } else {
        setError("Failed to load question bank");
        console.error("Error loading question bank:", err);
      }
    } finally {
      setLoading(false);
    }
  };

//   const getAuthHeaders = () => {
//     const token = localStorage.getItem("token");
//     return { Authorization: `Bearer ${token}` };
//   };

 const handleCreateQuestionBank = async () => {
   try {
     if (!selectedCourseId) {
       setError("Please select a course first");
       return;
     }

     const response =
       await questionBankService.createQuestionBank(selectedCourseId);

     if (response?.success) {
       setQuestionBank(response.data);
       setSuccess("Question bank created successfully");
       setTimeout(() => setSuccess(null), 3000);
     }
   } catch (err) {
     setError(err.message || "Failed to create question bank");
     setTimeout(() => setError(null), 5000);
   }
 };

  const handleAddTopic = async () => {
    try {
      if (!newTopic.name.trim()) {
        setError("Topic name is required");
        return;
      }

      // Check if topic already exists
      if (
        topics.some((t) => t.name.toLowerCase() === newTopic.name.toLowerCase())
      ) {
        setError("Topic already exists");
        return;
      }

      if (topics.length >= 12) {
        setError("Maximum 12 topics allowed");
        return;
      }

      const updatedTopics = [...topics, { ...newTopic, isActive: true }];

      await questionBankService.updateTopics(selectedCourseId, updatedTopics);

      setTopics(updatedTopics);
      setNewTopic({ name: "", description: "", weightage: 0 });
      setShowAddTopic(false);
      setSuccess("Topic added successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add topic");
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleRemoveTopic = async (topicName) => {
    if (!window.confirm(`Remove topic "${topicName}" and all its questions?`))
      return;

    try {
      const updatedTopics = topics.filter((t) => t.name !== topicName);

      await questionBankService.updateTopics(selectedCourseId, updatedTopics);

      setTopics(updatedTopics);
      await loadQuestionBank();
      setSuccess("Topic removed successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to remove topic");
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleAddQuestion = async () => {
    try {
      if (!newQuestion.questionId || !newQuestion.text || !newQuestion.topic) {
        setError("Question ID, text, and topic are required");
        return;
      }

      await questionBankService.addQuestions(selectedCourseId, [newQuestion]);

      await loadQuestionBank();
      resetNewQuestionForm();
      setShowAddQuestion(false);
      setSuccess("Question added successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add question");
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleUpdateQuestion = async () => {
    try {
      await questionBankService.updateQuestion(
        selectedCourseId,
        editingQuestion.questionId,
        editingQuestion,
      );

      await loadQuestionBank();
      setEditingQuestion(null);
      setSuccess("Question updated successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update question");
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm("Are you sure you want to delete this question?"))
      return;

    try {
     await questionBankService.deleteQuestion(selectedCourseId, questionId);
      await loadQuestionBank();
      setSuccess("Question deleted successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete question");
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.questions || !Array.isArray(data.questions)) {
        setError("Invalid JSON format: 'questions' array is required");
        return;
      }

      if (data.questions.length > 100) {
        setError("Maximum 100 questions can be uploaded at once");
        return;
      }

     await questionBankService.addQuestions(selectedCourseId, data.questions);

     // Update topics if provided
     if (data.topics && Array.isArray(data.topics)) {
       await questionBankService.updateTopics(selectedCourseId, data.topics);
     }

      await loadQuestionBank();
      setSuccess(`${data.questions.length} questions uploaded successfully`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("Invalid JSON format. Please check your file.");
      } else {
        setError(err.response?.data?.error || "Upload failed");
      }
      setTimeout(() => setError(null), 5000);
    }

    // Reset file input
    e.target.value = "";
  };

  const resetNewQuestionForm = () => {
    setNewQuestion({
      questionId: "",
      text: "",
      type: "MCQ",
      difficulty: 0.3,
      difficulty_level: "easy",
      topic: topics.length > 0 ? topics[0].name : "",
      options: [
        { id: "A", text: "" },
        { id: "B", text: "" },
        { id: "C", text: "" },
        { id: "D", text: "" },
      ],
      correct_answer: "A",
      explanation: "",
      marks: 2,
      expected_time: 60,
    });
  };

  const filteredQuestions = questions.filter((q) => {
    const matchTopic = filterTopic === "all" || q.topic === filterTopic;
    const matchDifficulty =
      filterDifficulty === "all" || q.difficulty_level === filterDifficulty;
    return matchTopic && matchDifficulty;
  });

  // Course Selection View
  if (!selectedCourseId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Question Bank Manager
        </h2>

        {loadingCourses ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600"></div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-indigo-100 dark:border-indigo-900 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FiBook className="w-5 h-5 text-indigo-600" />
              Select a Course
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Choose a course to manage its question bank
            </p>

            {teacherCourses.length === 0 ? (
              <div className="text-center py-8">
                <FiBook className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  No courses found. Create a course first.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teacherCourses.map((course) => (
                  <button
                    key={course._id}
                    onClick={() => {
                      setSelectedCourseId(course._id);
                      setQuestionBank(null);
                      setTopics([]);
                      setQuestions([]);
                    }}
                    className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all text-left group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {course.title}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {course.totalStudents || 0} students •{" "}
                          {course.totalLessons || 0} lessons
                        </p>
                        <span
                          className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs ${
                            course.status === "published"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                          }`}
                        >
                          {course.status}
                        </span>
                      </div>
                      <FiChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors mt-2" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Question Bank Manager
          </h2>
          <button
            onClick={() => {
              setSelectedCourseId(null);
              setQuestionBank(null);
            }}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
          >
            <FiRefreshCw className="w-4 h-4" />
            Change Course
          </button>
        </div>
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Question Bank Manager
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Course:{" "}
            {teacherCourses.find((c) => c._id === selectedCourseId)?.title ||
              "Selected Course"}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSelectedCourseId(null);
              setQuestionBank(null);
            }}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
          >
            <FiRefreshCw className="w-4 h-4" />
            Change Course
          </button>
          {questionBank && (
            <label className="px-4 py-2 bg-green-600 text-white rounded-xl cursor-pointer hover:bg-green-700 transition-colors flex items-center gap-2">
              <FiUpload className="w-4 h-4" />
              Bulk Upload JSON
              <input
                type="file"
                accept=".json"
                onChange={handleBulkUpload}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3"
          >
            <FiAlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto">
              <FiX className="w-5 h-5" />
            </button>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3"
          >
            <FiCheckCircle className="w-5 h-5 text-green-500" />
            <p className="text-sm text-green-700 dark:text-green-300">
              {success}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!questionBank ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-indigo-100 dark:border-indigo-900">
          <FiBook className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Question Bank Created
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Create a question bank to start adding questions and topics
          </p>
          <button
            onClick={handleCreateQuestionBank}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Create Question Bank
          </button>
        </div>
      ) : (
        <>
          {/* Topics Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-indigo-100 dark:border-indigo-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FiLayers className="w-5 h-5 text-indigo-600" />
                Topics ({topics.length}/12)
              </h3>
              <button
                onClick={() => setShowAddTopic(!showAddTopic)}
                disabled={topics.length >= 12}
                className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 ${
                  topics.length >= 12
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                <FiPlus className="w-4 h-4" />
                Add Topic
              </button>
            </div>

            {showAddTopic && (
              <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="Topic Name (required)"
                    value={newTopic.name}
                    onChange={(e) =>
                      setNewTopic({ ...newTopic, name: e.target.value })
                    }
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newTopic.description}
                    onChange={(e) =>
                      setNewTopic({ ...newTopic, description: e.target.value })
                    }
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <input
                    type="number"
                    placeholder="Weightage % (0-100)"
                    value={newTopic.weightage}
                    onChange={(e) =>
                      setNewTopic({
                        ...newTopic,
                        weightage: Math.min(
                          100,
                          Math.max(0, parseInt(e.target.value) || 0),
                        ),
                      })
                    }
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddTopic}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <FiSave className="w-4 h-4" />
                    Save Topic
                  </button>
                  <button
                    onClick={() => {
                      setShowAddTopic(false);
                      setNewTopic({ name: "", description: "", weightage: 0 });
                    }}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {topics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {topics.map((topic, index) => (
                  <span
                    key={index}
                    className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm flex items-center gap-2 group"
                  >
                    {topic.name}
                    <span className="text-xs text-indigo-400">
                      ({topic.weightage || 0}%)
                    </span>
                    <button
                      onClick={() => handleRemoveTopic(topic.name)}
                      className="ml-1 p-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 transition-colors"
                      title="Remove topic"
                    >
                      <FiX className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No topics added yet. Add topics before creating questions.
              </p>
            )}
          </div>

          {/* Questions Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-indigo-100 dark:border-indigo-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FiTarget className="w-5 h-5 text-indigo-600" />
                Questions ({questions.length})
              </h3>
              <div className="flex gap-3">
                <select
                  value={filterTopic}
                  onChange={(e) => setFilterTopic(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                >
                  <option value="all">All Topics</option>
                  {topics.map((topic, i) => (
                    <option key={i} value={topic.name}>
                      {topic.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                >
                  <option value="all">All Difficulty</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="very_hard">Very Hard</option>
                </select>
                <button
                  onClick={() => {
                    resetNewQuestionForm();
                    setShowAddQuestion(true);
                  }}
                  disabled={topics.length === 0}
                  className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 ${
                    topics.length === 0
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                  title={
                    topics.length === 0
                      ? "Add topics first"
                      : "Add a new question"
                  }
                >
                  <FiPlus className="w-4 h-4" />
                  Add Question
                </button>
              </div>
            </div>

            {/* Add Question Form */}
            {showAddQuestion && (
              <QuestionForm
                question={newQuestion}
                setQuestion={setNewQuestion}
                topics={topics}
                onSave={handleAddQuestion}
                onCancel={() => setShowAddQuestion(false)}
                mode="add"
              />
            )}

            {/* Edit Question Form */}
            {editingQuestion && (
              <QuestionForm
                question={editingQuestion}
                setQuestion={setEditingQuestion}
                topics={topics}
                onSave={handleUpdateQuestion}
                onCancel={() => setEditingQuestion(null)}
                mode="edit"
              />
            )}

            {/* Questions List */}
            {filteredQuestions.length > 0 ? (
              <div className="space-y-3 mt-4 max-h-[600px] overflow-y-auto">
                {filteredQuestions.map((question) => (
                  <div
                    key={question._id || question.questionId}
                    className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full font-mono">
                            {question.questionId}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full">
                            {question.topic}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              question.difficulty_level === "easy"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : question.difficulty_level === "medium"
                                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                                  : question.difficulty_level === "hard"
                                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            }`}
                          >
                            {question.difficulty_level}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {question.marks} marks • {question.expected_time}s
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 dark:text-white mb-2">
                          {question.text}
                        </p>
                        <div className="grid grid-cols-2 gap-1 mb-2">
                          {question.options?.map((option) => (
                            <p
                              key={option.id}
                              className={`text-xs px-2 py-1 rounded ${
                                option.id === question.correct_answer
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium"
                                  : "bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400"
                              }`}
                            >
                              <span className="font-bold">{option.id}:</span>{" "}
                              {option.text}
                            </p>
                          ))}
                        </div>
                        {question.explanation && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 border-t border-gray-200 dark:border-gray-600 pt-2">
                            <strong>Explanation:</strong> {question.explanation}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => setEditingQuestion(question)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit question"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteQuestion(question.questionId)
                          }
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete question"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FiTarget className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  {questions.length === 0
                    ? "No questions added yet"
                    : "No questions match the selected filters"}
                </p>
              </div>
            )}
          </div>

          {/* Question Bank Stats */}
          {questionBank?.metadata && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-indigo-100 dark:border-indigo-900 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FiBarChart2 className="w-5 h-5 text-indigo-600" />
                Question Bank Statistics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-indigo-600">
                    {questionBank.totalQuestions}
                  </p>
                  <p className="text-xs text-gray-500">Total Questions</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-indigo-600">
                    {Math.round(questionBank.metadata.averageDifficulty * 100)}%
                  </p>
                  <p className="text-xs text-gray-500">Avg Difficulty</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-indigo-600">
                    {questionBank.metadata.totalMarks}
                  </p>
                  <p className="text-xs text-gray-500">Total Marks</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-indigo-600">
                    {topics.length}
                  </p>
                  <p className="text-xs text-gray-500">Topics</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Question Form Component
const QuestionForm = ({
  question,
  setQuestion,
  topics,
  onSave,
  onCancel,
  mode,
}) => {
  const updateOption = (id, text) => {
    setQuestion({
      ...question,
      options: question.options.map((opt) =>
        opt.id === id ? { ...opt, text } : opt,
      ),
    });
  };

  const handleDifficultyChange = (level) => {
    const diffMap = {
      easy: 0.3,
      medium: 0.5,
      hard: 0.7,
      very_hard: 0.9,
    };
    setQuestion({
      ...question,
      difficulty_level: level,
      difficulty: diffMap[level],
    });
  };

  return (
    <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900">
      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
        {mode === "add" ? "Add New Question" : "Edit Question"}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <input
          type="text"
          placeholder="Question ID (e.g., math_001)"
          value={question.questionId}
          onChange={(e) =>
            setQuestion({ ...question, questionId: e.target.value })
          }
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
        <select
          value={question.topic}
          onChange={(e) => setQuestion({ ...question, topic: e.target.value })}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="">Select Topic</option>
          {topics.map((topic, i) => (
            <option key={i} value={topic.name}>
              {topic.name}
            </option>
          ))}
        </select>
        <select
          value={question.difficulty_level}
          onChange={(e) => handleDifficultyChange(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="easy">Easy (0.3)</option>
          <option value="medium">Medium (0.5)</option>
          <option value="hard">Hard (0.7)</option>
          <option value="very_hard">Very Hard (0.9)</option>
        </select>
        <input
          type="number"
          placeholder="Marks"
          value={question.marks}
          onChange={(e) =>
            setQuestion({
              ...question,
              marks: Math.max(1, parseInt(e.target.value) || 2),
            })
          }
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      </div>
      <textarea
        placeholder="Question Text *"
        value={question.text}
        onChange={(e) => setQuestion({ ...question, text: e.target.value })}
        rows={3}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-3"
      />
      <div className="space-y-2 mb-3">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Options:
        </p>
        {question.options.map((option) => (
          <div key={option.id} className="flex items-center gap-2">
            <span className="text-sm font-bold w-6 text-indigo-600 dark:text-indigo-400">
              {option.id}:
            </span>
            <input
              type="text"
              placeholder={`Option ${option.id}`}
              value={option.text}
              onChange={(e) => updateOption(option.id, e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <select
          value={question.correct_answer}
          onChange={(e) =>
            setQuestion({ ...question, correct_answer: e.target.value })
          }
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          {question.options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              Correct Answer: {opt.id}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Expected Time (seconds)"
          value={question.expected_time}
          onChange={(e) =>
            setQuestion({
              ...question,
              expected_time: Math.max(10, parseInt(e.target.value) || 60),
            })
          }
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      </div>
      <textarea
        placeholder="Explanation (optional)"
        value={question.explanation}
        onChange={(e) =>
          setQuestion({ ...question, explanation: e.target.value })
        }
        rows={2}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-3"
      />
      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium"
        >
          <FiSave className="w-4 h-4" />
          {mode === "add" ? "Add Question" : "Update Question"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// Missing icon
import { FiBarChart2 } from "react-icons/fi";

export default QuestionBankManager;
