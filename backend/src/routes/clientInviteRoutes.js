const express = require("express");
const {
  getPublicInvite,
  startVideoFromInvite,
} = require("../controllers/clientInviteController");

const router = express.Router();

router.post("/:token/start-video", startVideoFromInvite);
router.get("/:token", getPublicInvite);

module.exports = router;
