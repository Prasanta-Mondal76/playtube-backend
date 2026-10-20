import nodemailer from "nodemailer";
import { ApiError } from "./apiError.js";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, //Port 587 uses something called STARTTLS — the connection starts normally and then becomes secure. (secure: true is used only with port 465.)
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_APP_PASSWORD, // 16-digit App Password 
  },
});

export const sendMail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"PlayTube" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
    });

    return info;
  } catch (error) {
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Gmail SMTP email send failed"
    );
  }
};
