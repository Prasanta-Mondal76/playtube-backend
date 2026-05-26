import fs from "node:fs";
import path from "node:path";

const TEMP_DIR = "./public/temp";
const MAX_AGE_MS = 300000;

export const cleanupTempFiles = () => {
  const now = Date.now();

  const tempFiles = fs.readdirSync(TEMP_DIR)
  if(tempFiles.length === 1) return;

  tempFiles.forEach((file) => {
    if(file !== ".gitkeep"){
      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);
      const ageInMs = now - stats.mtimeMs;
  
      if (ageInMs > MAX_AGE_MS) {
        fs.unlinkSync(filePath);
      }
    }
  });
};