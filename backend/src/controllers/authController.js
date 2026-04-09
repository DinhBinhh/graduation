import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import { fail, ok } from "../utils/response.js";
import { hashPassword, needsPasswordRehash, verifyPassword } from "../utils/password.js";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_WINDOW_MINUTES = 15;

function getLockedUntilDate() {
  const lockedUntil = new Date();
  lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCK_WINDOW_MINUTES);
  return lockedUntil;
}

export async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return fail(res, "Username and password are required", 400);
  }

  try {
    const [rows] = await pool.query(
      `
        SELECT id, username, password_hash, failed_login_attempts, locked_until
        FROM admins
        WHERE username = ?
        LIMIT 1
      `,
      [username]
    );

    const admin = rows[0];

    if (!admin) {
      return fail(res, "Sai tên đăng nhập hoặc mật khẩu", 401);
    }

    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      return fail(res, "Tài khoản tạm khóa do nhập sai quá nhiều lần. Vui lòng thử lại sau.", 423);
    }

    if (!verifyPassword(password, admin.password_hash)) {
      const nextAttempts = Number(admin.failed_login_attempts || 0) + 1;
      const shouldLock = nextAttempts >= MAX_LOGIN_ATTEMPTS;

      await pool.query(
        `
          UPDATE admins
          SET failed_login_attempts = ?, locked_until = ?
          WHERE id = ?
        `,
        [shouldLock ? 0 : nextAttempts, shouldLock ? getLockedUntilDate() : null, admin.id]
      );

      return fail(
        res,
        shouldLock
          ? "Tài khoản đã bị khóa tạm thời do nhập sai quá nhiều lần."
          : `Sai tên đăng nhập hoặc mật khẩu. Còn ${MAX_LOGIN_ATTEMPTS - nextAttempts} lần thử.`,
        401
      );
    }

    const nextPasswordHash = needsPasswordRehash(admin.password_hash)
      ? hashPassword(password)
      : admin.password_hash;

    await pool.query(
      `
        UPDATE admins
        SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL
        WHERE id = ?
      `,
      [nextPasswordHash, admin.id]
    );

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET || "replace-this-secret",
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    return ok(
      res,
      {
        token,
        user: {
          id: admin.id,
          username: admin.username
        }
      },
      "Đăng nhập thành công"
    );
  } catch (error) {
    return fail(res, error.message);
  }
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return fail(res, "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới", 400);
  }

  if (newPassword.length < 8) {
    return fail(res, "Mật khẩu mới phải có ít nhất 8 ký tự", 400);
  }

  try {
    const [rows] = await pool.query(
      "SELECT id, password_hash FROM admins WHERE id = ? LIMIT 1",
      [req.user.id]
    );
    const admin = rows[0];

    if (!admin || !verifyPassword(currentPassword, admin.password_hash)) {
      return fail(res, "Mật khẩu hiện tại không đúng", 401);
    }

    if (verifyPassword(newPassword, admin.password_hash)) {
      return fail(res, "Mật khẩu mới cần khác mật khẩu hiện tại", 400);
    }

    await pool.query(
      `
        UPDATE admins
        SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL
        WHERE id = ?
      `,
      [hashPassword(newPassword), req.user.id]
    );

    return ok(res, null, "Đổi mật khẩu thành công");
  } catch (error) {
    return fail(res, error.message);
  }
}
