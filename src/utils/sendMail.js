import { ApiError } from "./apiError.js";

export const sendMail = async ({ to, subject, html }) => {
  try {
    const res = await fetch(process.env.MAIL_SERVICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.MAIL_SERVICE_API_KEY,
      },
      body: JSON.stringify({ to, subject, html, fromName: "PlayTube" }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      throw new ApiError(res.status || 500, data.message || "Mail service email send failed");
    }

    return data;
  } catch (error) {
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Mail service email send failed"
    );
  }
};
