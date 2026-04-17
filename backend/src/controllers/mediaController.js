import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fail } from "../utils/response.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..", "..");

function isAllowedRemoteUrl(src) {
  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
  } catch (error) {
    return false;
  }
}

function getSafeDownloadName(src, fallbackName) {
  if (!src) return fallbackName;

  try {
    const pathname = /^https?:\/\//i.test(src) ? new URL(src).pathname : src;
    const fileName = pathname.split("/").filter(Boolean).pop();
    return fileName || fallbackName;
  } catch (error) {
    return fallbackName;
  }
}

function getLocalAbsolutePath(src) {
  const normalized = src.replace(/^\/+/, "");
  return path.join(backendRoot, normalized);
}

export async function streamMedia(req, res) {
  const src = req.query.src?.trim();
  const shouldDownload = req.query.download === "1";
  const requestedName = req.query.name?.trim();

  if (!src) {
    return fail(res, "Thiếu đường dẫn media", 400);
  }

  if (/^https?:\/\//i.test(src)) {
    if (!isAllowedRemoteUrl(src)) {
      return fail(res, "Nguồn media không hợp lệ", 400);
    }

    try {
      const upstream = await fetch(src);
      if (!upstream.ok || !upstream.body) {
        return fail(res, "Không tải được media", upstream.status || 502);
      }

      const contentType = upstream.headers.get("content-type");
      const contentLength = upstream.headers.get("content-length");

      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }
      if (shouldDownload) {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${requestedName || getSafeDownloadName(src, "media-file")}"`
        );
      }

      upstream.body.pipeTo(
        new WritableStream({
          write(chunk) {
            res.write(Buffer.from(chunk));
          },
          close() {
            res.end();
          },
          abort(error) {
            res.destroy(error);
          }
        })
      ).catch((error) => {
        res.destroy(error);
      });

      return;
    } catch (error) {
      return fail(res, error.message);
    }
  }

  const absolutePath = getLocalAbsolutePath(src);
  if (!absolutePath.startsWith(backendRoot)) {
    return fail(res, "Đường dẫn media không hợp lệ", 400);
  }

  if (!fs.existsSync(absolutePath)) {
    return fail(res, "Không tìm thấy media", 404);
  }

  if (shouldDownload) {
    return res.download(absolutePath, requestedName || getSafeDownloadName(src, "media-file"));
  }

  return res.sendFile(absolutePath);
}
