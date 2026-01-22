import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:8080';

const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export async function sendWelcomeEmail(userEmail, fornavn, brugernavn, password) {
    const mailOptions = {
        from: `"TourCare Dashboard" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: 'Velkommen til TourCare Dashboard - Din konto er oprettet',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 0;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">TourCare Dashboard</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Din konto er klar!</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px;">Hej ${fornavn}!</h2>
                            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                                Velkommen til TourCare Dashboard! Din konto er nu oprettet og klar til brug.
                            </p>
                            <table role="presentation" style="width: 100%; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 25px;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <h3 style="color: #333; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Dine login-oplysninger:</h3>
                                        <table role="presentation" style="width: 100%;">
                                            <tr>
                                                <td style="padding: 8px 0; color: #666; font-size: 14px; width: 120px;">Brugernavn:</td>
                                                <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 600;">${brugernavn}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #666; font-size: 14px;">Adgangskode:</td>
                                                <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 600;">${password}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <table role="presentation" style="width: 100%; margin-bottom: 25px;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${DASHBOARD_URL}/login.html" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 35px; border-radius: 6px; font-size: 16px; font-weight: 600;">Log ind på Dashboard</a>
                                    </td>
                                </tr>
                            </table>
                            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px 20px; border-radius: 0 8px 8px 0; margin-bottom: 25px;">
                                <h4 style="color: #856404; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Skift din adgangskode</h4>
                                <p style="color: #856404; margin: 0; font-size: 13px; line-height: 1.5;">
                                    Ved første login skal du skifte din adgangskode.
                                </p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #eee;">
                            <p style="color: #888; font-size: 12px; margin: 0;">
                                TourCare Dashboard &copy; ${new Date().getFullYear()}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    };

    try {
        await emailTransporter.sendMail(mailOptions);
        console.log(`Welcome email sent to ${userEmail}`);
        return true;
    } catch (error) {
        console.error('Error sending welcome email:', error);
        return false;
    }
}

export async function sendPasswordResetEmail(userEmail, fornavn, resetToken) {
    const resetLink = `${DASHBOARD_URL}/reset-password.html?token=${resetToken}`;

    const mailOptions = {
        from: `"TourCare Dashboard" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: 'Nulstil din adgangskode - TourCare Dashboard',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 0;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">TourCare Dashboard</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Nulstil adgangskode</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px;">Hej ${fornavn}!</h2>
                            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                                Du har anmodet om at nulstille din adgangskode.
                            </p>
                            <table role="presentation" style="width: 100%; margin-bottom: 25px;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 35px; border-radius: 6px; font-size: 16px; font-weight: 600;">Nulstil adgangskode</a>
                                    </td>
                                </tr>
                            </table>
                            <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px 20px; border-radius: 0 8px 8px 0; margin-bottom: 25px;">
                                <h4 style="color: #721c24; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Vigtigt</h4>
                                <p style="color: #721c24; margin: 0; font-size: 13px; line-height: 1.5;">
                                    Dette link udløber om <strong>1 time</strong>.
                                </p>
                            </div>
                            <p style="color: #888; font-size: 13px; line-height: 1.5; margin: 0 0 15px 0;">
                                Hvis knappen ikke virker, kan du kopiere dette link:
                            </p>
                            <p style="color: #667eea; font-size: 12px; word-break: break-all; margin: 0; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
                                ${resetLink}
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #eee;">
                            <p style="color: #888; font-size: 12px; margin: 0;">
                                TourCare Dashboard &copy; ${new Date().getFullYear()}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    };

    try {
        await emailTransporter.sendMail(mailOptions);
        console.log(`Password reset email sent to ${userEmail}`);
        return true;
    } catch (error) {
        console.error('Error sending password reset email:', error);
        return false;
    }
}

export default { sendWelcomeEmail, sendPasswordResetEmail };
