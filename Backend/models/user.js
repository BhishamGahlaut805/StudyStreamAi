const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    password: {
      type: String,
      required: [
        function () {
          return !this.googleId;
        },
        "Please add a password",
      ],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ["student", "teacher", "admin"],
      default: "student",
    },
    studentId: {
      type: String,
      unique: true,
      sparse: true,
    },
    profile: {
      phone: String,
      dateOfBirth: Date,
      gender: {
        type: String,
        enum: ["male", "female", "other"],
      },
      address: String,
      city: String,
      state: String,
      pincode: String,
    },
    examPreferences: {
      targetExam: {
        type: String,
        enum: ["SSC CGL", "SSC CHSL", "SSC MTS", "SSC GD", "Other"],
      },
      preferredSubjects: [String],
      dailyGoal: {
        type: Number,
        default: 50, // minutes
      },
      difficultyLevel: {
        type: String,
        enum: ["beginner", "intermediate", "advanced"],
        default: "beginner",
      },
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },

    lastLogin: {
      type: Date,
      default: Date.now,
    },
    isVerified: {
      type: Boolean,
      default: function () {
        return this.role === "student" ? true : false;
      },
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Encrypt password using bcrypt
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  if (!this.password) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Generate student ID
UserSchema.pre("save", async function () {
  if (this.role === "student" && !this.studentId) {
    const UserModel = mongoose.models.User || mongoose.model("User");

    const latestStudent = await UserModel.findOne({
      studentId: /^STU\d{6}$/,
    })
      .sort({ studentId: -1 })
      .select("studentId")
      .lean();

    let nextNumber = latestStudent?.studentId
      ? parseInt(latestStudent.studentId.replace("STU", ""), 10) + 1
      : 1;

    let generatedId = `STU${String(nextNumber).padStart(6, "0")}`;
    let exists = await UserModel.exists({ studentId: generatedId });

    while (exists) {
      nextNumber += 1;
      generatedId = `STU${String(nextNumber).padStart(6, "0")}`;
      exists = await UserModel.exists({ studentId: generatedId });
    }

    this.studentId = generatedId;
  }
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role, studentId: this.studentId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE },
  );
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await this.matchPassword(enteredPassword);
};

UserSchema.methods.getPublicProfile = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    studentId: this.studentId,
    profile: this.profile,
    examPreferences: this.examPreferences,
    isVerified: this.isVerified,
    lastLogin: this.lastLogin,
  };
};

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
