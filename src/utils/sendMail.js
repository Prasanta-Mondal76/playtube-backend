import nodemailer from "nodemailer";
import { ApiError } from "./apiError.js";

export const sendMail = async ({ to, subject, html}) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth:{
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS
      },
    })
  
    const mailOptions = {
      from: process.env.EMAIL,
      to,
      subject,
      html
    }
  
    let send = await transporter.sendMail(mailOptions);
    return send;
  } catch (error) {
    throw new ApiError(500, error.message)
  }
}