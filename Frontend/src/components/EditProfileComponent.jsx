// EditProfile.jsx
import React, { useCallback, useEffect, useState } from "react";
import { FiTrash2, FiX } from "react-icons/fi";
import { toast } from "react-toastify";
import AlertMessage from "./AlertMessage";
import ProfileImage from "./Image";
import profileService from "../services/profileService";

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

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const toList = (value) => (Array.isArray(value) ? value : []);

const normalizeProject = (project = {}) => ({
  title: project.title || project.name || "",
  description: project.description || "",
  year: project.year || "",
  link: project.link || "",
});

const inputBaseClass =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white";

const InputField = ({ label, error, className = "", ...props }) => (
  <label className={`block ${className}`}>
    <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </span>
    <input className={inputBaseClass} {...props} />
    {error ? (
      <span className="mt-1 block text-sm text-red-600 dark:text-red-400">
        {error}
      </span>
    ) : null}
  </label>
);

const TextAreaField = ({ label, className = "", ...props }) => (
  <label className={`block ${className}`}>
    <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </span>
    <textarea className={inputBaseClass} {...props} />
  </label>
);

const EditProfileModal = ({ isOpenModal, onRequestClose, user, onSave }) => {
  const [formData, setFormData] = useState({
    fullName: "",
    gender: "",
    bio: "",
    aboutMe: "",
    dateOfBirth: "",
    hometown: "",
    currentLocation: "",
    contactNumber: "",
    phoneNumber: "",
    additionalEmail: "",
    address: "",
    city: "",
    state: "",
    country: "",
    pincode: "",
    qualification: "",
    experience: "",
    currentPosition: "",
    education: "",
    skills: [],
    specializations: [],
    hobbies: [],
    interests: [],
    languages: [],
    projects: [],
    websiteUrl: "",
    linkedinUrl: "",
    twitterUrl: "",
    socialLinks: {
      linkedin: "",
      github: "",
      twitter: "",
      website: "",
    },
  });

  const [tempSkill, setTempSkill] = useState("");
  const [tempSpecialization, setTempSpecialization] = useState("");
  const [tempHobby, setTempHobby] = useState("");
  const [tempInterest, setTempInterest] = useState("");
  const [tempLanguage, setTempLanguage] = useState("");
  const [tempProject, setTempProject] = useState({
    title: "",
    description: "",
    year: "",
    link: "",
  });
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "success",
  });
  const [profile, setProfile] = useState(null);

  const sectionThemes = {
    personal: {
      light: "from-purple-500 to-indigo-600",
      dark: "from-purple-700 to-indigo-800",
    },
    contact: {
      light: "from-amber-500 to-orange-600",
      dark: "from-amber-700 to-orange-800",
    },
    professional: {
      light: "from-emerald-500 to-teal-600",
      dark: "from-emerald-700 to-teal-800",
    },
    skills: {
      light: "from-blue-500 to-cyan-600",
      dark: "from-blue-700 to-cyan-800",
    },
    hobbies: {
      light: "from-pink-500 to-rose-600",
      dark: "from-pink-700 to-rose-800",
    },
    interests: {
      light: "from-violet-500 to-fuchsia-600",
      dark: "from-violet-700 to-fuchsia-800",
    },
    languages: {
      light: "from-green-500 to-lime-600",
      dark: "from-green-700 to-lime-800",
    },
    projects: {
      light: "from-amber-500 to-yellow-600",
      dark: "from-amber-700 to-yellow-800",
    },
    social: {
      light: "from-sky-500 to-blue-600",
      dark: "from-sky-700 to-blue-800",
    },
  };

  const getSectionTheme = (section) => {
    const { light, dark } = sectionThemes[section] || {};
    return `${light} ${dark}`;
  };

  const showAlert = (type, message) => {
    setAlert({
      isOpen: true,
      title: type === "success" ? "Success" : "Error",
      message,
      type,
    });

    setTimeout(() => {
      setAlert((prev) => ({ ...prev, isOpen: false }));
    }, 3000);
  };

  const fetchProfile = async () => {
    try {
      const response = await profileService.getMyProfile();
      const normalizedProfile = normalizeProfileResponse(response);
      setProfile(normalizedProfile);

      if (normalizedProfile) {
        setFormData({
          fullName: normalizedProfile.fullName || "",
          gender: normalizedProfile.gender || "",
          bio: normalizedProfile.bio || "",
          aboutMe: normalizedProfile.aboutMe || "",
          dateOfBirth: toDateInputValue(normalizedProfile.dateOfBirth),
          hometown: normalizedProfile.hometown || "",
          currentLocation: normalizedProfile.currentLocation || "",
          contactNumber: normalizedProfile.contactNumber || "",
          phoneNumber: normalizedProfile.phoneNumber || "",
          additionalEmail: normalizedProfile.additionalEmail || "",
          address: normalizedProfile.address || "",
          city: normalizedProfile.city || "",
          state: normalizedProfile.state || "",
          country: normalizedProfile.country || "",
          pincode: normalizedProfile.pincode || "",
          qualification: normalizedProfile.qualification || "",
          experience:
            normalizedProfile.experience !== undefined &&
            normalizedProfile.experience !== null
              ? String(normalizedProfile.experience)
              : "",
          currentPosition: normalizedProfile.currentPosition || "",
          education: normalizedProfile.education || "",
          skills: toList(normalizedProfile.skills),
          specializations: toList(normalizedProfile.specializations),
          hobbies: toList(normalizedProfile.hobbies),
          interests: toList(normalizedProfile.interests),
          languages: toList(normalizedProfile.languages),
          projects: toList(normalizedProfile.projects).map(normalizeProject),
          websiteUrl:
            normalizedProfile.websiteUrl ||
            normalizedProfile.socialLinks?.website ||
            "",
          linkedinUrl:
            normalizedProfile.linkedinUrl ||
            normalizedProfile.socialLinks?.linkedin ||
            "",
          twitterUrl:
            normalizedProfile.twitterUrl ||
            normalizedProfile.socialLinks?.twitter ||
            "",
          socialLinks: {
            linkedin: normalizedProfile.socialLinks?.linkedin || "",
            github: normalizedProfile.socialLinks?.github || "",
            twitter: normalizedProfile.socialLinks?.twitter || "",
            website: normalizedProfile.socialLinks?.website || "",
          },
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      showAlert("error", error.message || "Failed to load profile");
    }
  };

  useEffect(() => {
    if (isOpenModal) {
      fetchProfile();
    }
  }, [isOpenModal, user]);

  const validateField = (name, value) => {
    let error = "";
    switch (name) {
      case "additionalEmail":
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = "Invalid email format";
        }
        break;
      case "contactNumber":
        if (value && !/^[0-9+\-\s]+$/.test(value)) {
          error = "Invalid phone number";
        }
        break;
      default:
        break;
    }
    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddItem = useCallback(
    (type, value, setValue, field) => {
      const trimmedValue = value.trim();
      if (!trimmedValue) {
        toast.error(`Please enter a ${type.toLowerCase()}`);
        return;
      }
      if (formData[field].includes(trimmedValue)) {
        toast.error(`${type} already exists`);
        return;
      }

      setFormData((prev) => ({
        ...prev,
        [field]: [...prev[field], trimmedValue],
      }));
      setValue("");
    },
    [formData],
  );

  const handleRemoveItem = useCallback((index, field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, itemIndex) => itemIndex !== index),
    }));
  }, []);

  const handleProjectChange = (e) => {
    const { name, value } = e.target;
    setTempProject((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddProject = () => {
    if (!tempProject.title.trim()) {
      toast.error("Project title is required");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      projects: [...prev.projects, tempProject],
    }));
    setTempProject({ title: "", description: "", year: "", link: "" });
  };

  const handleRemoveProject = useCallback((index) => {
    setFormData((prev) => ({
      ...prev,
      projects: prev.projects.filter((_, itemIndex) => itemIndex !== index),
    }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...formData,
        experience: formData.experience ? Number(formData.experience) : 0,
        projects: formData.projects.map((project) => ({
          title: project.title || project.name || "",
          description: project.description || "",
          year: project.year || "",
          link: project.link || "",
        })),
        socialLinks: {
          linkedin: formData.linkedinUrl || formData.socialLinks.linkedin || "",
          github: formData.socialLinks.github || "",
          twitter: formData.twitterUrl || formData.socialLinks.twitter || "",
          website: formData.websiteUrl || formData.socialLinks.website || "",
        },
      };

      await profileService.updateProfile(dataToSave);
      showAlert("success", "Profile updated successfully");
      onSave(dataToSave);
      onRequestClose();
    } catch (error) {
      showAlert("error", error.message || "Failed to update profile");
    }
  };

  if (!isOpenModal) return null;

  const profilePhoto = profile.profilePhoto ;
//   console.log("profileData : ",profile.profilePhoto)
  const displayName =
    formData.fullName ||
    profile?.fullName ||
    profile?.userId?.name ||
    user?.name ||
    "User";
  const displayRole = user?.role || profile?.userId?.role || "Member";
  const profileVerification = profile?.verificationStatus || "not verified";

  const renderChipEditor = ({
    title,
    themeKey,
    field,
    value,
    setValue,
    placeholder,
    emptyMessage,
  }) => (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <div
          className={`h-8 w-1 rounded-full bg-gradient-to-b ${getSectionTheme(themeKey)}`}
        />
        <h4 className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h4>
      </div>
      <div className="flex flex-wrap gap-2">
        {formData[field].length > 0 ? (
          formData[field].map((item, index) => (
            <span
              key={`${field}-${index}`}
              className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              {item}
              <button
                type="button"
                onClick={() => handleRemoveItem(index, field)}
                className="text-gray-500 hover:text-red-600 dark:hover:text-red-400"
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {emptyMessage}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={inputBaseClass}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() =>
            handleAddItem(title.replace(/s$/, ""), value, setValue, field)
          }
          className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 font-semibold text-white shadow-md transition hover:from-indigo-700 hover:to-purple-700"
        >
          Add
        </button>
      </div>
    </div>
  );

  return (
    <div className="z-50 w-full border-b border-pink-200/20 bg-gradient-to-r from-pink-300/70 via-rose-300/60 to-fuchsia-300/70 backdrop-blur-md px-4 py-3 shadow-lg">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl items-center justify-center">
        <div className="flex max-h-[150vh] w-full flex-col overflow-hidden rounded-3xl bg-gradient-to-r from-pink-300/70 via-rose-300/60 to-fuchsia-300/70 shadow-2xl dark:bg-gray-900">
          <AlertMessage
            isOpen={alert.isOpen}
            title={alert.title}
            message={alert.message}
            type={alert.type}
            onClose={() => setAlert((prev) => ({ ...prev, isOpen: false }))}
          />

          <div className="flex items-center justify-between border-b border-white/20 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 px-6 py-5 text-white">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-white/70">
                Profile editor
              </p>
              <h2 className="text-2xl font-bold">Edit Your Profile</h2>
            </div>
            <button
              onClick={onRequestClose}
              className="rounded-full p-2 transition hover:bg-white/15"
              aria-label="Close modal"
            >
              <FiX size={22} />
            </button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="border-b border-gray-200 bg-slate-50 p-6 dark:border-gray-800 dark:bg-gray-950 lg:border-b-0 lg:border-r">
              <div className="flex flex-col items-center text-center">
               <img
                  src={profilePhoto}
                  alt={`${displayName}'s profile`}
                  className="h-32 w-32 rounded-full border-4 border-white object-cover shadow-xl dark:border-gray-800"
                />
                <h3 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
                  {displayName}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {displayRole}
                </p>
                <div className="mt-3 inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                  Photo managed by backend
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Experience
                  </p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                    {formData.experience || "0"}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Skills
                  </p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                    {formData.skills.length}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Projects
                  </p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                    {formData.projects.length}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Languages
                  </p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                    {formData.languages.length}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Verification
                </p>
                <p className="mt-1 font-semibold capitalize">
                  {profileVerification}
                </p>
              </div>
            </aside>

            <div className="min-h-0 overflow-y-auto bg-white p-6 dark:bg-gray-900">
              <form onSubmit={handleSubmit} className="space-y-6">
                <section className="rounded-3xl border border-gray-200 bg-gray-50 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950/50">
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className={`h-8 w-1 rounded-full bg-gradient-to-b ${getSectionTheme("personal")}`}
                    />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Personal Information
                    </h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <InputField
                      label="Full Name"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="Your full name"
                    />
                    <InputField
                      label="Gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      placeholder="Male, Female, Other"
                    />
                    <InputField
                      label="Date of Birth"
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                    />
                    <InputField
                      label="Hometown"
                      name="hometown"
                      value={formData.hometown}
                      onChange={handleChange}
                      placeholder="Where you grew up"
                    />
                    <InputField
                      label="Current Location"
                      name="currentLocation"
                      value={formData.currentLocation}
                      onChange={handleChange}
                      placeholder="Where you live now"
                    />
                    <InputField
                      label="Qualification"
                      name="qualification"
                      value={formData.qualification}
                      onChange={handleChange}
                      placeholder="Highest qualification"
                    />
                    <TextAreaField
                      label="Bio"
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Short bio for the profile card"
                      className="md:col-span-2"
                    />
                    <TextAreaField
                      label="About Me"
                      name="aboutMe"
                      value={formData.aboutMe}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Detailed profile summary"
                      className="md:col-span-2"
                    />
                  </div>
                </section>

                <section className="rounded-3xl border border-gray-200 bg-gray-50 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950/50">
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className={`h-8 w-1 rounded-full bg-gradient-to-b ${getSectionTheme("contact")}`}
                    />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Contact & Address
                    </h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <InputField
                      label="Primary Phone"
                      name="contactNumber"
                      value={formData.contactNumber}
                      onChange={handleChange}
                      placeholder="+91 9812345610"
                    />
                    <InputField
                      label="Secondary Phone"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      placeholder="Optional secondary number"
                    />
                    <InputField
                      label="Additional Email"
                      name="additionalEmail"
                      type="email"
                      value={formData.additionalEmail}
                      onChange={handleChange}
                      placeholder="support@example.com"
                      error={errors.additionalEmail}
                    />
                    <InputField
                      label="Address"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Street or office address"
                    />
                    <InputField
                      label="City"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="City"
                    />
                    <InputField
                      label="State"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      placeholder="State"
                    />
                    <InputField
                      label="Country"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      placeholder="Country"
                    />
                    <InputField
                      label="Pincode"
                      name="pincode"
                      value={formData.pincode}
                      onChange={handleChange}
                      placeholder="Postal code"
                    />
                  </div>
                </section>

                <section className="rounded-3xl border border-gray-200 bg-gray-50 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950/50">
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className={`h-8 w-1 rounded-full bg-gradient-to-b ${getSectionTheme("professional")}`}
                    />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Professional Information
                    </h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <InputField
                      label="Experience (years)"
                      name="experience"
                      type="number"
                      min="0"
                      value={formData.experience}
                      onChange={handleChange}
                    />
                    <InputField
                      label="Current Position"
                      name="currentPosition"
                      value={formData.currentPosition}
                      onChange={handleChange}
                      placeholder="Your job title"
                    />
                    <InputField
                      label="Education"
                      name="education"
                      value={formData.education}
                      onChange={handleChange}
                      placeholder="Education background"
                      className="md:col-span-2"
                    />
                  </div>
                </section>

                <section className="space-y-5">
                  {renderChipEditor({
                    title: "Skills",
                    themeKey: "skills",
                    field: "skills",
                    value: tempSkill,
                    setValue: setTempSkill,
                    placeholder: "Add a skill",
                    emptyMessage: "Add a skill to display here",
                  })}
                  {renderChipEditor({
                    title: "Specializations",
                    themeKey: "skills",
                    field: "specializations",
                    value: tempSpecialization,
                    setValue: setTempSpecialization,
                    placeholder: "Add a specialization",
                    emptyMessage: "Add a specialization to display here",
                  })}
                  {renderChipEditor({
                    title: "Hobbies",
                    themeKey: "hobbies",
                    field: "hobbies",
                    value: tempHobby,
                    setValue: setTempHobby,
                    placeholder: "Add a hobby",
                    emptyMessage: "Add a hobby to display here",
                  })}
                  {renderChipEditor({
                    title: "Interests",
                    themeKey: "interests",
                    field: "interests",
                    value: tempInterest,
                    setValue: setTempInterest,
                    placeholder: "Add an interest",
                    emptyMessage: "Add an interest to display here",
                  })}
                  {renderChipEditor({
                    title: "Languages",
                    themeKey: "languages",
                    field: "languages",
                    value: tempLanguage,
                    setValue: setTempLanguage,
                    placeholder: "Add a language",
                    emptyMessage: "Add a language to display here",
                  })}
                </section>

                <section className="rounded-3xl border border-gray-200 bg-gray-50 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950/50">
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className={`h-8 w-1 rounded-full bg-gradient-to-b ${getSectionTheme("projects")}`}
                    />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Projects
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {formData.projects.length > 0 ? (
                      formData.projects.map((project, index) => (
                        <div
                          key={`${project.title || project.name || "project"}-${index}`}
                          className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {project.title ||
                                  project.name ||
                                  "Untitled project"}
                              </p>
                              {project.year ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Year: {project.year}
                                </p>
                              ) : null}
                              {project.description ? (
                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                  {project.description}
                                </p>
                              ) : null}
                              {project.link ? (
                                <a
                                  href={project.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
                                >
                                  {project.link}
                                </a>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveProject(index)}
                              className="rounded-full p-2 text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No projects added yet.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 grid gap-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900 md:grid-cols-2">
                    <InputField
                      label="Project Title"
                      name="title"
                      value={tempProject.title}
                      onChange={handleProjectChange}
                      placeholder="Project title"
                    />
                    <InputField
                      label="Project Year"
                      name="year"
                      value={tempProject.year}
                      onChange={handleProjectChange}
                      placeholder="2026"
                    />
                    <TextAreaField
                      label="Description"
                      name="description"
                      value={tempProject.description}
                      onChange={handleProjectChange}
                      rows={2}
                      placeholder="Project description"
                      className="md:col-span-2"
                    />
                    <InputField
                      label="Project Link"
                      name="link"
                      value={tempProject.link}
                      onChange={handleProjectChange}
                      placeholder="https://example.com"
                      className="md:col-span-2"
                    />
                    <button
                      type="button"
                      onClick={handleAddProject}
                      className="md:col-span-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 font-semibold text-white shadow-md transition hover:from-amber-600 hover:to-orange-600"
                    >
                      Add Project
                    </button>
                  </div>
                </section>

                <section className="rounded-3xl border border-gray-200 bg-gray-50 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950/50">
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className={`h-8 w-1 rounded-full bg-gradient-to-b ${getSectionTheme("social")}`}
                    />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Social Links
                    </h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <InputField
                      label="Website URL"
                      name="websiteUrl"
                      value={formData.websiteUrl}
                      onChange={handleChange}
                      placeholder="https://yourwebsite.com"
                    />
                    <InputField
                      label="LinkedIn URL"
                      name="linkedinUrl"
                      value={formData.linkedinUrl}
                      onChange={handleChange}
                      placeholder="https://linkedin.com/in/username"
                    />
                    <InputField
                      label="Twitter URL"
                      name="twitterUrl"
                      value={formData.twitterUrl}
                      onChange={handleChange}
                      placeholder="https://twitter.com/username"
                    />
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 md:col-span-2">
                      GitHub is shown on the profile card when available, but it
                      is not editable here because the backend does not persist
                      it.
                    </div>
                  </div>
                </section>

                <div className="sticky bottom-0 border-t border-gray-200 bg-white/95 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={onRequestClose}
                      className="rounded-xl border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2.5 font-semibold text-white shadow-lg transition hover:from-indigo-700 hover:to-purple-700"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;
