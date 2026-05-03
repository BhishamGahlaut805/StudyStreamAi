const mongoose = require("mongoose");

const ProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"],
    },
    profilePhoto: {
      type: String,
      default: null,
    },
    phoneNumber: {
      type: String,
      match: [/^\d{10}$/, "Please provide a valid 10-digit phone number"],
    },
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    address: String,
    city: String,
    state: String,
    country: String,
    pincode: String,
    qualification: {
      type: String,
      enum: ["Bachelor", "Master", "PhD", "Diploma", "Other"],
    },
    specializations: [String],
    experience: {
      type: Number, // in years
      min: 0,
      default: 0,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    coursesTaught: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    totalStudents: {
      type: Number,
      default: 0,
    },
    websiteUrl: String,
    linkedinUrl: String,
    twitterUrl: String,
    socialLinks: {
      website: String,
      linkedin: String,
      twitter: String,
      github: String,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    verificationDate: Date,
    verificationDocument: String,
    aboutMe: {
      type: String,
      maxlength: [1000, "About Me cannot exceed 1000 characters"],
    },
    interests: [String],
    achievements: [
      {
        title: String,
        description: String,
        date: Date,
        icon: String,
      },
    ],
    certifications: [
      {
        name: String,
        issuer: String,
        issueDate: Date,
        expiryDate: Date,
        credentialUrl: String,
      },
    ],
    languages: [String],
    availability: {
      isAvailable: {
        type: Boolean,
        default: true,
      },
      hoursPerWeek: Number,
      timezone: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Update the updatedAt field before saving
ProfileSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Get profile with user details
ProfileSchema.methods.getFullProfile = async function () {
  await this.populate("user", "name email role studentId lastLogin");
  return {
    id: this._id,
    user: this.user,
    bio: this.bio,
    profilePhoto: this.profilePhoto,
    phoneNumber: this.phoneNumber,
    dateOfBirth: this.dateOfBirth,
    gender: this.gender,
    address: this.address,
    city: this.city,
    state: this.state,
    country: this.country,
    pincode: this.pincode,
    qualification: this.qualification,
    specializations: this.specializations,
    experience: this.experience,
    rating: this.rating,
    totalReviews: this.totalReviews,
    coursesTaught: this.coursesTaught,
    totalStudents: this.totalStudents,
    websiteUrl: this.websiteUrl,
    linkedinUrl: this.linkedinUrl,
    twitterUrl: this.twitterUrl,
    socialLinks: this.socialLinks,
    verificationStatus: this.verificationStatus,
    aboutMe: this.aboutMe,
    interests: this.interests,
    achievements: this.achievements,
    certifications: this.certifications,
    languages: this.languages,
    availability: this.availability,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports =
  mongoose.models.Profile || mongoose.model("Profile", ProfileSchema);
