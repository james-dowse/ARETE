import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendInvitationEmail(email: string, token: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3040'
  const inviteUrl = `${appUrl}/api/invite/accept?token=${token}`
  const from = process.env.RESEND_FROM || 'ARETE <onboarding@resend.dev>'

  const { data, error } = await resend.emails.send({
    from,
    to: [email],
    subject: 'Invitation à rejoindre ARETE',
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:48px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;border:1px solid rgba(201,165,53,0.2);overflow:hidden;">
        <tr><td style="padding:36px 40px 28px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:11px;font-weight:700;letter-spacing:4px;color:#C9A535;margin-bottom:4px;">ARETE</div>
          <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.25);">PROTOCOL</div>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">Tu es invité(e) à rejoindre ARETE</p>
          <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.65;">ARETE est un protocole d'entraînement intelligent. Tu as été invité(e) à accéder à l'application.</p>
          <a href="${inviteUrl}" style="display:inline-block;background:#C9A535;color:#000;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">Accepter l'invitation</a>
          <p style="margin:28px 0 0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.6;">Ou copie ce lien :<br/><span style="color:rgba(201,165,53,0.6);word-break:break-all;">${inviteUrl}</span></p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.18);">ARETE Protocol · Si tu n'attendais pas cette invitation, ignore-le.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim(),
  })
  if (error) throw new Error(error.message)
  return data
}

// Relay vers l'admin quand Resend bloque l'envoi direct (plan sans domaine vérifié)
export async function sendRelayEmail(ownerEmail: string, recipientEmail: string, inviteUrl: string) {
  const from = process.env.RESEND_FROM || 'ARETE <onboarding@resend.dev>'
  const { data, error } = await resend.emails.send({
    from,
    to: [ownerEmail],
    subject: `[ARETE] Lien d'invitation pour ${recipientEmail}`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:48px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;border:1px solid rgba(201,165,53,0.2);overflow:hidden;">
        <tr><td style="padding:36px 40px 28px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:11px;font-weight:700;letter-spacing:4px;color:#C9A535;">ARETE</div>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#fff;">Lien d'invitation à transmettre</p>
          <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.65;">
            L'email n'a pas pu être envoyé directement à <strong style="color:rgba(255,255,255,0.8);">${recipientEmail}</strong>.<br/>Transmets-lui ce lien :
          </p>
          <div style="background:#111;border:1px solid rgba(201,165,53,0.2);border-radius:10px;padding:14px 18px;margin-bottom:24px;word-break:break-all;font-size:13px;color:#C9A535;">${inviteUrl}</div>
          <a href="${inviteUrl}" style="display:inline-block;background:#C9A535;color:#000;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">Ouvrir le lien</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim(),
  })
  if (error) throw new Error(error.message)
  return data
}

export async function sendWorkoutShareEmail(toEmail: string, fromEmail: string, workoutName: string, token: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3040'
  const acceptUrl = `${appUrl}/api/share/accept?token=${token}`
  const from = process.env.RESEND_FROM || 'ARETE <onboarding@resend.dev>'
  const fromName = fromEmail.split('@')[0]

  const { data, error } = await resend.emails.send({
    from,
    to: [toEmail],
    subject: `${fromName} t'a partagé un workout ARETE`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:48px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;border:1px solid rgba(201,165,53,0.2);overflow:hidden;">
        <tr><td style="padding:36px 40px 28px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:11px;font-weight:700;letter-spacing:4px;color:#C9A535;">ARETE</div>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;">Nouveau workout partagé</p>
          <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.65;"><strong style="color:rgba(255,255,255,0.8);">${fromName}</strong> t'a partagé son workout.</p>
          <div style="background:#111;border:1px solid rgba(201,165,53,0.25);border-radius:12px;padding:18px 20px;margin-bottom:28px;">
            <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#C9A535;margin-bottom:6px;">WORKOUT</div>
            <div style="font-size:18px;font-weight:700;color:#fff;">${workoutName}</div>
          </div>
          <a href="${acceptUrl}" style="display:inline-block;background:#C9A535;color:#000;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">Voir le workout</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim(),
  })
  if (error) throw new Error(error.message)
  return data
}
