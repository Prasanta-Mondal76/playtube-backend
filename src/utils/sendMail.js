import nodemailer from "nodemailer";
import { ApiError } from "./apiError.js";

export const sendMail = async ({ to, subject, html }) => {
  try {
    console.log("========== MAIL DEBUG START ==========");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("EMAIL exists:", !!process.env.EMAIL);
    console.log("EMAIL_PASS exists:", !!process.env.EMAIL_PASS);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    console.log("Transporter created");

    console.log("Verifying SMTP connection...");

    await transporter.verify();

    console.log("SMTP verification successful");

    const mailOptions = {
      from: process.env.EMAIL,
      to,
      subject,
      html,
    };

    console.log("Sending email...");

    const send = await transporter.sendMail(mailOptions);

    console.log("Email sent successfully");
    console.log("Message ID:", send.messageId);
    console.log("Response:", send.response);

    console.log("========== MAIL DEBUG END ==========");

    return send;
  } catch (error) {
    console.error("========== MAIL ERROR ==========");
    console.error(error);
    console.error("Message:", error.message);
    console.error("Code:", error.code);
    console.error("Command:", error.command);
    console.error("========== MAIL ERROR END ==========");

    throw new ApiError(500, error.message);
  }
};