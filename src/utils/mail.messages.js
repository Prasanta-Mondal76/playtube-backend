export const registrationSuccessMail = (
  fullName,
  username,
  email
) => {
  return `
    <h2>Welcome to PlayTube 🎉</h2>

    <p>Hello ${fullName},</p>

    <p>Your registration was completed successfully.</p>

    <p>We're excited to have you on PlayTube.</p>

    <h3>Your Account Details:</h3>

    <ul>
      <li><strong>Username:</strong> ${username}</li>
      <li><strong>Email:</strong> ${email}</li>
    </ul>

    <p>You can now upload videos, create playlists, and enjoy the platform.</p>

    <p>Please keep your account credentials secure.</p>

    <br>

    <p>Best Regards,</p>
    <p><strong>Team PlayTube</strong></p>
  `;
};



export const resetLinkMail = (fullName, resetUrl) => {
  return `
    <h2>Password Reset Request 🔐</h2>

    <p>Hello ${fullName},</p>

    <p>We received a request to reset your PlayTube account password.</p>

    <p>Click the button below to reset your password:</p>

    <a 
      href="${resetUrl}" 
      style="
        display:inline-block;
        padding:10px 18px;
        background-color:#ff0000;
        color:white;
        text-decoration:none;
        border-radius:5px;
        font-weight:bold;
      "
    >
      Reset Password
    </a>

    <p>This reset link will expire soon for security reasons.</p>

    <p>If you did not request a password reset, please ignore this email.</p>

    <br>

    <p>Best Regards,</p>
    <p><strong>Team PlayTube</strong></p>
  `;
};


export const accountDeletionConfirmMail = (
  fullName,
  confirmUrl,
  cancelUrl
) => {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 30px;">
      <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <div style="background-color: #111827; padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">
            PlayTube
          </h1>
        </div>

        <!-- Body -->
        <div style="padding: 35px;">

          <h2 style="margin-top: 0; color: #111827;">
            Confirm Account Deletion
          </h2>

          <p style="font-size: 16px; color: #374151; line-height: 1.8;">
            Hi <strong>${fullName}</strong>,
          </p>

          <p style="font-size: 16px; color: #374151; line-height: 1.8;">
            We received a request to permanently delete your PlayTube account.
          </p>

          <p style="font-size: 16px; color: #374151; line-height: 1.8;">
            Once deleted, all videos and associated ecosystem data owned by your account
            will be permanently removed and cannot be recovered.
          </p>

          <!-- Warning Box -->
          <div style="
            background-color: #FEF2F2;
            border-left: 4px solid #DC2626;
            padding: 16px;
            margin: 25px 0;
            border-radius: 6px;
          ">
            <p style="margin: 0; color: #991B1B; font-size: 15px; line-height: 1.6;">
              This confirmation link will expire in <strong>1 hour</strong>.
            </p>
          </div>

          <!-- Buttons -->
          <div style="text-align: center; margin-top: 35px;">

            <a
              href="${confirmUrl}"
              style="
                display: inline-block;
                padding: 14px 26px;
                background-color: #DC2626;
                color: #ffffff;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
                margin-right: 12px;
              "
            >
              Confirm Delete
            </a>

            <a
              href="${cancelUrl}"
              style="
                display: inline-block;
                padding: 14px 26px;
                background-color: #E5E7EB;
                color: #111827;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
              "
            >
              Cancel Request
            </a>

          </div>

          <p style="
            margin-top: 40px;
            font-size: 14px;
            color: #6B7280;
            line-height: 1.7;
          ">
            If you did not request account deletion, you can safely ignore this email
            or click the cancel button above.
          </p>

        </div>

        <!-- Footer -->
        <div style="
          background-color: #F9FAFB;
          padding: 20px;
          text-align: center;
          border-top: 1px solid #E5E7EB;
        ">
          <p style="margin: 0; font-size: 14px; color: #6B7280;">
            © ${new Date().getFullYear()} PlayTube. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  `;
};



export const accountDeletionSuccessMail = (
  fullName = "User",
  supportEmail = "noreplayplaytube@gmail.com",
) => {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 30px;">
      <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        
        <div style="background-color: #111827; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">
            PlayTube
          </h1>
        </div>

        <div style="padding: 30px;">
          <h2 style="color: #111827; margin-bottom: 20px;">
            Account Deleted Successfully
          </h2>

          <p style="font-size: 16px; color: #374151; line-height: 1.7;">
            Hi <strong>${fullName}</strong>,
          </p>

          <p style="font-size: 16px; color: #374151; line-height: 1.7;">
            Your account has been permanently deleted from our platform.
          </p>

          <p style="font-size: 16px; color: #374151; line-height: 1.7;">
            All videos and associated ecosystem data owned by your account have been removed from our platform.
          </p>

          <div style="background-color: #FEF2F2; border-left: 4px solid #DC2626; padding: 15px; margin: 25px 0;">
            <p style="margin: 0; color: #991B1B; font-size: 15px;">
              This action is irreversible and your account cannot be recovered.
            </p>
          </div>

        </div>

        <div style="background-color: #F9FAFB; padding: 20px; text-align: center; border-top: 1px solid #E5E7EB;">
          <p style="margin: 0; font-size: 14px; color: #6B7280;">
            © ${new Date().getFullYear()} VideoTube. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  `;
};


export const otpMail = (fullName, otp) => {
  return `
    <div style="
      font-family: Arial, sans-serif;
      background-color: #f3f4f6;
      padding: 20px;
    ">
      <div style="
        max-width: 600px;
        margin: auto;
        background: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      ">

        <!-- Header -->
        <div style="
          background-color: #111827;
          padding: 24px;
          text-align: center;
        ">
          <h1 style="
            color: #ffffff;
            margin: 0;
            font-size: 28px;
          ">
            PlayTube
          </h1>
        </div>

        <!-- Body -->
        <div style="
          padding: 35px 20px;
        ">

          <h2 style="
            margin-top: 0;
            color: #111827;
            font-size: 24px;
          ">
            Verify Your Email 📧
          </h2>

          <p style="
            font-size: 16px;
            color: #374151;
            line-height: 1.8;
          ">
            Hi <strong>${fullName}</strong>,
          </p>

          <p style="
            font-size: 16px;
            color: #374151;
            line-height: 1.8;
          ">
            Use the OTP below to complete your PlayTube registration.
          </p>

          <!-- OTP Box -->
          <div style="
            text-align: center;
            margin: 30px 0;
          ">
            <div style="
              display: inline-block;
              background-color: #111827;
              color: #ffffff;
              font-size: clamp(24px, 6vw, 38px);
              font-weight: bold;
              letter-spacing: clamp(4px, 1vw, 12px);
              padding: 16px 24px;
              border-radius: 10px;
              max-width: 100%;
              box-sizing: border-box;
              word-break: break-word;
            ">
              ${otp}
            </div>
          </div>

          <!-- Warning Box -->
          <div style="
            background-color: #FEF2F2;
            border-left: 4px solid #DC2626;
            padding: 16px;
            margin: 25px 0;
            border-radius: 6px;
          ">
            <p style="
              margin: 0;
              color: #991B1B;
              font-size: 15px;
              line-height: 1.6;
            ">
              This OTP will expire in <strong>5 minutes</strong>. 
              Do not share it with anyone.
            </p>
          </div>

          <p style="
            margin-top: 30px;
            font-size: 14px;
            color: #6B7280;
            line-height: 1.7;
          ">
            If you did not create a PlayTube account, 
            you can safely ignore this email.
          </p>

        </div>

        <!-- Footer -->
        <div style="
          background-color: #F9FAFB;
          padding: 20px;
          text-align: center;
          border-top: 1px solid #E5E7EB;
        ">
          <p style="
            margin: 0;
            font-size: 14px;
            color: #6B7280;
          ">
            © ${new Date().getFullYear()} PlayTube. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  `;
};