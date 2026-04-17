import multer from "multer";
import path from "path";

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);
const videoExtensions = new Set([".mp4", ".mov", ".webm", ".m4v", ".3gp", ".ogg"]);

function createStorage(folder) {
  return multer.diskStorage({
    destination: (_, __, cb) => cb(null, path.join("uploads", folder)),
    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname);
      const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, "-");
      cb(null, `${Date.now()}-${safeBase}${ext}`);
    }
  });
}

function fileFilter(_, file, cb) {
  const isImageField =
    file.fieldname === "cardImage" ||
    file.fieldname === "coverImage" ||
    file.fieldname === "wishImage";
  const isVideoField = file.fieldname === "videoFile" || file.fieldname === "wishVideo";
  const extension = path.extname(file.originalname || "").toLowerCase();
  const isImageMime = file.mimetype?.startsWith("image/");
  const isVideoMime = file.mimetype?.startsWith("video/");
  const isImageByExtension = imageExtensions.has(extension);
  const isVideoByExtension = videoExtensions.has(extension);

  if (isImageField && (isImageMime || isImageByExtension)) {
    return cb(null, true);
  }

  if (isVideoField && (isVideoMime || isVideoByExtension)) {
    return cb(null, true);
  }

  return cb(new Error("Unsupported file type"));
}

export const uploadInvitationAssets = multer({
  storage: createStorage("temp"),
  fileFilter,
  limits: {
    fileSize: 80 * 1024 * 1024
  }
}).fields([
  { name: "coverImage", maxCount: 1 },
  { name: "cardImage", maxCount: 1 },
  { name: "videoFile", maxCount: 1 }
]);

export const uploadWishVideo = multer({
  storage: createStorage("temp"),
  fileFilter,
  limits: {
    fileSize: 80 * 1024 * 1024
  }
}).fields([
  { name: "wishVideo", maxCount: 1 },
  { name: "wishImage", maxCount: 1 }
]);
