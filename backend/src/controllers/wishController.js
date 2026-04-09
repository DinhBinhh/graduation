import fs from "fs";
import path from "path";
import pool from "../config/db.js";
import { deleteIfExists, fileUrl } from "../utils/files.js";
import { fail, ok } from "../utils/response.js";

function normalizeUploadedWishMedia(file) {
  if (!file) return null;

  const targetDir = path.join("uploads", "wishes");
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const nextRelativePath = path.join(targetDir, path.basename(file.path));
  if (file.path !== nextRelativePath) {
    fs.renameSync(file.path, nextRelativePath);
  }

  return nextRelativePath;
}

function mapWish(row) {
  return {
    id: row.id,
    invitationId: row.invitation_id,
    invitationName: row.invitation_name || null,
    senderName: row.sender_name || "",
    message: row.message || "",
    imageUrl: fileUrl(row.image_url),
    videoUrl: fileUrl(row.video_url),
    createdAt: row.created_at
  };
}

export async function createWish(req, res) {
  const { slug, senderName = "", message = "" } = req.body;
  const videoFile = req.files?.wishVideo?.[0];
  const imageFile = req.files?.wishImage?.[0];

  if (!slug?.trim()) {
    if (videoFile?.path) deleteIfExists(videoFile.path);
    if (imageFile?.path) deleteIfExists(imageFile.path);
    return fail(res, "Invitation slug is required", 400);
  }

  if (!message.trim() && !videoFile && !imageFile) {
    return fail(res, "Please send a text, image, or video wish", 400);
  }

  try {
    const [invitationRows] = await pool.query(
      "SELECT id, name FROM invitations WHERE public_slug = ? LIMIT 1",
      [slug.trim()]
    );
    const invitation = invitationRows[0];

    if (!invitation) {
      if (videoFile?.path) deleteIfExists(videoFile.path);
      if (imageFile?.path) deleteIfExists(imageFile.path);
      return fail(res, "Invitation not found", 404);
    }

    const wishVideoPath = normalizeUploadedWishMedia(videoFile);
    const wishImagePath = normalizeUploadedWishMedia(imageFile);

    const [result] = await pool.query(
      `
        INSERT INTO wishes (invitation_id, sender_name, message, image_url, video_url)
        VALUES (?, ?, ?, ?, ?)
      `,
      [invitation.id, senderName.trim(), message.trim(), wishImagePath, wishVideoPath]
    );

    const [rows] = await pool.query(
      `
        SELECT w.id, w.invitation_id, i.name AS invitation_name, w.sender_name, w.message, w.image_url, w.video_url, w.created_at
        FROM wishes w
        JOIN invitations i ON i.id = w.invitation_id
        WHERE w.id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    return ok(res, mapWish(rows[0]), "Wish sent", 201);
  } catch (error) {
    if (videoFile?.path) deleteIfExists(videoFile.path);
    if (imageFile?.path) deleteIfExists(imageFile.path);
    return fail(res, error.message);
  }
}

export async function listWishes(req, res) {
  try {
    const [rows] = await pool.query(
      `
        SELECT w.id, w.invitation_id, i.name AS invitation_name, w.sender_name, w.message, w.image_url, w.video_url, w.created_at
        FROM wishes w
        JOIN invitations i ON i.id = w.invitation_id
        WHERE i.owner_id = ?
        ORDER BY w.created_at DESC
      `,
      [req.user.id]
    );

    return ok(res, rows.map(mapWish), "Wish list fetched");
  } catch (error) {
    return fail(res, error.message);
  }
}

export async function deleteWish(req, res) {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `
        SELECT w.id, w.image_url, w.video_url
        FROM wishes w
        JOIN invitations i ON i.id = w.invitation_id
        WHERE w.id = ? AND i.owner_id = ?
        LIMIT 1
      `,
      [id, req.user.id]
    );
    const wish = rows[0];

    if (!wish) {
      return fail(res, "Không tìm thấy lời chúc", 404);
    }

    await pool.query("DELETE FROM wishes WHERE id = ?", [id]);
    deleteIfExists(wish.image_url);
    deleteIfExists(wish.video_url);

    return ok(res, { id: Number(id) }, "Đã xóa lời chúc");
  } catch (error) {
    return fail(res, error.message);
  }
}
