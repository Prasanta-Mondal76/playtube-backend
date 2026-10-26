import { v2 as cloudinary } from 'cloudinary';
import fs from "fs"
import { Transform } from "stream";
import { ApiError } from './apiError.js';


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if(!localFilePath) return null;
    const uploadResponse = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto"
    })

    // console.log("Upload Response URL => ", uploadResponse.url)

    fs.unlinkSync(localFilePath); //After successful upload on cloudinary removed the file from our local storage
    return uploadResponse;
    
  } catch (error) {
    fs.unlinkSync(localFilePath)//If file upload on cloudinary faild then removed the file from our local storage
    throw new ApiError(500, `File upload failed. Error: ${error.message}`);
  }
}

/*
Cloudinary URL format: 
https://res.cloudinary.com/cloud-first/<resource_type>/<type or delevery type>/v<version>/<public_id>.<extension>
EX: https://res.cloudinary.com/cloud-first/image/upload/v1776620753/nakpv0jnbp82cddlzyh4.png

Syntax: cloudinary.uploader.destroy(publicId, options).

publicId (string): the asset’s public ID. For images and videos, do not include the file extension. For raw files, include the extension.
options (object): optional settings.
• resource_type (string): image, raw, or video (default image).
• type (string): delivery type (default upload).
• notification_url (string): webhook URL to notify when the delete completes.
• invalidate (boolean): if true, invalidates CDN cached copies (default false).

Return: on success, the promise resolves to { result: "ok" }.
Note: for deleting a video from cloudinary you have to pass 'resource_type'.
*/

// Same as uploadOnCloudinary, but the file is STREAMED to Cloudinary
// through a byte-counting pipe, so the caller gets a real progress %
// for the server -> Cloudinary leg. Percent is capped at 99 while bytes
// are flowing; 100 fires only when Cloudinary confirms the upload.
const uploadOnCloudinaryWithProgress = (localFilePath, onProgress) => {
  return new Promise((resolve, reject) => {
    if (!localFilePath) return resolve(null);

    let totalBytes = 0;
    try {
      totalBytes = fs.statSync(localFilePath).size;
    } catch {
      totalBytes = 0;
    }

    let sentBytes = 0;
    let lastPercent = -1;

    const counter = new Transform({
      transform(chunk, encoding, callback) {
        sentBytes += chunk.length;
        if (totalBytes > 0) {
          const percent = Math.min(99, Math.floor((sentBytes * 100) / totalBytes));
          if (percent !== lastPercent) {
            lastPercent = percent;
            onProgress?.(percent);
          }
        }
        callback(null, chunk);
      },
    });

    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "auto" },
      (error, result) => {
        fs.unlink(localFilePath, () => {});
        if (error) {
          return reject(new ApiError(500, `File upload failed. Error: ${error.message}`));
        }
        onProgress?.(100);
        resolve(result);
      }
    );

    const readStream = fs.createReadStream(localFilePath);
    readStream.on("error", (err) => {
      fs.unlink(localFilePath, () => {});
      reject(new ApiError(500, `File read failed. Error: ${err.message}`));
    });

    readStream.pipe(counter).pipe(uploadStream);
  });
};

// True only when the URL belongs to OUR Cloudinary cloud.
// Used to verify direct-upload URLs that the browser sends us,
// so nobody can save someone else's file URL as their video/image.
const isOwnCloudinaryUrl = (url) =>
  typeof url === "string" &&
  url.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`);

const deleteFromCloudinary = async (url) => {
  try {
    if(!url) return null;
    const regex = /\/([^\/]+)\/upload\/v\d+\/(.+)\.[a-zA-Z0-9]+$/
    const match = url.match(regex); // match[1] = resource_type. match[2] = public_id

    const deletedResponse = await cloudinary.uploader.destroy(match[2], {resource_type: match[1], invalidate: true})
    return deletedResponse;
  } catch (error) {
    console.log("Cloudinary deletation faild. Error: ",error.message)
    return error.message;
  }
}
export {uploadOnCloudinary, uploadOnCloudinaryWithProgress, deleteFromCloudinary, isOwnCloudinaryUrl}



















// (async function () {
//   // Configuration

//   // Upload an image

//   // Optimize delivery by resizing and applying auto-format and auto-quality
//   const optimizeUrl = cloudinary.url('shoes', {
//     fetch_format: 'auto',
//     quality: 'auto'
//   });

//   console.log(optimizeUrl);

//   // Transform the image: auto-crop to square aspect_ratio
//   const autoCropUrl = cloudinary.url('shoes', {
//     crop: 'auto',
//     gravity: 'auto',
//     width: 500,
//     height: 500,
//   });

//   console.log(autoCropUrl);
// })();