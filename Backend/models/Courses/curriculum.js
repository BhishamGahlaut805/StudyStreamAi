const mongoose = require("mongoose");

const courseCurriculumSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      unique: true,
    },
    chapters: [
      {
        title: {
          type: String,
          required: true,
          trim: true,
        },
        description: String,
        order: {
          type: Number,
          required: true,
          default: 1,
        },
        lessons: [
          {
            title: {
              type: String,
              required: true,
              trim: true,
            },
            description: String,
            lessonType: {
              type: String,
              enum: ["video", "article", "quiz", "assignment", "resource"],
              default: "video",
            },
            videoUrl: String,
            videoDuration: {
              type: Number,
              default: 0,
            },
            articleContent: String,
            resources: [
              {
                title: String,
                fileUrl: String,
                fileType: String,
                fileSize: Number,
              },
            ],
            isPreview: {
              type: Boolean,
              default: false,
            },
            order: {
              type: Number,
              required: true,
              default: 1,
            },
            duration: {
              type: Number,
              default: 0,
            },
            isPublished: {
              type: Boolean,
              default: false,
            },
            completedBy: [
              {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
              },
            ],
          },
        ],
        totalDuration: {
          type: Number,
          default: 0,
        },
        totalLessons: {
          type: Number,
          default: 0,
        },
        isPublished: {
          type: Boolean,
          default: false,
        },
      },
    ],
    totalChapters: {
      type: Number,
      default: 0,
    },
    totalLessons: {
      type: Number,
      default: 0,
    },
    totalDuration: {
      type: Number,
      default: 0,
    },
    completionTime: {
      type: Number,
      default: 0,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  },
);

// Pre-save middleware to calculate totals
courseCurriculumSchema.pre("save", async function () {
  this.totalChapters = this.chapters.length;

  let totalLessons = 0;
  let totalDuration = 0;

  this.chapters.forEach((chapter) => {
    chapter.totalLessons = chapter.lessons.length;
    totalLessons += chapter.totalLessons;

    let chapterDuration = 0;
    chapter.lessons.forEach((lesson) => {
      chapterDuration += lesson.duration || 0;
    });
    chapter.totalDuration = chapterDuration;
    totalDuration += chapterDuration;
  });

  this.totalLessons = totalLessons;
  this.totalDuration = totalDuration;
  // DO NOT call next() - Mongoose handles async pre hooks automatically
});

// Post-save middleware to update course totals
courseCurriculumSchema.post("save", async function () {
  try {
    const Course = mongoose.model("Course");
    await Course.findByIdAndUpdate(this.course, {
      totalChapters: this.totalChapters,
      totalLessons: this.totalLessons,
      totalDuration: this.totalDuration,
    });
  } catch (error) {
    console.error("Error updating course totals:", error);
  }
});

// Methods for chapter management
courseCurriculumSchema.methods.addChapter = function (chapterData) {
  const newOrder =
    this.chapters.length > 0
      ? Math.max(...this.chapters.map((c) => c.order)) + 1
      : 1;

  this.chapters.push({
    ...chapterData,
    order: chapterData.order || newOrder,
  });

  return this;
};

courseCurriculumSchema.methods.removeChapter = function (chapterId) {
  this.chapters = this.chapters.filter(
    (chapter) => chapter._id.toString() !== chapterId.toString(),
  );
  return this;
};

courseCurriculumSchema.methods.reorderChapters = function (chapterOrders) {
  chapterOrders.forEach(({ chapterId, order }) => {
    const chapter = this.chapters.id(chapterId);
    if (chapter) {
      chapter.order = order;
    }
  });

  this.chapters.sort((a, b) => a.order - b.order);
  return this;
};

// Methods for lesson management
courseCurriculumSchema.methods.addLessonToChapter = function (
  chapterId,
  lessonData,
) {
  const chapter = this.chapters.id(chapterId);
  if (!chapter) {
    throw new Error("Chapter not found");
  }

  const newOrder =
    chapter.lessons.length > 0
      ? Math.max(...chapter.lessons.map((l) => l.order)) + 1
      : 1;

  chapter.lessons.push({
    ...lessonData,
    order: lessonData.order || newOrder,
  });

  return this;
};

courseCurriculumSchema.methods.removeLessonFromChapter = function (
  chapterId,
  lessonId,
) {
  const chapter = this.chapters.id(chapterId);
  if (!chapter) {
    throw new Error("Chapter not found");
  }

  chapter.lessons = chapter.lessons.filter(
    (lesson) => lesson._id.toString() !== lessonId.toString(),
  );
  return this;
};

courseCurriculumSchema.methods.updateLessonInChapter = function (
  chapterId,
  lessonId,
  updateData,
) {
  const chapter = this.chapters.id(chapterId);
  if (!chapter) {
    throw new Error("Chapter not found");
  }

  const lesson = chapter.lessons.id(lessonId);
  if (!lesson) {
    throw new Error("Lesson not found");
  }

  Object.assign(lesson, updateData);
  return this;
};

const CourseCurriculum = mongoose.model(
  "CourseCurriculum",
  courseCurriculumSchema,
);

module.exports = CourseCurriculum;
