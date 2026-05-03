const crypto = require("crypto");
const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Course title is required"],
    trim: true,
    maxlength: [200, "Title cannot exceed 200 characters"],
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
  },
  description: {
    type: String,
    required: [true, "Course description is required"],
    maxlength: [2000, "Description cannot exceed 2000 characters"],
  },
  shortDescription: {
    type: String,
    maxlength: [300, "Short description cannot exceed 300 characters"],
  },
  thumbnail: {
    url: String,
    publicId: String,
  },
  coverImage: {
    url: String,
    publicId: String,
  },
  price: {
    type: Number,
    required: [true, "Course price is required"],
    min: [0, "Price cannot be negative"],
  },
  discountPrice: {
    type: Number,
    min: [0, "Discount price cannot be negative"],
    validate: {
      validator: function (value) {
        // Skip validation if value is undefined, null, or empty string
        if (value === undefined || value === null || value === "") return true;
        return value <= this.price;
      },
      message: "Discount price cannot be greater than original price",
    },
  },
  category: {
    type: String,
    required: [true, "Course category is required"],
  },
  tags: [
    {
      type: String,
      trim: true,
    },
  ],
  level: {
    type: String,
    enum: ["beginner", "intermediate", "advanced", "all-levels"],
    default: "all-levels",
  },
  language: {
    type: String,
    default: "english",
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Instructor is required"],
  },
  whatYouWillLearn: [
    {
      type: String,
      trim: true,
    },
  ],
  requirements: [
    {
      type: String,
      trim: true,
    },
  ],
  targetAudience: [
    {
      type: String,
      trim: true,
    },
  ],
  isPublished: {
    type: Boolean,
    default: false,
  },
  isApproved: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ["draft", "pending", "published", "rejected", "archived"],
    default: "draft",
  },
  approvalNote: {
    type: String,
  },
  students: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      enrolledAt: {
        type: Date,
        default: Date.now,
      },
      progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      completedAt: Date,
      lastAccessedAt: Date,
    },
  ],
  maxEnrollments: {
    type: Number,
    min: 0,
    default: null,
  },
  totalStudents: {
    type: Number,
    default: 0,
  },
  totalDuration: {
    type: Number,
    default: 0,
  },
  totalChapters: {
    type: Number,
    default: 0,
  },
  totalLessons: {
    type: Number,
    default: 0,
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  reviews: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
  certificate: {
    isEnabled: {
      type: Boolean,
      default: false,
    },
    template: String,
  },
  settings: {
    discussionForum: {
      type: Boolean,
      default: true,
    },
    dripContent: {
      type: Boolean,
      default: false,
    },
    prerequisite: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
    },
  },
  publishedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for better query performance
courseSchema.index({ title: "text", description: "text", tags: "text" });
courseSchema.index({ category: 1 });
courseSchema.index({ instructor: 1 });
courseSchema.index({ status: 1 });
courseSchema.index({ "rating.average": -1 });
courseSchema.index({ totalStudents: -1 });

// FIXED: Pre-save middleware - NO next parameter for async function
courseSchema.pre("save", async function () {
  if (this.isModified("title")) {
    const randomSuffix = crypto.randomBytes(3).toString("hex");
    this.slug =
      this.title
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Date.now().toString(36) +
      "-" +
      randomSuffix;
  }
  this.updatedAt = Date.now();
  // DO NOT call next() - Mongoose handles async pre hooks automatically
});

// Virtual for calculating discount percentage
courseSchema.virtual("discountPercentage").get(function () {
  if (this.discountPrice && this.price > 0) {
    return Math.round(((this.price - this.discountPrice) / this.price) * 100);
  }
  return 0;
});

// Method to check if course is free
courseSchema.methods.isFree = function () {
  return this.price === 0;
};

// Method to check if user is enrolled
courseSchema.methods.isStudentEnrolled = function (userId) {
  return this.students.some(
    (student) => student.user.toString() === userId.toString(),
  );
};

// Method to add student
courseSchema.methods.addStudent = function (userId) {
  if (!this.isStudentEnrolled(userId)) {
    this.students.push({
      user: userId,
      enrolledAt: Date.now(),
    });
    this.totalStudents = this.students.length;
  }
};

// Method to remove student
courseSchema.methods.removeStudent = function (userId) {
  this.students = this.students.filter(
    (student) => student.user.toString() !== userId.toString(),
  );
  this.totalStudents = this.students.length;
};

// Method to update student progress
courseSchema.methods.updateStudentProgress = function (userId, progress) {
  const student = this.students.find(
    (s) => s.user.toString() === userId.toString(),
  );
  if (student) {
    student.progress = progress;
    student.lastAccessedAt = Date.now();
    if (progress === 100) {
      student.completedAt = Date.now();
    }
  }
};

// Set virtuals to true when converting to JSON
courseSchema.set("toJSON", { virtuals: true });
courseSchema.set("toObject", { virtuals: true });

const Course = mongoose.model("Course", courseSchema);

module.exports = Course;
