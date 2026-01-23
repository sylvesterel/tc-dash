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
        from: `"Appcare Dashboard" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: 'Velkommen til Appcare Dashboard',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #101922;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #101922;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #111418; border-radius: 24px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #137FEC 0%, #0B4490 100%); padding: 50px 40px; text-align: center;">
                            <table role="presentation" style="width: 100%;">
                                <tr>
                                    <td style="text-align: center;">
                                        <div style="display: inline-block; width: 64px; height: 64px; background-color: rgba(255,255,255,0.2); border-radius: 16px; line-height: 64px; margin-bottom: 20px;">
                                            <span style="color: #ffffff; font-size: 28px;"><i class="fa-solid fa-door-open"></i></span>
                                        </div>
                                        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Velkommen!</h1>
                                        <p style="color: rgba(255,255,255,0.8); margin: 12px 0 0 0; font-size: 16px;">Din konto er nu oprettet</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 50px 40px;">
                            <h2 style="color: #E0E0E0; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">Hej ${fornavn}!</h2>
                            <p style="color: #9DABB9; font-size: 16px; line-height: 1.7; margin: 0 0 30px 0;">
                                Velkommen til Appcare Dashboard. Din konto er klar til brug, og du kan nu logge ind med oplysningerne nedenfor.
                            </p>

                            <!-- Credentials Box -->
                            <table role="presentation" style="width: 100%; background-color: rgba(19, 127, 236, 0.08); border: 1px solid rgba(19, 127, 236, 0.2); border-radius: 16px; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 28px;">
                                        <h3 style="color: #137FEC; margin: 0 0 20px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Dine login-oplysninger</h3>
                                        <table role="presentation" style="width: 100%;">
                                            <tr>
                                                <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                                    <span style="color: #9DABB9; font-size: 13px;">Brugernavn</span>
                                                    <p style="color: #E0E0E0; font-size: 18px; font-weight: 600; margin: 6px 0 0 0;">${brugernavn}</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <span style="color: #9DABB9; font-size: 13px;">Adgangskode</span>
                                                    <p style="color: #E0E0E0; font-size: 18px; font-weight: 600; margin: 6px 0 0 0; font-family: monospace; background-color: rgba(255,255,255,0.05); display: inline-block; padding: 4px 12px; border-radius: 6px;">${password}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; margin-bottom: 30px;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${DASHBOARD_URL}/login.html" style="display: inline-block; background: linear-gradient(135deg, #137FEC 0%, #0F63C1 100%); color: #ffffff; text-decoration: none; padding: 18px 48px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(19, 127, 236, 0.3);">Log ind nu</a>
                                    </td>
                                </tr>
                            </table>

                            <!-- Warning Box -->
                            <table role="presentation" style="width: 100%; background-color: rgba(255, 193, 7, 0.08); border-left: 4px solid #FFC107; border-radius: 0 12px 12px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h4 style="color: #FFC107; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Vigtigt</h4>
                                        <p style="color: #9DABB9; margin: 0; font-size: 14px; line-height: 1.6;">
                                            Ved din første login vil du blive bedt om at skifte din adgangskode.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: rgba(0,0,0,0.2); padding: 30px 40px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06);">
                            <p style="color: #9DABB9; font-size: 13px; margin: 0;">
                                Appcare Dashboard &bull; Tourcare
                            </p>
                            <p style="color: #666; font-size: 12px; margin: 10px 0 0 0;">
                                &copy; ${new Date().getFullYear()} Alle rettigheder forbeholdes
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
        from: `"Appcare Dashboard" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: 'Nulstil din adgangskode - Appcare Dashboard',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #101922;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #101922;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #111418; border-radius: 24px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #137FEC 0%, #0B4490 100%); padding: 50px 40px; text-align: center;">
                            <table role="presentation" style="width: 100%;">
                                <tr>
                                    <td style="text-align: center;">
                                        <div style="display: inline-block; width: 64px; height: 64px; background-color: rgba(255,255,255,0.2); border-radius: 16px; line-height: 64px; margin-bottom: 20px;">
                                            <span style="color: #ffffff; font-size: 28px;"><i class="fa-solid fa-lock"></i></span>
                                        </div>
                                        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Nulstil adgangskode</h1>
                                        <p style="color: rgba(255,255,255,0.8); margin: 12px 0 0 0; font-size: 16px;">Du har anmodet om en ny adgangskode</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 50px 40px;">
                            <h2 style="color: #E0E0E0; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">Hej ${fornavn}!</h2>
                            <p style="color: #9DABB9; font-size: 16px; line-height: 1.7; margin: 0 0 30px 0;">
                                Vi har modtaget en anmodning om at nulstille adgangskoden til din Appcare Dashboard konto. Klik på knappen nedenfor for at oprette en ny adgangskode.
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; margin-bottom: 30px;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #137FEC 0%, #0F63C1 100%); color: #ffffff; text-decoration: none; padding: 18px 48px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(19, 127, 236, 0.3);">Nulstil adgangskode</a>
                                    </td>
                                </tr>
                            </table>

                            <!-- Warning Box -->
                            <table role="presentation" style="width: 100%; background-color: rgba(255, 82, 82, 0.08); border-left: 4px solid #FF5252; border-radius: 0 12px 12px 0; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h4 style="color: #FF5252; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Vigtigt</h4>
                                        <p style="color: #9DABB9; margin: 0; font-size: 14px; line-height: 1.6;">
                                            Dette link udlober om <strong style="color: #E0E0E0;">1 time</strong>. Hvis du ikke har anmodet om denne nulstilling, kan du ignorere denne email.
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Fallback Link -->
                            <table role="presentation" style="width: 100%; background-color: rgba(255,255,255,0.03); border-radius: 12px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="color: #9DABB9; font-size: 13px; margin: 0 0 10px 0;">
                                            Virker knappen ikke? Kopier dette link:
                                        </p>
                                        <p style="color: #137FEC; font-size: 12px; word-break: break-all; margin: 0; background-color: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; font-family: monospace;">
                                            ${resetLink}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: rgba(0,0,0,0.2); padding: 30px 40px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06);">
                            <p style="color: #9DABB9; font-size: 13px; margin: 0;">
                                Appcare Dashboard &bull; Tourcare
                            </p>
                            <p style="color: #666; font-size: 12px; margin: 10px 0 0 0;">
                                &copy; ${new Date().getFullYear()} Alle rettigheder forbeholdes
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
