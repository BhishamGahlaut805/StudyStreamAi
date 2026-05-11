const User = require("../models/user");
const UserProfile = require("../models/profile");
const asyncHandler = require("express-async-handler");
const fs = require("fs");
const path = require("path");

// @desc    Get user profile
// @route   GET /api/profile/me
// @access  Private
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .select("-password")
    .populate("profile");

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.json({
    ...user.toObject(),
    profile: user.profile || {},
  });
});

// @desc    Create or update user profile
// @route   PUT /api/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const {
    fullName,
    dateOfBirth,
    hometown,
    currentLocation,
    bio,
    contactNumber,
    additionalEmail,
    experience,
    currentPosition,
    education,
    skills,
    hobbies,
    interests,
    languages,
    projects,
    socialLinks,
  } = req.body;

  // Basic validation
  if (!fullName || !bio) {
    res.status(400);
    throw new Error("Full name and bio are required");
  }

  const profileFields = {
    fullName,
    dateOfBirth,
    hometown,
    currentLocation,
    bio,
    contactNumber,
    additionalEmail,
    experience: Number(experience) || 0,
    currentPosition,
    education,
    skills: Array.isArray(skills)
      ? skills
      : skills?.split(",").map((skill) => skill.trim()) || [],
    hobbies: Array.isArray(hobbies)
      ? hobbies
      : hobbies?.split(",").map((hobby) => hobby.trim()) || [],
    interests: Array.isArray(interests)
      ? interests
      : interests?.split(",").map((interest) => interest.trim()) || [],
    languages: Array.isArray(languages)
      ? languages
      : languages?.split(",").map((lang) => lang.trim()) || [],
    projects: projects || [],
    socialLinks: socialLinks || {},
    userId: req.user.id,
  };

  let user = await User.findById(req.user.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  let profile;
  if (user.profile) {
    // Update existing profile
    profile = await UserProfile.findByIdAndUpdate(
      user.profile,
      { $set: profileFields },
      { new: true, runValidators: true },
    );
  } else {
    // Create new profile
    profile = new UserProfile(profileFields);
    await profile.save();
    user.profile = profile._id;
    await user.save();
  }

  const updatedUser = await User.findById(req.user.id)
    .select("-password")
    .populate("profile");

  res.json(updatedUser);
});

// @desc    Upload profile photo
// @route   POST /api/profile/photo

const uploadProfilePhoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded",
    });
  }

  try {
    const user = await User.findById(req.user.id).populate("profile");
    if (!user) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let profile = user.profile;
    if (!profile) {
      profile = new UserProfile({ userId: req.user.id });
      await profile.save();
      user.profile = profile._id;
      await user.save();
    }

    // Delete old profile photo safely
    if (profile.profilePhoto) {
      const oldPhotoPath = path.resolve(__dirname, "../", profile.profilePhoto);
      if (
        oldPhotoPath !== path.resolve(req.file.path) &&
        fs.existsSync(oldPhotoPath)
      ) {
        fs.unlink(oldPhotoPath, (err) => {
          if (err) {
            console.error("Error deleting old profile photo:", err.message);
          }
        });
      }
    }

    // Save new photo path
    const relativePath = path
      .relative(path.join(__dirname, "../"), req.file.path)
      .replace(/\\/g, "/");

    profile.profilePhoto = relativePath;
    await profile.save();

    const fullUrl = `${req.protocol}://${req.get(
      "host",
    )}/uploads/${relativePath}`;

    res.status(200).json({
      success: true,
      profilePhoto: fullUrl,
      message: "Profile photo updated successfully",
    });
  } catch (error) {
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }

    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

const deleteProfilePhoto = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("profile");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.profile || !user.profile.profilePhoto) {
      return res.status(400).json({
        success: false,
        message: "No profile photo found to remove",
      });
    }

    // Get the absolute path to the photo
    const photoPath = path.resolve(__dirname, "../", user.profile.profilePhoto);

    // Delete the file from filesystem
    if (fs.existsSync(photoPath)) {
      fs.unlink(photoPath, (err) => {
        if (err) {
          console.error("Error deleting profile photo:", err);
        }
      });
    }

    // Update database
    user.profile.profilePhoto = "";
    await user.profile.save();

    res.status(200).json({
      success: true,
      message: "Profile photo removed successfully",
    });
  } catch (error) {
    console.error("Error deleting profile photo:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to remove profile photo",
    });
  }
});

module.exports = {
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  deleteProfilePhoto,
};
