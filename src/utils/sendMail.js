import { Resend } from "resend";
import { ApiError } from "./apiError.js";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendMail = async ({
  to,
  subject,
  html,
}) => {
  try {
    const response = await resend.emails.send({
      from: "PlayTube <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    console.log("Mail Response:", response);

    return response;
  } catch (error) {
    console.error(error);

    throw new ApiError(
      500,
      error.message || "Email sending failed"
    );
  }
};