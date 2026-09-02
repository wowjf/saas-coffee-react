import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

export type ImageScope = "avatar" | "category" | "product" | "campaign";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const SCOPE_DIRECTORIES: Record<ImageScope, string> = {
  avatar: "avatars",
  category: "categories",
  product: "products",
  campaign: "campaigns",
};

function resolveScopeDirectory(scope: ImageScope) {
  return path.join(UPLOAD_ROOT, SCOPE_DIRECTORIES[scope]);
}

function normalizeManagedImagePath(value: string) {
  if (!value) {
    return "";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      return new URL(value).pathname;
    } catch {
      return "";
    }
  }

  return value;
}

export function isManagedImagePath(value: string) {
  const normalizedValue = normalizeManagedImagePath(value);
  return /^\/uploads\/(avatars|categories|products|campaigns)\/.+\.webp$/i.test(normalizedValue);
}

export async function ensureUploadDirectories() {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  await Promise.all(
    Object.values(SCOPE_DIRECTORIES).map((directory) =>
      fs.mkdir(path.join(UPLOAD_ROOT, directory), { recursive: true }),
    ),
  );
}

export function getUploadRoot() {
  return UPLOAD_ROOT;
}

export async function saveImageAsWebp(buffer: Buffer, scope: ImageScope) {
  await ensureUploadDirectories();

  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.webp`;
  const directory = resolveScopeDirectory(scope);
  const absolutePath = path.join(directory, fileName);

  await sharp(buffer)
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toFile(absolutePath);

  return `/uploads/${SCOPE_DIRECTORIES[scope]}/${fileName}`;
}

export async function deleteManagedImage(value: string | undefined | null) {
  if (!value) {
    return;
  }

  const normalizedValue = normalizeManagedImagePath(value);

  if (!isManagedImagePath(normalizedValue)) {
    return;
  }

  const relativePath = normalizedValue.replace(/^\/+/, "");
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const uploadRoot = path.resolve(UPLOAD_ROOT);

  if (!absolutePath.startsWith(uploadRoot)) {
    return;
  }

  await fs.rm(absolutePath, { force: true });
}

export async function clearManagedUploads(excludePaths: string[] = []) {
  const normalizedExcludes = excludePaths
    .map(val => {
      if (!val) return "";
      if (val.startsWith("http://") || val.startsWith("https://")) {
        try {
          return new URL(val).pathname;
        } catch {
          return "";
        }
      }
      return val;
    })
    .filter(Boolean)
    .map(val => path.resolve(process.cwd(), val.replace(/^\/+/, "")));

  const cleanDir = async (dirPath: string) => {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const resolvedPath = path.resolve(fullPath);
        if (normalizedExcludes.some(exclude => resolvedPath === exclude)) {
          continue;
        }
        if (entry.isDirectory()) {
          await cleanDir(fullPath);
          try {
            const subEntries = await fs.readdir(fullPath);
            if (subEntries.length === 0) {
              await fs.rmdir(fullPath);
            }
          } catch {
            // ignore
          }
        } else {
          await fs.unlink(fullPath);
        }
      }
    } catch (err) {
      // ignore
    }
  };

  await cleanDir(UPLOAD_ROOT);
  await ensureUploadDirectories();
}
