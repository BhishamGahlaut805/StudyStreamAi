const asyncHandler = require("../middleware/asyncHandler");
const ErrorResponse = require("../utils/ErrorResponse");
const Profile = require("../models/profile");
const User = require("../models/user");
const fs = require("fs");
const path = require("path");

/**
 * Get current user profile
 * GET /api/profile/me
 */
exports.getMyProfile = asyncHandler(async (req, res, next) => {
  const profile = await Profile.findOne({ user: req.user.id })
    .populate("user", "name email role")
    .populate("coursesTaught", "title description status");

  if (!profile) {
    // Create default profile if doesn't exist
    const newProfile = await Profile.create({ user: req.user.id });
    return res.status(201).json({
      success: true,
      data: newProfile,
    });
  }

  res.status(200).json({
    success: true,
    data: profile,
  });
});

/**
 * Get profile by user ID
 * GET /api/profile/user/:userId
 */
exports.getProfileByUserId = asyncHandler(async (req, res, next) => {
  const profile = await Profile.findOne({ user: req.params.userId })
    .populate("user", "name email role studentId")
    .populate("coursesTaught", "title description rating");

  if (!profile) {
    return next(new ErrorResponse("Profile not found", 404));
  }

  res.status(200).json({
    success: true,
    data: profile,
  });
});

/**
 * Update profile
 * PUT /api/profile
 */
exports.updateProfile = asyncHandler(async (req, res, next) => {
  let profile = await Profile.findOne({ user: req.user.id });

  if (!profile) {
    profile = await Profile.create({ user: req.user.id });
  }

  // Fields that can be updated
  const allowedFields = [
    "bio",
    "phoneNumber",
    "dateOfBirth",
    "gender",
    "address",
    "city",
    "state",
    "country",
    "pincode",
    "qualification",
    "specializations",
    "experience",
    "websiteUrl",
    "linkedinUrl",
    "twitterUrl",
    "socialLinks",
    "aboutMe",
    "interests",
    "certifications",
    "languages",
    "availability",
  ];

  const updates = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  profile = await Profile.findOneAndUpdate({ user: req.user.id }, updates, {
    new: true,
    runValidators: true,
  })
    .populate("user", "name email role")
    .populate("coursesTaught", "title");

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: profile,
  });
});

/**
 * Upload profile photo
 * POST /api/profile/photo
 */
exports.uploadProfilePhoto = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorResponse("Please upload a file", 400));
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return next(
      new ErrorResponse(
        "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed",
        400,
      ),
    );
  }

  // Validate file size (max 5MB)
  const maxFileSize = 5 * 1024 * 1024; // 5MB
  if (req.file.size > maxFileSize) {
    return next(
      new ErrorResponse("File size exceeds maximum limit of 5MB", 400),
    );
  }

  let profile = await Profile.findOne({ user: req.user.id });

  if (!profile) {
    profile = await Profile.create({ user: req.user.id });
  }

  // Delete old profile photo if exists
  if (profile.profilePhoto) {
    const oldFilePath = path.join(
      __dirname,
      "../../uploads/profiles",
      path.basename(profile.profilePhoto),
    );
    if (fs.existsSync(oldFilePath)) {
      fs.unlinkSync(oldFilePath);
    }
  }

  // Save new photo path
  const fileName = `${req.user.id}-${Date.now()}.${req.file.mimetype.split("/")[1]}`;
  const filePath = `/uploads/profiles/${fileName}`;

  // Ensure upload directory exists
  const uploadDir = path.join(__dirname, "../../uploads/profiles");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Save file
  fs.writeFileSync(path.join(uploadDir, fileName), req.file.buffer);

  profile.profilePhoto = filePath;
  await profile.save();

  res.status(200).json({
    success: true,
    message: "Profile photo uploaded successfully",
    data: {
      profilePhoto: profile.profilePhoto,
    },
  });
});

/**
 * Delete profile photo
 * DELETE /api/profile/delete/photo
 */
exports.deleteProfilePhoto = asyncHandler(async (req, res, next) => {
  const profile = await Profile.findOne({ user: req.user.id });

  if (!profile) {
    return next(new ErrorResponse("Profile not found", 404));
  }

  if (!profile.profilePhoto) {
    return next(new ErrorResponse("No profile photo to delete", 400));
  }

  // Delete file from filesystem
  const filePath = path.join(
    __dirname,
    "../../uploads/profiles",
    path.basename(profile.profilePhoto),
  );
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  profile.profilePhoto = null;
  await profile.save();

  res.status(200).json({
    success: true,
    message: "Profile photo deleted successfully",
    data: profile,
  });
});

/**
 * Get public profile
 * GET /api/profile/public/:userId
 */
exports.getPublicProfile = asyncHandler(async (req, res, next) => {
  const profile = await Profile.findOne({ user: req.params.userId })
    .select(
      "bio profilePhoto specializations experience rating totalReviews coursesTaught socialLinks aboutMe interests certifications languages availability",
    )
    .populate("user", "name email role")
    .populate("coursesTaught", "title description rating enrolledStudents");

  if (!profile) {
    return next(new ErrorResponse("Profile not found", 404));
  }

  res.status(200).json({
    success: true,
    data: profile,
  });
});

/**
 * Update teacher verification status
 * PUT /api/profile/verify
 */
exports.updateVerificationStatus = asyncHandler(async (req, res, next) => {
  // Only admin can update verification status
  if (req.user.role !== "admin") {
    return next(
      new ErrorResponse("Only admins can update verification status", 403),
    );
  }

  const { userId, status, document } = req.body;

  if (!["pending", "verified", "rejected"].includes(status)) {
    return next(new ErrorResponse("Invalid verification status", 400));
  }

  const profile = await Profile.findOneAndUpdate(
    { user: userId },
    {
      verificationStatus: status,
      verificationDate: Date.now(),
      verificationDocument: document || undefined,
    },
    { new: true, runValidators: true },
  );

  if (!profile) {
    return next(new ErrorResponse("Profile not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Verification status updated",
    data: profile,
  });
});

/**
 * Get all teacher profiles (for admin/browse)
 * GET /api/profile/teachers
 */
exports.getAllTeachers = asyncHandler(async (req, res, next) => {
  const { search, specialization, minRating, sortBy } = req.query;

  let query = {};

  // Search in bio and aboutMe
  if (search) {
    query.$or = [
      { bio: { $regex: search, $options: "i" } },
      { aboutMe: { $regex: search, $options: "i" } },
    ];
  }

  if (specialization) {
    query.specializations = specialization;
  }

  if (minRating) {
    query.rating = { $gte: parseFloat(minRating) };
  }

  let sortOption = { rating: -1 }; // Default sort by rating
  if (sortBy === "experience") {
    sortOption = { experience: -1 };
  } else if (sortBy === "newest") {
    sortOption = { createdAt: -1 };
  }

  const profiles = await Profile.find(query)
    .select("-verificationDocument")
    .populate("user", "name email")
    .populate("coursesTaught", "title description rating")
    .sort(sortOption)
    .limit(100);

  res.status(200).json({
    success: true,
    count: profiles.length,
    data: profiles,
  });
});

/**
 * Add achievement
 * POST /api/profile/achievement
 */
exports.addAchievement = asyncHandler(async (req, res, next) => {
  const { title, description, date, icon } = req.body;

  if (!title) {
    return next(new ErrorResponse("Achievement title is required", 400));
  }

  const profile = await Profile.findOne({ user: req.user.id });

  if (!profile) {
    return next(new ErrorResponse("Profile not found", 404));
  }

  profile.achievements.push({
    title,
    description,
    date,
    icon,
  });

  await profile.save();

  res.status(201).json({
    success: true,
    message: "Achievement added successfully",
    data: profile.achievements,
  });
});

/**
 * Delete achievement
 * DELETE /api/profile/achievement/:achievementId
 */
exports.deleteAchievement = asyncHandler(async (req, res, next) => {
  const profile = await Profile.findOne({ user: req.user.id });

  if (!profile) {
    return next(new ErrorResponse("Profile not found", 404));
  }

  profile.achievements = profile.achievements.filter(
    (a) => a._id.toString() !== req.params.achievementId,
  );

  await profile.save();

  res.status(200).json({
    success: true,
    message: "Achievement deleted successfully",
    data: profile.achievements,
  });
});

/**
 * Add certification
 * POST /api/profile/certification
 */
exports.addCertification = asyncHandler(async (req, res, next) => {
  const { name, issuer, issueDate, expiryDate, credentialUrl } = req.body;

  if (!name || !issuer) {
    return next(
      new ErrorResponse("Certification name and issuer are required", 400),
    );
  }

  const profile = await Profile.findOne({ user: req.user.id });

  if (!profile) {
    return next(new ErrorResponse("Profile not found", 404));
  }

  profile.certifications.push({
    name,
    issuer,
    issueDate,
    expiryDate,
    credentialUrl,
  });

  await profile.save();

  res.status(201).json({
    success: true,
    message: "Certification added successfully",
    data: profile.certifications,
  });
});

/**
 * Delete certification
 * DELETE /api/profile/certification/:certId
 */
exports.deleteCertification = asyncHandler(async (req, res, next) => {
  const profile = await Profile.findOne({ user: req.user.id });

  if (!profile) {
    return next(new ErrorResponse("Profile not found", 404));
  }

  profile.certifications = profile.certifications.filter(
    (c) => c._id.toString() !== req.params.certId,
  );

  await profile.save();

  res.status(200).json({
    success: true,
    message: "Certification deleted successfully",
    data: profile.certifications,
  });
});

/**
 * Update rating (typically called after course review)
 * PUT /api/profile/rating
 */
exports.updateRating = asyncHandler(async (req, res, next) => {
  const { userId, newRating } = req.body;

  if (typeof newRating !== "number" || newRating < 0 || newRating > 5) {
    return next(new ErrorResponse("Invalid rating value", 400));
  }

  const profile = await Profile.findOne({ user: userId });

  if (!profile) {
    return next(new ErrorResponse("Profile not found", 404));
  }

  // Calculate weighted average
  const currentTotal = profile.rating * profile.totalReviews;
  profile.totalReviews += 1;
  profile.rating = (currentTotal + newRating) / profile.totalReviews;

  await profile.save();

  res.status(200).json({
    success: true,
    message: "Rating updated successfully",
    data: {
      rating: profile.rating,
      totalReviews: profile.totalReviews,
    },
  });
});
