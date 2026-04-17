import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import pool from "./config/db.js";
import adminRoutes from "./routes/adminRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import { ensureUploadDirectories } from "./utils/files.js";
import { fail } from "./utils/response.js";
import { ensureSchema } from "./utils/schema.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const frontendDir = path.join(rootDir, "frontend");

ensureUploadDirectories();

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(rootDir, "backend", "uploads")));
app.use("/assets", express.static(frontendDir));
app.use("/api", publicRoutes);
app.use("/api/admin", adminRoutes);

app.get("/health", async (_, res) => {
  try {
    await pool.query("SELECT 1");
    return res.json({ success: true, message: "Server is healthy" });
  } catch (error) {
    return fail(res, error.message);
  }
});

app.use("/admin", express.static(path.join(frontendDir, "admin")));
app.use("/", express.static(path.join(frontendDir, "user")));

app.use((error, _, res, __) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return fail(res, "File upload qua lon. Vui long giam kich thuoc xuong duoi 80MB.", 413);
    }

    return fail(res, error.message || "Upload file that bai", 400);
  }

  return fail(res, error.message || "Internal server error", 500);
});

async function startServer() {
  try {
    await ensureSchema();
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
