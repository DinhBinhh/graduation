import { Router } from "express";
import { login } from "../controllers/authController.js";
import { getInvitationByName } from "../controllers/invitationController.js";
import { streamMedia } from "../controllers/mediaController.js";
import { createWish } from "../controllers/wishController.js";
import { uploadWishVideo } from "../middleware/upload.js";

const router = Router();

router.get("/invitation", getInvitationByName);
router.get("/media", streamMedia);
router.post("/login", login);
router.post("/wishes", uploadWishVideo, createWish);

export default router;
