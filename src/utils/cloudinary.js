import { v2 as cloudinary } from 'cloudinary';
import fs from "fs"
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

const deleteFromCloudinary = async (url) => {
  try {
    if(!url) return null;
    const regex = /\/([^\/]+)\/upload\/v\d+\/(.+)\.[a-zA-Z]+$/
    const match = url.match(regex); // match[1] = resource_type. match[2] = public_id

    const deletedResponse = await cloudinary.uploader.destroy(match[2], {resource_type: match[1], invalidate: true})
    return deletedResponse;
  } catch (error) {
    console.log("Cloudinary deletation faild. Error: ",error.message)
    return error.message;
  }
}
export {uploadOnCloudinary, deleteFromCloudinary}



















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