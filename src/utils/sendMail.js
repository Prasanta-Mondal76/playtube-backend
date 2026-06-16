import { ApiError } from "./apiError.js";

export const sendMail = async ({ to, subject, html }) => {
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name: "PlayTube",
          email: process.env.BREVO_SENDER_EMAIL, // verified sender
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(
        response.status,
        data.message || "Brevo email send failed"
      );
    }

    return data;
  } catch (error) {
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Brevo email send failed"
    );
  }
};