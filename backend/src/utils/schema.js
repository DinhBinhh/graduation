import pool from "../config/db.js";
import { generateUniqueInvitationSlug } from "./invitationSlug.js";
import { hashPassword } from "./password.js";

async function hasColumn(tableName, columnName) {
  const [rows] = await pool.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );

  return rows.length > 0;
}

async function hasIndex(tableName, indexName) {
  const [rows] = await pool.query(
    `
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1
    `,
    [tableName, indexName]
  );

  return rows.length > 0;
}

export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      failed_login_attempts INT NOT NULL DEFAULT 0,
      locked_until DATETIME NULL
    )
  `);

  const defaultDemoPasswordHash = hashPassword("change-me-before-production");

  await pool.query(`
    INSERT INTO admins (username, password_hash)
    VALUES ('admin_demo_1', ?)
    ON DUPLICATE KEY UPDATE username = username
  `, [defaultDemoPasswordHash]);

  await pool.query(`
    INSERT INTO admins (username, password_hash)
    VALUES ('admin_demo_2', ?)
    ON DUPLICATE KEY UPDATE username = username
  `, [defaultDemoPasswordHash]);

  const failedAttemptsExists = await hasColumn("admins", "failed_login_attempts");
  if (!failedAttemptsExists) {
    await pool.query(`
      ALTER TABLE admins
      ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0 AFTER password_hash
    `);
  }

  const lockedUntilExists = await hasColumn("admins", "locked_until");
  if (!lockedUntilExists) {
    await pool.query(`
      ALTER TABLE admins
      ADD COLUMN locked_until DATETIME NULL AFTER failed_login_attempts
    `);
  }

  const invitationOwnerExists = await hasColumn("invitations", "owner_id");

  if (!invitationOwnerExists) {
    await pool.query(`
      ALTER TABLE invitations
      ADD COLUMN owner_id INT NULL AFTER id
    `);
  }

  const invitationSlugExists = await hasColumn("invitations", "public_slug");

  if (!invitationSlugExists) {
    await pool.query(`
      ALTER TABLE invitations
      ADD COLUMN public_slug VARCHAR(80) NULL AFTER owner_id
    `);
  }

  const invitationNoteExists = await hasColumn("invitations", "note");

  if (!invitationNoteExists) {
    await pool.query(`
      ALTER TABLE invitations
      ADD COLUMN note TEXT NULL AFTER name
    `);
  }

  const [adminRows] = await pool.query(
    "SELECT id FROM admins ORDER BY id ASC LIMIT 1"
  );
  const fallbackAdminId = adminRows[0]?.id;

  if (fallbackAdminId) {
    await pool.query(
      "UPDATE invitations SET owner_id = ? WHERE owner_id IS NULL",
      [fallbackAdminId]
    );
  }

  const globalNameUniqueIndexExists = await hasIndex("invitations", "name");

  if (globalNameUniqueIndexExists) {
    await pool.query("ALTER TABLE invitations DROP INDEX name");
  }

  const ownerNameUniqueIndexExists = await hasIndex("invitations", "owner_name_unique");

  if (!ownerNameUniqueIndexExists) {
    await pool.query(`
      ALTER TABLE invitations
      ADD UNIQUE INDEX owner_name_unique (owner_id, name)
    `);
  }

  const [sluglessRows] = await pool.query(
    "SELECT id FROM invitations WHERE public_slug IS NULL OR public_slug = ''"
  );

  for (const row of sluglessRows) {
    const slug = await generateUniqueInvitationSlug(pool);
    await pool.query(
      "UPDATE invitations SET public_slug = ? WHERE id = ?",
      [slug, row.id]
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wishes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invitation_id INT NOT NULL,
      sender_name VARCHAR(255) NULL,
      message TEXT NULL,
      image_url VARCHAR(255) NULL,
      video_url VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_wishes_invitation
        FOREIGN KEY (invitation_id) REFERENCES invitations(id)
        ON DELETE CASCADE
    )
  `);

  const wishImageExists = await hasColumn("wishes", "image_url");

  if (!wishImageExists) {
    await pool.query(`
      ALTER TABLE wishes
      ADD COLUMN image_url VARCHAR(255) NULL AFTER message
    `);
  }
}
