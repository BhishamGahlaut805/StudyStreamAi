const mongoose = require("mongoose");
const { Schema } = mongoose;

/* -------------------------------------------------------------------------- */
/*                               Nested Schemas                               */
/* -------------------------------------------------------------------------- */

const socialLinksSchema = new Schema(
  {
    linkedin: {
      type: String,
      trim: true,
      default: "",
    },
    github: {
      type: String,
      trim: true,
      default: "",
    },
    twitter: {
      type: String,
      trim: true,
      default: "",
    },
    website: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false },
);

const projectSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    link: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

const achievementSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Achievement title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    date: {
      type: Date,
    },
    icon: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

const certificationSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Certification name is required"],
      trim: true,
    },
    issuer: {
      type: String,
      required: [true, "Issuer is required"],
      trim: true,
    },
    issueDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
    },
    credentialUrl: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

/* -------------------------------------------------------------------------- */
/*                              Main User Schema                              */
/* -------------------------------------------------------------------------- */

const userProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    /* ----------------------------- Basic Details ---------------------------- */

    profilePhoto: {
      type: String,
      trim: true,
      default: "",
    },

    fullName: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    dateOfBirth: {
      type: Date,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other", ""],
      default: "",
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    aboutMe: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    /* ---------------------------- Contact Details --------------------------- */

    contactNumber: {
      type: String,
      trim: true,
      default: "",
    },

    phoneNumber: {
      type: String,
      trim: true,
      default: "",
    },

    additionalEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    city: {
      type: String,
      trim: true,
      default: "",
    },

    state: {
      type: String,
      trim: true,
      default: "",
    },

    country: {
      type: String,
      trim: true,
      default: "",
    },

    pincode: {
      type: String,
      trim: true,
      default: "",
    },

    hometown: {
      type: String,
      trim: true,
      default: "",
    },

    currentLocation: {
      type: String,
      trim: true,
      default: "",
    },

    /* --------------------------- Professional Info -------------------------- */

    qualification: {
      type: String,
      trim: true,
      default: "",
    },

    education: {
      type: String,
      trim: true,
      default: "",
    },

    currentPosition: {
      type: String,
      trim: true,
      default: "",
    },

    specializations: [
      {
        type: String,
        trim: true,
      },
    ],

    experience: {
      type: Number,
      min: 0,
      default: 0,
    },

    skills: [
      {
        type: String,
        trim: true,
      },
    ],

    hobbies: [
      {
        type: String,
        trim: true,
      },
    ],

    interests: [
      {
        type: String,
        trim: true,
      },
    ],

    languages: [
      {
        type: String,
        trim: true,
      },
    ],

    /* ------------------------------ Portfolio ------------------------------- */

    projects: [projectSchema],

    achievements: [achievementSchema],

    certifications: [certificationSchema],

    websiteUrl: {
      type: String,
      trim: true,
      default: "",
    },

    linkedinUrl: {
      type: String,
      trim: true,
      default: "",
    },

    twitterUrl: {
      type: String,
      trim: true,
      default: "",
    },

    socialLinks: {
      type: socialLinksSchema,
      default: () => ({}),
    },

    /* ----------------------------- Teaching Info ---------------------------- */

    availability: {
      type: Schema.Types.Mixed,
      default: {},
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },

    coursesTaught: [
      {
        type: Schema.Types.ObjectId,
        ref: "Course",
      },
    ],

    /* -------------------------- Verification Status ------------------------- */

    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },

    verificationDate: {
      type: Date,
    },

    verificationDocument: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

/* -------------------------------------------------------------------------- */
/*                               Schema Hooks                                 */
/* -------------------------------------------------------------------------- */

// Normalize profile photo
userProfileSchema.pre("validate", function () {
  if (!this.profilePhoto) {
    this.profilePhoto = "";
  }
});

// Clean and normalize data before save
userProfileSchema.pre("save", function () {
  /* -------------------------- Normalize Social Links ------------------------- */

  if (this.socialLinks) {
    const socialKeys = ["linkedin", "github", "twitter", "website"];

    socialKeys.forEach((key) => {
      const value = this.socialLinks[key];

      if (
        typeof value === "string" &&
        value.trim() !== "" &&
        !/^https?:\/\//i.test(value)
      ) {
        this.socialLinks[key] = `https://${value}`;
      }
    });
  }

  /* ----------------------------- Clean Arrays ----------------------------- */

  const arrayFields = [
    "skills",
    "hobbies",
    "interests",
    "languages",
    "specializations",
  ];

  arrayFields.forEach((field) => {
    if (Array.isArray(this[field])) {
      this[field] = this[field]
        .map((item) => (typeof item === "string" ? item.trim() : item))
        .filter(Boolean);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                               Export Model                                 */
/* -------------------------------------------------------------------------- */

module.exports =
  mongoose.models.UserProfile ||
  mongoose.model("UserProfile", userProfileSchema);
