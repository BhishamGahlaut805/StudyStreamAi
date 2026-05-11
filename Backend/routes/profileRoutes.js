const express = require("express");
const router = express.Router();
const { protect } = require("../middleWares/authProfile");
const {
  getProfile,
  updateProfile,
} = require("../controllers/profileController");

router.route("/me").get(protect, getProfile);
router.route("/").put(protect, updateProfile);

module.exports = router;
