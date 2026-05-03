import React, { useState, useEffect } from "react";
import { FiEdit2, FiSave, FiX, FiLoader, FiCamera } from "react-icons/fi";
import profileService from "../../../services/Profile/profileService";

const ManageProfile = () => {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profile, setProfile] = useState({
    bio: "",
    phoneNumber: "",
    qualification: "Master",
    specializations: [],
    experience: 0,
    websiteUrl: "",
    linkedinUrl: "",
    aboutMe: "",
    interests: [],
    languages: [],
    availability: {
      isAvailable: true,
      hoursPerWeek: 0,
      timezone: "",
    },
  });

  const [formData, setFormData] = useState({ ...profile });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await profileService.getMyProfile();
      const data = response.data || response;
      setProfile(data);
      setFormData(data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const response = await profileService.uploadProfilePhoto(file);
        setProfile((prev) => ({
          ...prev,
          profilePhoto: response.data?.profilePhoto,
        }));
        setFormData((prev) => ({
          ...prev,
          profilePhoto: response.data?.profilePhoto,
        }));
      } catch (error) {
        console.error("Error uploading photo:", error);
      }
    }
  };

  const handleSaveProfile = async () => {
    try {
      const response = await profileService.updateProfile(formData);
      setProfile(response.data || formData);
      setEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <FiLoader className="text-4xl text-indigo-600 dark:text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Teacher Profile
          </h2>
          <button
            onClick={() => setEditing(!editing)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              editing
                ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
            }`}
          >
            {editing ? (
              <>
                <FiX size={18} />
                Cancel
              </>
            ) : (
              <>
                <FiEdit2 size={18} />
                Edit Profile
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Photo Section */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative mb-4">
              <div className="h-32 w-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-4xl font-bold overflow-hidden">
                {profile.profilePhoto ? (
                  <img
                    src={profile.profilePhoto}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  "TP"
                )}
              </div>
              {editing && (
                <label className="absolute bottom-0 right-0 bg-indigo-600 p-2 rounded-full cursor-pointer hover:bg-indigo-700 transition-colors">
                  <FiCamera className="text-white" size={18} />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            {profile.profilePhoto && editing && (
              <button
                onClick={async () => {
                  try {
                    await profileService.deleteProfilePhoto();
                    setProfile((prev) => ({ ...prev, profilePhoto: null }));
                    setFormData((prev) => ({ ...prev, profilePhoto: null }));
                  } catch (error) {
                    console.error("Error deleting photo:", error);
                  }
                }}
                className="text-red-600 dark:text-red-400 text-sm hover:underline"
              >
                Remove Photo
              </button>
            )}
          </div>

          {/* Profile Info */}
          <div className="md:col-span-2 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bio
              </label>
              {editing ? (
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  rows="3"
                  placeholder="Write your bio..."
                />
              ) : (
                <p className="text-gray-600 dark:text-gray-400">
                  {profile.bio || "No bio added yet"}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone Number
                </label>
                {editing ? (
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="+1 (123) 456-7890"
                  />
                ) : (
                  <p className="text-gray-600 dark:text-gray-400">
                    {profile.phoneNumber || "Not provided"}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Experience (Years)
                </label>
                {editing ? (
                  <input
                    type="number"
                    name="experience"
                    value={formData.experience}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                ) : (
                  <p className="text-gray-600 dark:text-gray-400">
                    {profile.experience} years
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Specializations
              </label>
              {editing ? (
                <input
                  type="text"
                  value={formData.specializations?.join(", ") || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      specializations: e.target.value
                        .split(",")
                        .map((s) => s.trim()),
                    }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Mathematics, Physics, Chemistry"
                />
              ) : (
                <p className="text-gray-600 dark:text-gray-400">
                  {profile.specializations?.join(", ") || "Not specified"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Social Links */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Social Links
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Website
            </label>
            {editing ? (
              <input
                type="url"
                name="websiteUrl"
                value={formData.websiteUrl}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="https://yourwebsite.com"
              />
            ) : (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {profile.websiteUrl || "Not provided"}
              </a>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              LinkedIn
            </label>
            {editing ? (
              <input
                type="url"
                name="linkedinUrl"
                value={formData.linkedinUrl}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="https://linkedin.com/in/yourprofile"
              />
            ) : (
              <a
                href={profile.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {profile.linkedinUrl || "Not provided"}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      {editing && (
        <div className="flex gap-4 justify-end">
          <button
            onClick={() => setEditing(false)}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveProfile}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
          >
            <FiSave size={18} />
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
};

export default ManageProfile;
