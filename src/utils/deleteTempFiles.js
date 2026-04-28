import fs from "fs";

export const deleteLocalTempFiles = (req) => {
  // Case 1: multiple files (req.files)
  if (req.files) {
    Object.values(req.files).flat().forEach(file => {
      if (file?.path) fs.unlink( file.path );
    });
  }

  // Case 2: single file (req.file)
  if (req.file?.path) {
    fs.unlink( req.file.path );
  }
};