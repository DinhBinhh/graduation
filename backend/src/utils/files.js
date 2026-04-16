import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..", "..");
const uploadRoot = path.join(backendRoot, "uploads");

export function ensureUploadDirectories() {
  const imageDir = path.join(uploadRoot, "images");
  const videoDir = path.join(uploadRoot, "videos");
  const wishVideoDir = path.join(uploadRoot, "wishes");
  const tempDir = path.join(uploadRoot, "temp");

  [uploadRoot, imageDir, videoDir, wishVideoDir, tempDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

export function fileUrl(filePath) {
  if (!filePath) return null;
  if (/^https?:\/\//i.test(filePath)) {
    return filePath;
  }
  return `/${filePath.replace(/\\/g, "/")}`;
}

export function deleteIfExists(relativePath) {
  if (!relativePath) return;
  if (/^https?:\/\//i.test(relativePath)) return;

  const absolutePath = path.join(backendRoot, relativePath);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}
