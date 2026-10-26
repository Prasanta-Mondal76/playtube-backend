import { v2 as cloudinary } from "cloudinary";
import { ApiResponse, asyncHandler } from "../utils/index.js";

// 1-stage (direct) upload support:
// The browser uploads files STRAIGHT to Cloudinary. For that it needs a
// one-time signature from us — the API SECRET itself never leaves this
// server, only the signature (valid for this folder, short-lived) goes out.
const getUploadSignature = asyncHandler(async (req, res) => {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = "playtube";

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        signature,
        timestamp,
        folder,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      },
      "Upload signature generated."
    )
  );
});

export { getUploadSignature };
