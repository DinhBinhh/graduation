import fs from "fs/promises";
import cloudinary, { isCloudinaryConfigured } from "../config/cloudinary.js";

function getCloudinaryFolder(type) {
  switch (type) {
    case "cover":
      return "graduation-web/covers";
    case "card":
      return "graduation-web/cards";
    case "scare":
      return "graduation-web/scares";
    case "wish-image":
      return "graduation-web/wishes/images";
    case "wish-video":
      return "graduation-web/wishes/videos";
    default:
      return "graduation-web/uploads";
  }
}

function getCloudinaryResourceType(type) {
  return type === "scare" || type === "wish-video" ? "video" : "image";
}

export async function uploadToCloudinary(filePath, type) {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary chưa được cấu hình.");
  }

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: getCloudinaryFolder(type),
      resource_type: getCloudinaryResourceType(type)
    });

    return result.secure_url;
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
}

function parseCloudinaryUrl(assetUrl) {
  if (!assetUrl?.includes("res.cloudinary.com")) {
    return null;
  }

  const match = assetUrl.match(/\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
  if (!match) {
    return null;
  }

  return {
    resourceType: match[1],
    publicId: match[2]
  };
}

export async function deleteFromCloudinary(assetUrl) {
  const parsed = parseCloudinaryUrl(assetUrl);
  if (!parsed || !isCloudinaryConfigured()) {
    return;
  }

  await cloudinary.uploader.destroy(parsed.publicId, {
    resource_type: parsed.resourceType
  });
}
