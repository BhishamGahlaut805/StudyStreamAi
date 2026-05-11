const asyncHandler = require("../middleware/asyncHandler");
const ErrorResponse = require("../utils/ErrorResponse");
const Profile = require("../models/profile");

const AVATARS = [
  "https://png.pngtree.com/png-clipart/20230927/original/pngtree-man-avatar-image-for-profile-png-image_13001877.png",
  "https://static.vecteezy.com/system/resources/thumbnails/027/951/137/small/stylish-spectacles-guy-3d-avatar-character-illustrations-png.png",
  "https://png.pngtree.com/png-vector/20231019/ourmid/pngtree-user-profile-avatar-png-image_10211467.png",
  "https://static.vecteezy.com/system/resources/previews/024/183/525/non_2x/avatar-of-a-man-portrait-of-a-young-guy-illustration-of-male-character-in-modern-color-style-vector.jpg",
  "https://png.pngtree.com/png-clipart/20230927/original/pngtree-man-avatar-image-for-profile-png-image_13001882.png",
];

const pickAvatar = (seedValue) => {
  const seedString = String(seedValue || "");
  let hash = 0;

  for (let index = 0; index < seedString.length; index += 1) {
    hash = (hash * 31 + seedString.charCodeAt(index)) >>> 0;
  }

  return AVATARS[hash % AVATARS.length];
};

const ensureAvatar = (profile, userId) => {
  if (!profile.profilePhoto) {
    profile.profilePhoto = pickAvatar(userId || profile.userId || Date.now());
  }
};

const baseProfileSelect =
  "bio profilePhoto fullName dateOfBirth hometown currentLocation contactNumber additionalEmail experience currentPosition education skills hobbies interests languages projects socialLinks aboutMe phoneNumber gender address city state country pincode qualification specializations websiteUrl linkedinUrl twitterUrl availability achievements certifications rating totalReviews verificationStatus verificationDate verificationDocument coursesTaught";

exports.getMyProfile = asyncHandler(async (req, res, next) => {
  let profile = await Profile.findOne({ userId: req.user.id })
    .populate("userId", "name email role")
    .populate("coursesTaught", "title description status");

  if (!profile) {
    profile = await Profile.create({
      userId: req.user.id,
      profilePhoto: pickAvatar(req.user.id),
    });
    profile = await Profile.findById(profile._id)
      .populate("userId", "name email role")
      .populate("coursesTaught", "title description status");
  }

  ensureAvatar(profile, req.user.id);
  if (!profile.profilePhoto) {
    await profile.save();
  }

  res.status(200).json({
    success: true,
    data: profile,
  });
});

exports.getProfileByUserId = asyncHandler(async (req, res, next) => {
  const profile = await Profile.findOne({ userId: req.params.userId })
    .populate("userId", "name email role studentId")
    .populate("coursesTaught", "title description rating");

  if (!profile) {
    throw new ErrorResponse("Profile not found", 404);
  }

  ensureAvatar(profile, req.params.userId);
  if (!profile.profilePhoto) {
    await profile.save();
  }

  res.status(200).json({
    success: true,
    data: profile,
  });
});

exports.updateProfile = asyncHandler(async (req, res, next) => {
  let profile = await Profile.findOne({ userId: req.user.id });

  if (!profile) {
    profile = await Profile.create({
      userId: req.user.id,
      profilePhoto: pickAvatar(req.user.id),
    });
  }

  const allowedFields = [
    "fullName",
    "dateOfBirth",
    "hometown",
    "currentLocation",
    "bio",
    "contactNumber",
    "additionalEmail",
    "experience",
    "currentPosition",
    "education",
    "skills",
    "hobbies",
    "interests",
    "languages",
    "projects",
    "socialLinks",
    "aboutMe",
    "phoneNumber",
    "gender",
    "address",
    "city",
    "state",
    "country",
    "pincode",
    "qualification",
    "specializations",
    "websiteUrl",
    "linkedinUrl",
    "twitterUrl",
    "availability",
  ];

  const updates = {};

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  if (!profile.profilePhoto) {
    updates.profilePhoto = pickAvatar(req.user.id);
  }

  profile = await Profile.findOneAndUpdate({ userId: req.user.id }, updates, {
    new: true,
    runValidators: true,
  })
    .populate("userId", "name email role")
    .populate("coursesTaught", "title");

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: profile,
  });
});

exports.getPublicProfile = asyncHandler(async (req, res, next) => {
  const profile = await Profile.findOne({ userId: req.params.userId })
    .select(baseProfileSelect)
    .populate("userId", "name email role")
    .populate("coursesTaught", "title description rating enrolledStudents");

  if (!profile) {
    throw new ErrorResponse("Profile not found", 404);
  }

  ensureAvatar(profile, req.params.userId);
  if (!profile.profilePhoto) {
    await profile.save();
  }

  res.status(200).json({
    success: true,
    data: profile,
  });
});

exports.updateVerificationStatus = asyncHandler(async (req, res, next) => {
  if (req.user.role !== "admin") {
    throw new ErrorResponse("Only admins can update verification status", 403);
  }

  const { userId, status, document } = req.body;

  if (!userId) {
    throw new ErrorResponse("User ID is required", 400);
  }

  if (!["pending", "verified", "rejected"].includes(status)) {
    throw new ErrorResponse("Invalid verification status", 400);
  }

  const profile = await Profile.findOneAndUpdate(
    { userId },
    {
      verificationStatus: status,
      verificationDate: Date.now(),
      verificationDocument: document || undefined,
    },
    { new: true, runValidators: true },
  ).populate("userId", "name email role");

  if (!profile) {
    throw new ErrorResponse("Profile not found", 404);
  }

  ensureAvatar(profile, userId);
  if (!profile.profilePhoto) {
    await profile.save();
  }

  res.status(200).json({
    success: true,
    message: "Verification status updated",
    data: profile,
  });
});

exports.getAllTeachers = asyncHandler(async (req, res, next) => {
  const { search, specialization, minRating, sortBy } = req.query;

  const query = {};

  if (search) {
    query.$or = [
      { bio: { $regex: search, $options: "i" } },
      { aboutMe: { $regex: search, $options: "i" } },
      { fullName: { $regex: search, $options: "i" } },
    ];
  }

  if (specialization) {
    query.specializations = specialization;
  }

  if (minRating) {
    query.rating = { $gte: parseFloat(minRating) };
  }

  let sortOption = { rating: -1 };
  if (sortBy === "experience") {
    sortOption = { experience: -1 };
  } else if (sortBy === "newest") {
    sortOption = { createdAt: -1 };
  }

  const profiles = await Profile.find(query)
    .select("-verificationDocument")
    .populate("userId", "name email")
    .populate("coursesTaught", "title description rating")
    .sort(sortOption)
    .limit(100);

  res.status(200).json({
    success: true,
    count: profiles.length,
    data: profiles,
  });
});

exports.addAchievement = asyncHandler(async (req, res, next) => {
  const { title, description, date, icon } = req.body;

  if (!title) {
    throw new ErrorResponse("Achievement title is required", 400);
  }

  const profile = await Profile.findOne({ userId: req.user.id });

  if (!profile) {
    throw new ErrorResponse("Profile not found", 404);
  }

  profile.achievements = profile.achievements || [];
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

exports.deleteAchievement = asyncHandler(async (req, res, next) => {
  const profile = await Profile.findOne({ userId: req.user.id });

  if (!profile) {
    throw new ErrorResponse("Profile not found", 404);
  }

  profile.achievements = (profile.achievements || []).filter(
    (achievement) => achievement._id.toString() !== req.params.achievementId,
  );

  await profile.save();

  res.status(200).json({
    success: true,
    message: "Achievement deleted successfully",
    data: profile.achievements,
  });
});

exports.addCertification = asyncHandler(async (req, res, next) => {
  const { name, issuer, issueDate, expiryDate, credentialUrl } = req.body;

  if (!name || !issuer) {
    throw new ErrorResponse("Certification name and issuer are required", 400);
  }

  const profile = await Profile.findOne({ userId: req.user.id });

  if (!profile) {
    throw new ErrorResponse("Profile not found", 404);
  }

  profile.certifications = profile.certifications || [];
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

exports.deleteCertification = asyncHandler(async (req, res, next) => {
  const profile = await Profile.findOne({ userId: req.user.id });

  if (!profile) {
    throw new ErrorResponse("Profile not found", 404);
  }

  profile.certifications = (profile.certifications || []).filter(
    (certification) => certification._id.toString() !== req.params.certId,
  );

  await profile.save();

  res.status(200).json({
    success: true,
    message: "Certification deleted successfully",
    data: profile.certifications,
  });
});

exports.updateRating = asyncHandler(async (req, res, next) => {
  const { userId, newRating } = req.body;

  if (typeof newRating !== "number" || newRating < 0 || newRating > 5) {
    throw new ErrorResponse("Invalid rating value", 400);
  }

  const profile = await Profile.findOne({ userId });

  if (!profile) {
    throw new ErrorResponse("Profile not found", 404);
  }

  const currentTotal = (profile.rating || 0) * (profile.totalReviews || 0);
  profile.totalReviews = (profile.totalReviews || 0) + 1;
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

exports.getProfile = exports.getMyProfile;
