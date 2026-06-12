import fs from "fs";

export const deleteLocalTempFiles = (req) => {

  // Multiple files
  if (req.files) {

    Object.values(req.files)
      .flat()
      .forEach((file) => {

        if (
          file?.path &&
          fs.existsSync(file.path)
        ) {
          fs.unlinkSync(file.path);
        }

      });
  }

  // Single file
  if (
    req.file?.path &&
    fs.existsSync(req.file.path)
  ) {
    fs.unlinkSync(req.file.path);
  }
};