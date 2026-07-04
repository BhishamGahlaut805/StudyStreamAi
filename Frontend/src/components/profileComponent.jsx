// UserProfile.jsx
import React, { useState, useEffect } from "react";
import {
  FiEdit,
  FiUser,
  FiMail,
  FiPhone,
  FiMapPin,
  FiCalendar,
  FiGlobe,
  FiGithub,
  FiLinkedin,
  FiTwitter,
  FiBriefcase,
  FiHeart,
  FiX,
} from "react-icons/fi";
import ProfileImage from "./Image";
import EditProfileModal from "./EditProfileComponent";
import profileService from "../services/profileService";
import AlertMessage from "./AlertMessage";
import StyledCard from "./StyleCard";

const UserProfile = ({ user }) => {
  const [activeTab, setActiveTab] = useState("personal");
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [alert, setAlert] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "success",
  });

  const showAlert = (type, message) => {
    setAlert((prev) => ({
      ...prev,
      isOpen: true,
      title: type === "success" ? "Success" : "Error",
      message: message,
      type: type,
    }));

    setTimeout(() => {
      setAlert((prev) => ({ ...prev, isOpen: false }));
    }, 3000);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Not specified";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const normalizeProfileResponse = (response) => {
    if (!response) return null;
    if (
      response.data &&
      typeof response.data === "object" &&
      !Array.isArray(response.data)
    ) {
      return response.data;
    }
    return response;
  };

  const formatSocialLink = (url) => {
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) return `https://${url}`;
    return url;
  };

  const getProfileSocialLink = (profileData, key) => {
    if (!profileData) return null;
    const socialLinks = profileData.socialLinks || {};

    if (key === "website") {
      return socialLinks.website || profileData.websiteUrl || null;
    }

    if (key === "linkedin") {
      return socialLinks.linkedin || profileData.linkedinUrl || null;
    }

    if (key === "twitter") {
      return socialLinks.twitter || profileData.twitterUrl || null;
    }

    return socialLinks[key] || profileData[`${key}Url`] || null;
  };

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const data = await profileService.getMyProfile();
      setProfile(normalizeProfileResponse(data));
    } catch (error) {
      console.error("Profile fetch error:", error);
      showAlert("error", error.message || "Failed to fetch profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async (updatedProfile) => {
    try {
      await profileService.updateProfile(updatedProfile);
      showAlert("success", "Profile updated successfully");
      setIsEditMode(false);
      await fetchProfile();
    } catch (error) {
      showAlert("error", error.message || "Failed to update profile");
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const userData = {
    ...user,
    profile: profile || {},
  };
  const profileData = userData.profile || {};
  const displayName =
    profileData.fullName || profileData.userId?.name || userData.name || "User";
  const emailAddress =
    profileData.userId?.email ||
    userData.email ||
    profileData.additionalEmail ||
    "";
  const contactNumber =
    profileData.contactNumber || profileData.phoneNumber || "";
  const profileLocation = [
    profileData.city,
    profileData.state,
    profileData.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6 sm:px-1 lg:px-2">
      <AlertMessage
        isOpen={alert.isOpen}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onClose={() => setAlert((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Main Profile Container */}
      <div className="relative overflow-hidden rounded-2xl lg:rounded-3xl shadow-xl">
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-indigo-600 to-blue-500 opacity-10"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500 rounded-full filter blur-3xl opacity-20"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500 rounded-full filter blur-3xl opacity-20"></div>

        {/* Main Profile Card */}
        <div className="relative bg-white dark:bg-gray-900 backdrop-blur-sm bg-opacity-90 dark:bg-opacity-90 rounded-2xl lg:rounded-3xl overflow-hidden flex flex-col lg:flex-row text-gray-900 dark:text-blue-200 shadow-md hover:ring-2 hover:ring-indigo-300 dark:hover:ring-blue-500 transition-all duration-300 ease-in-out">
          {/* Sidebar Profile Section */}
          <div className="w-full lg:w-1/3 bg-gradient-to-b from-pink-100 to-rose-50 dark:from-[#0f172a] dark:to-[#1e293b] p-4 sm:p-6 flex flex-col items-center text-gray-900 dark:text-indigo-100">
            <div className="relative group mb-4 sm:mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-400 to-indigo-600 transform rotate-6 scale-105 opacity-70 group-hover:opacity-100 transition-all duration-300"></div>
              <ProfileImage
                src={profileData.profilePhoto}
                alt={`${displayName}'s profile`}
                className="relative w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-full border-4 border-white dark:border-gray-800 object-cover shadow-xl z-10"
              />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-center text-gray-800 dark:text-white mt-2 sm:mt-4">
              {displayName}
            </h1>
            {profileData.fullName && (
              <p className="text-gray-600 dark:text-gray-300 text-center text-sm sm:text-base">
                ({profileData.fullName})
              </p>
            )}

            <div className="mt-2 px-3 py-1 sm:px-4 sm:py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-xs sm:text-sm font-medium capitalize shadow-md">
              {userData.role || "User"}
            </div>

            {profileData.verificationStatus && (
              <div className="mt-3 inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700 shadow-sm dark:bg-gray-800/70 dark:text-gray-200">
                Verification: {profileData.verificationStatus}
              </div>
            )}

            {/* Quick Stats */}
            <div className="mt-4 sm:mt-6 w-full grid grid-cols-2 gap-3 sm:gap-4">
              <StyledCard color="indigo" title="Experience" className="p-2">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold">
                    {userData.profile?.experience || "0"}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">
                    Years
                  </span>
                </div>
              </StyledCard>

              <StyledCard color="purple" title="Projects" className="p-2">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold">
                    {userData.profile?.projects?.length || "0"}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">
                    Projects
                  </span>
                </div>
              </StyledCard>
            </div>

            {/* Contact Info */}
            <div className="mt-4 sm:mt-6 w-full space-y-2 sm:space-y-3">
              <StyledCard color="blue" className="p-3">
                <div className="flex items-center">
                  <div className="bg-indigo-100 dark:bg-indigo-900 p-1.5 sm:p-2 rounded-full mr-2 sm:mr-3">
                    <FiMail className="text-indigo-600 dark:text-indigo-300 text-sm sm:text-base" />
                  </div>
                  <a
                    href={emailAddress ? `mailto:${emailAddress}` : undefined}
                    className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs sm:text-sm truncate"
                  >
                    {emailAddress || "Not specified"}
                  </a>
                </div>
              </StyledCard>

              {contactNumber && (
                <StyledCard color="green" className="p-3">
                  <div className="flex items-center">
                    <div className="bg-indigo-100 dark:bg-indigo-900 p-1.5 sm:p-2 rounded-full mr-2 sm:mr-3">
                      <FiPhone className="text-indigo-600 dark:text-indigo-300 text-sm sm:text-base" />
                    </div>
                    <a
                      href={`tel:${contactNumber}`}
                      className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs sm:text-sm"
                    >
                      {contactNumber}
                    </a>
                  </div>
                </StyledCard>
              )}

              {profileLocation && (
                <StyledCard color="orange" className="p-3">
                  <div className="flex items-center">
                    <div className="bg-indigo-100 dark:bg-indigo-900 p-1.5 sm:p-2 rounded-full mr-2 sm:mr-3">
                      <FiMapPin className="text-indigo-600 dark:text-indigo-300 text-sm sm:text-base" />
                    </div>
                    <span className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm">
                      {profileLocation}
                    </span>
                  </div>
                </StyledCard>
              )}
            </div>

            {/* Social Links */}
            <div className="mt-4 sm:mt-6 flex space-x-2 sm:space-x-3">
              {getProfileSocialLink(profileData, "linkedin") && (
                <a
                  href={formatSocialLink(
                    getProfileSocialLink(profileData, "linkedin"),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white dark:bg-gray-700 p-2 sm:p-3 rounded-full shadow-sm hover:shadow-md hover:bg-indigo-50 dark:hover:bg-gray-600 transition-all"
                >
                  <FiLinkedin className="text-indigo-600 dark:text-indigo-300 text-lg sm:text-xl" />
                </a>
              )}
              {getProfileSocialLink(profileData, "github") && (
                <a
                  href={formatSocialLink(
                    getProfileSocialLink(profileData, "github"),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white dark:bg-gray-700 p-2 sm:p-3 rounded-full shadow-sm hover:shadow-md hover:bg-indigo-50 dark:hover:bg-gray-600 transition-all"
                >
                  <FiGithub className="text-indigo-600 dark:text-indigo-300 text-lg sm:text-xl" />
                </a>
              )}
              {getProfileSocialLink(profileData, "twitter") && (
                <a
                  href={formatSocialLink(
                    getProfileSocialLink(profileData, "twitter"),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white dark:bg-gray-700 p-2 sm:p-3 rounded-full shadow-sm hover:shadow-md hover:bg-indigo-50 dark:hover:bg-gray-600 transition-all"
                >
                  <FiTwitter className="text-indigo-600 dark:text-indigo-300 text-lg sm:text-xl" />
                </a>
              )}
              {getProfileSocialLink(profileData, "website") && (
                <a
                  href={formatSocialLink(
                    getProfileSocialLink(profileData, "website"),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white dark:bg-gray-700 p-2 sm:p-3 rounded-full shadow-sm hover:shadow-md hover:bg-indigo-50 dark:hover:bg-gray-600 transition-all"
                >
                  <FiGlobe className="text-indigo-600 dark:text-indigo-300 text-lg sm:text-xl" />
                </a>
              )}
            </div>

            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`mt-4 sm:mt-6 flex items-center justify-center px-4 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl transition-all duration-300 shadow-lg w-full text-sm sm:text-base ${
                isEditMode
                  ? "bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white"
                  : "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
              }`}
            >
              {isEditMode ? (
                <>
                  <FiX className="mr-1 sm:mr-2" /> Cancel
                </>
              ) : (
                <>
                  <FiEdit className="mr-1 sm:mr-2" /> Edit Profile
                </>
              )}
            </button>
          </div>

          {/* Main Content Section */}
          <div className="w-full lg:w-2/3">
            {isEditMode ? (
              <EditProfileModal
                isOpenModal={isEditMode}
                onRequestClose={() => setIsEditMode(false)}
                user={userData}
                onSave={handleSaveProfile}
              />
            ) : (
              <ProfileContent
                userData={userData}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                formatDate={formatDate}
                formatSocialLink={formatSocialLink}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProfileContent = ({
  userData,
  activeTab,
  setActiveTab,
  formatDate,
  formatSocialLink,
}) => {
  const [showFullBio, setShowFullBio] = useState(false);
  const profile = userData.profile || {};
  const socialLinks = {
    website: profile.socialLinks?.website || profile.websiteUrl,
    linkedin: profile.socialLinks?.linkedin || profile.linkedinUrl,
    github: profile.socialLinks?.github,
    twitter: profile.socialLinks?.twitter || profile.twitterUrl,
  };
  const projects = Array.isArray(profile.projects) ? profile.projects : [];
  const specializations = Array.isArray(profile.specializations)
    ? profile.specializations
    : [];
  const achievements = Array.isArray(profile.achievements)
    ? profile.achievements
    : [];
  const certifications = Array.isArray(profile.certifications)
    ? profile.certifications
    : [];

  const renderValue = (value) => value || "Not specified";
  const projectTitle = (project) =>
    project?.title ||
    project?.name ||
    project?.projectName ||
    "Untitled project";

  return (
    <>
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex px-4 sm:px-6 overflow-x-auto scrollbar-hide">
          {["personal", "professional", "social", "interests"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 sm:px-4 sm:py-3 font-medium text-xs sm:text-sm flex items-center shrink-0 transition-colors duration-200 ${
                activeTab === tab
                  ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500 bg-indigo-50 dark:bg-gray-700"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {tab === "personal" && <FiUser className="mr-1 sm:mr-2" />}
              {tab === "professional" && (
                <FiBriefcase className="mr-1 sm:mr-2" />
              )}
              {tab === "social" && <FiGlobe className="mr-1 sm:mr-2" />}
              {tab === "interests" && <FiHeart className="mr-1 sm:mr-2" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4 sm:p-6">
        {activeTab === "personal" && (
          <div className="space-y-4 sm:space-y-6">
            <StyledCard color="indigo" title="Basic Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Full Name
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {renderValue(profile.fullName)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Date of Birth
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {formatDate(profile.dateOfBirth)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Hometown
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {renderValue(profile.hometown)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Current Location
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {renderValue(profile.currentLocation)}
                  </p>
                </div>
              </div>
            </StyledCard>

            <StyledCard color="purple" title="About">
              {profile.bio ? (
                <div>
                  <p className="text-gray-800 dark:text-gray-200">
                    {showFullBio || profile.bio.length < 150
                      ? profile.bio
                      : `${profile.bio.substring(0, 150)}...`}
                  </p>
                  {profile.bio.length > 150 && (
                    <button
                      onClick={() => setShowFullBio(!showFullBio)}
                      className="mt-2 sm:mt-3 text-xs sm:text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                    >
                      {showFullBio ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic">
                  No bio provided
                </p>
              )}
            </StyledCard>

            <StyledCard color="orange" title="Address & Contact">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Gender
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {renderValue(profile.gender)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Contact Number
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {renderValue(profile.contactNumber || profile.phoneNumber)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Additional Email
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {renderValue(profile.additionalEmail)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Address
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {renderValue(profile.address)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    City / State / Country
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {[profile.city, profile.state, profile.country]
                      .filter(Boolean)
                      .join(", ") || "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Pincode
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {renderValue(profile.pincode)}
                  </p>
                </div>
              </div>
            </StyledCard>
          </div>
        )}

        {activeTab === "professional" && (
          <div className="space-y-4 sm:space-y-6">
            <StyledCard color="blue" title="Professional Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Experience
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {profile.experience || profile.experience === 0
                      ? `${profile.experience} years`
                      : "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Current Position
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {renderValue(profile.currentPosition)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Education
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {renderValue(profile.education)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Qualification
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {renderValue(profile.qualification)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Skills
                  </p>
                  {profile.skills?.length > 0 ? (
                    <div className="flex flex-wrap gap-1 sm:gap-2 mt-1 sm:mt-2">
                      {profile.skills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-2 py-0.5 sm:px-3 sm:py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium shadow-sm"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-800 dark:text-gray-200">
                      Not specified
                    </p>
                  )}
                </div>
              </div>
            </StyledCard>

            {specializations.length > 0 && (
              <StyledCard color="pink" title="Specializations">
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {specializations.map((specialization, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 sm:px-4 sm:py-2 bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200 rounded-full text-xs sm:text-sm font-medium shadow-sm"
                    >
                      {specialization}
                    </span>
                  ))}
                </div>
              </StyledCard>
            )}

            {projects.length > 0 && (
              <StyledCard color="green" title="Notable Projects">
                <div className="space-y-3 sm:space-y-4">
                  {projects.map((project, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-gray-700 p-4 sm:p-5 rounded-lg sm:rounded-xl shadow-sm border-l-4 border-indigo-500"
                    >
                      <h4 className="font-bold text-base sm:text-lg text-gray-800 dark:text-gray-200 mb-1">
                        {projectTitle(project)}
                      </h4>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-2 sm:mb-3">
                        {project.description}
                      </p>
                      {project.year && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          Year: {project.year}
                        </p>
                      )}
                      {project.link && (
                        <a
                          href={formatSocialLink(project.link)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs sm:text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                        >
                          View Project
                          <svg
                            className="w-3 h-3 sm:w-4 sm:h-4 ml-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </StyledCard>
            )}
          </div>
        )}

        {activeTab === "social" && (
          <div className="space-y-4 sm:space-y-6">
            <StyledCard color="pink" title="Social Profiles">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center">
                  <div className="bg-indigo-100 dark:bg-indigo-900 p-2 sm:p-3 rounded-full mr-3 sm:mr-4">
                    <FiLinkedin className="text-indigo-600 dark:text-indigo-300 text-lg sm:text-xl" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      LinkedIn
                    </p>
                    {socialLinks.linkedin ? (
                      <a
                        href={formatSocialLink(socialLinks.linkedin)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium text-xs sm:text-sm break-all"
                      >
                        {socialLinks.linkedin}
                      </a>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                        Not specified
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="bg-indigo-100 dark:bg-indigo-900 p-2 sm:p-3 rounded-full mr-3 sm:mr-4">
                    <FiGithub className="text-indigo-600 dark:text-indigo-300 text-lg sm:text-xl" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      GitHub
                    </p>
                    {socialLinks.github ? (
                      <a
                        href={formatSocialLink(socialLinks.github)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium text-xs sm:text-sm break-all"
                      >
                        {socialLinks.github}
                      </a>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                        Not specified
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="bg-indigo-100 dark:bg-indigo-900 p-2 sm:p-3 rounded-full mr-3 sm:mr-4">
                    <FiTwitter className="text-indigo-600 dark:text-indigo-300 text-lg sm:text-xl" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Twitter
                    </p>
                    {socialLinks.twitter ? (
                      <a
                        href={formatSocialLink(socialLinks.twitter)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium text-xs sm:text-sm break-all"
                      >
                        {socialLinks.twitter}
                      </a>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                        Not specified
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </StyledCard>

            <StyledCard color="orange" title="Website & Contact">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center">
                  <div className="bg-indigo-100 dark:bg-indigo-900 p-2 sm:p-3 rounded-full mr-3 sm:mr-4">
                    <FiGlobe className="text-indigo-600 dark:text-indigo-300 text-lg sm:text-xl" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Personal Website
                    </p>
                    {socialLinks.website ? (
                      <a
                        href={formatSocialLink(socialLinks.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium text-xs sm:text-sm break-all"
                      >
                        {socialLinks.website}
                      </a>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                        Not specified
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="bg-indigo-100 dark:bg-indigo-900 p-2 sm:p-3 rounded-full mr-3 sm:mr-4">
                    <FiMail className="text-indigo-600 dark:text-indigo-300 text-lg sm:text-xl" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Additional Email
                    </p>
                    {userData.profile?.additionalEmail ? (
                      <a
                        href={`mailto:${userData.profile.additionalEmail}`}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium text-xs sm:text-sm break-all"
                      >
                        {userData.profile.additionalEmail}
                      </a>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                        Not specified
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </StyledCard>
          </div>
        )}

        {activeTab === "interests" && (
          <div className="space-y-4 sm:space-y-6">
            <StyledCard color="red" title="Hobbies">
              {profile.hobbies?.length > 0 ? (
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {profile.hobbies.map((hobby, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 sm:px-4 sm:py-2 bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200 rounded-full text-xs sm:text-sm font-medium shadow-sm flex items-center"
                    >
                      <FiHeart className="mr-1 sm:mr-2 text-pink-500 dark:text-pink-300" />
                      {hobby}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic">
                  No hobbies specified
                </p>
              )}
            </StyledCard>

            <StyledCard color="yellow" title="Interests">
              {profile.interests?.length > 0 ? (
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {profile.interests.map((interest, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 sm:px-4 sm:py-2 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-xs sm:text-sm font-medium shadow-sm"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic">
                  No interests specified
                </p>
              )}
            </StyledCard>

            {profile.languages?.length > 0 && (
              <StyledCard color="green" title="Languages">
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {profile.languages.map((language, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 sm:px-4 sm:py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs sm:text-sm font-medium shadow-sm"
                    >
                      {language}
                    </span>
                  ))}
                </div>
              </StyledCard>
            )}

            {achievements.length > 0 && (
              <StyledCard color="purple" title="Achievements">
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {achievements.map((achievement, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 sm:px-4 sm:py-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full text-xs sm:text-sm font-medium shadow-sm"
                    >
                      {achievement}
                    </span>
                  ))}
                </div>
              </StyledCard>
            )}

            {certifications.length > 0 && (
              <StyledCard color="orange" title="Certifications">
                <div className="space-y-3">
                  {certifications.map((certification, index) => (
                    <div
                      key={index}
                      className="rounded-lg bg-white/80 p-4 shadow-sm dark:bg-gray-700/80"
                    >
                      <p className="font-semibold text-gray-800 dark:text-gray-100">
                        {certification.name ||
                          certification.title ||
                          "Certification"}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {certification.issuer || "Unknown issuer"}
                        {certification.year ? ` · ${certification.year}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </StyledCard>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default UserProfile;
