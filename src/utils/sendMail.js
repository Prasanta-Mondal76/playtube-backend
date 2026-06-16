import * as brevo from "@getbrevo/brevo";
import { ApiError } from "./apiError.js";

const apiInstance = new brevo.TransactionalEmailsApi();

apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

export const sendMail = async ({ to, subject, html }) => {
  try {
    console.log("========== BREVO MAIL DEBUG START ==========");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("BREVO_API_KEY exists:", !!process.env.BREVO_API_KEY);

    const sendSmtpEmail = {
      sender: {
        name: "PlayTube",
        email: "noreply@playtube.com",
      },
      to: [
        {
          email: to,
        },
      ],
      subject,
      htmlContent: html,
    };

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);

    console.log("Email sent successfully");
    console.log("Response:", response);

    console.log("========== BREVO MAIL DEBUG END ==========");

    return response;
  } catch (error) {
    console.error("========== BREVO MAIL ERROR ==========");
    console.error(error);
    console.error("========== BREVO MAIL ERROR END ==========");

    throw new ApiError(
      500,
      error?.response?.body?.message || error.message
    );
  }
};