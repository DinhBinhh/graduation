import pool from "../config/db.js";
import { fail, ok } from "../utils/response.js";
import { deleteIfExists, fileUrl } from "../utils/files.js";
import { generateUniqueInvitationSlug } from "../utils/invitationSlug.js";
import { deleteFromCloudinary, uploadToCloudinary } from "../utils/cloudinaryMedia.js";

function mapInvitation(row, ownerUsername = row.owner_username) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerUsername: ownerUsername || null,
    name: row.name,
    note: row.note || "",
    scare: Boolean(row.scare),
    coverImage: fileUrl(row.cover_image),
    cardImage: fileUrl(row.card_image),
    videoUrl: fileUrl(row.video_url),
    publicSlug: row.public_slug || null,
    publicUrl: row.public_slug ? `/card.html?slug=${encodeURIComponent(row.public_slug)}` : null,
    createdAt: row.created_at
  };
}

export async function getInvitationByName(req, res) {
  const slug = req.query.slug?.trim();
  const name = req.query.name?.trim();
  const owner = req.query.owner?.trim();

  if (!slug && !name) {
    return fail(res, "Slug or name is required", 400);
  }

  try {
    let rows;

    if (slug) {
      [rows] = await pool.query(
        `
          SELECT i.id, i.owner_id, i.public_slug, i.name, i.note, i.scare, i.cover_image, i.card_image, i.video_url, i.created_at, a.username AS owner_username
          FROM invitations i
          JOIN admins a ON a.id = i.owner_id
          WHERE i.public_slug = ?
          LIMIT 1
        `,
        [slug]
      );
    } else if (owner) {
      [rows] = await pool.query(
        `
          SELECT i.id, i.owner_id, i.public_slug, i.name, i.note, i.scare, i.cover_image, i.card_image, i.video_url, i.created_at, a.username AS owner_username
          FROM invitations i
          JOIN admins a ON a.id = i.owner_id
          WHERE i.name = ? AND a.username = ?
          LIMIT 1
        `,
        [name, owner]
      );
    } else {
      [rows] = await pool.query(
        `
          SELECT i.id, i.owner_id, i.public_slug, i.name, i.note, i.scare, i.cover_image, i.card_image, i.video_url, i.created_at, a.username AS owner_username
          FROM invitations i
          JOIN admins a ON a.id = i.owner_id
          WHERE i.name = ?
          ORDER BY i.created_at DESC
          LIMIT 2
        `,
        [name]
      );

      if (rows.length > 1) {
        return fail(res, "Ten nay ton tai o nhieu tai khoan. Hay dung link rieng cua thiep.", 409);
      }
    }

    if (!rows.length) {
      return fail(res, "Invitation not found", 404);
    }

    return ok(res, mapInvitation(rows[0]), "Invitation fetched");
  } catch (error) {
    return fail(res, error.message);
  }
}

export async function listInvitations(req, res) {
  try {
    const [rows] = await pool.query(
      `
        SELECT id, owner_id, public_slug, name, note, scare, cover_image, card_image, video_url, created_at
        FROM invitations
        WHERE owner_id = ?
        ORDER BY created_at DESC
      `,
      [req.user.id]
    );

    return ok(res, rows.map((row) => mapInvitation(row, req.user.username)), "Invitation list fetched");
  } catch (error) {
    return fail(res, error.message);
  }
}

export async function createInvitation(req, res) {
  const { name, note = "", scare = "false" } = req.body;
  const coverFile = req.files?.coverImage?.[0];
  const imageFile = req.files?.cardImage?.[0];
  const videoFile = req.files?.videoFile?.[0];

  if (!name?.trim()) {
    return fail(res, "Name is required", 400);
  }

  if (!imageFile) {
    return fail(res, "Card image is required", 400);
  }

  try {
    const coverImagePath = coverFile ? await uploadToCloudinary(coverFile.path, "cover") : null;
    const cardImagePath = await uploadToCloudinary(imageFile.path, "card");
    const videoPath = videoFile ? await uploadToCloudinary(videoFile.path, "scare") : null;
    const publicSlug = await generateUniqueInvitationSlug(pool);

    const [result] = await pool.query(
      `
        INSERT INTO invitations (owner_id, public_slug, name, note, cover_image, card_image, scare, video_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [req.user.id, publicSlug, name.trim(), note.trim(), coverImagePath, cardImagePath, scare === "true", videoPath]
    );

    const [rows] = await pool.query(
      `
        SELECT id, owner_id, public_slug, name, note, scare, cover_image, card_image, video_url, created_at
        FROM invitations
        WHERE id = ? AND owner_id = ?
        LIMIT 1
      `,
      [result.insertId, req.user.id]
    );

    return ok(res, mapInvitation(rows[0], req.user.username), "Invitation created", 201);
  } catch (error) {
    if (coverFile?.path) deleteIfExists(coverFile.path);
    if (imageFile?.path) deleteIfExists(imageFile.path);
    if (videoFile?.path) deleteIfExists(videoFile.path);
    return fail(res, error.message);
  }
}

export async function updateInvitation(req, res) {
  const { id } = req.params;
  const { name, note, scare } = req.body;
  const coverFile = req.files?.coverImage?.[0];
  const imageFile = req.files?.cardImage?.[0];
  const videoFile = req.files?.videoFile?.[0];

  try {
    const [existingRows] = await pool.query(
      "SELECT * FROM invitations WHERE id = ? AND owner_id = ? LIMIT 1",
      [id, req.user.id]
    );
    const existing = existingRows[0];

    if (!existing) {
      return fail(res, "Invitation not found", 404);
    }

    const nextCoverImage = coverFile
      ? await uploadToCloudinary(coverFile.path, "cover")
      : (req.body.keepCover === "false" ? null : existing.cover_image);
    const nextCardImage = imageFile ? await uploadToCloudinary(imageFile.path, "card") : existing.card_image;
    const nextVideoUrl =
      videoFile ? await uploadToCloudinary(videoFile.path, "scare") : (req.body.keepVideo === "false" ? null : existing.video_url);

    await pool.query(
      "UPDATE invitations SET name = ?, note = ?, scare = ?, cover_image = ?, card_image = ?, video_url = ? WHERE id = ?",
      [
        name?.trim() || existing.name,
        typeof note === "undefined" ? existing.note : note.trim(),
        typeof scare === "undefined" ? existing.scare : scare === "true",
        nextCoverImage,
        nextCardImage,
        nextVideoUrl,
        id
      ]
    );

    if (coverFile && existing.cover_image !== nextCoverImage) {
      deleteIfExists(existing.cover_image);
      await deleteFromCloudinary(existing.cover_image);
    }
    if (req.body.keepCover === "false" && existing.cover_image) {
      deleteIfExists(existing.cover_image);
      await deleteFromCloudinary(existing.cover_image);
    }
    if (imageFile && existing.card_image !== nextCardImage) {
      deleteIfExists(existing.card_image);
      await deleteFromCloudinary(existing.card_image);
    }
    if (videoFile && existing.video_url !== nextVideoUrl) {
      deleteIfExists(existing.video_url);
      await deleteFromCloudinary(existing.video_url);
    }
    if (req.body.keepVideo === "false" && existing.video_url) {
      deleteIfExists(existing.video_url);
      await deleteFromCloudinary(existing.video_url);
    }

    const [rows] = await pool.query(
      `
        SELECT id, owner_id, public_slug, name, note, scare, cover_image, card_image, video_url, created_at
        FROM invitations
        WHERE id = ? AND owner_id = ?
        LIMIT 1
      `,
      [id, req.user.id]
    );

    return ok(res, mapInvitation(rows[0], req.user.username), "Invitation updated");
  } catch (error) {
    if (coverFile?.path) deleteIfExists(coverFile.path);
    if (imageFile?.path) deleteIfExists(imageFile.path);
    if (videoFile?.path) deleteIfExists(videoFile.path);
    return fail(res, error.message);
  }
}

export async function deleteInvitation(req, res) {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM invitations WHERE id = ? AND owner_id = ? LIMIT 1",
      [id, req.user.id]
    );
    const invitation = rows[0];

    if (!invitation) {
      return fail(res, "Invitation not found", 404);
    }

    const [wishRows] = await pool.query(
      "SELECT image_url, video_url FROM wishes WHERE invitation_id = ?",
      [id]
    );

    for (const wish of wishRows) {
      deleteIfExists(wish.image_url);
      deleteIfExists(wish.video_url);
      await deleteFromCloudinary(wish.image_url);
      await deleteFromCloudinary(wish.video_url);
    }

    await pool.query("DELETE FROM wishes WHERE invitation_id = ?", [id]);
    await pool.query("DELETE FROM invitations WHERE id = ? AND owner_id = ?", [id, req.user.id]);
    deleteIfExists(invitation.cover_image);
    deleteIfExists(invitation.card_image);
    deleteIfExists(invitation.video_url);
    await deleteFromCloudinary(invitation.cover_image);
    await deleteFromCloudinary(invitation.card_image);
    await deleteFromCloudinary(invitation.video_url);

    return ok(res, { id: Number(id) }, "Invitation deleted");
  } catch (error) {
    return fail(res, error.message);
  }
}
