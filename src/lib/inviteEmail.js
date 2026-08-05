export const buildInviteSignupUrl = ({ token, origin } = {}) => {
  const baseOrigin = (origin || '').trim();

  if (!token) {
    return '';
  }

  if (!baseOrigin) {
    return `/?invite=${encodeURIComponent(token)}`;
  }

  const url = new URL('/', baseOrigin);
  url.searchParams.set('invite', token);
  return url.toString();
};

export const buildInviteEmailContent = ({ recipientName, recipientEmail, inviterName, companyName, signupUrl }) => {
  const displayName = (recipientName || recipientEmail || 'there').trim();
  const inviter = (inviterName || 'your workspace manager').trim();
  const company = (companyName || 'your workspace').trim();

  const subject = `You've been invited to join ${company}`;
  const text = [
    `Hi ${displayName},`,
    '',
    `${inviter} invited you to join ${company} on TowCalc Pro.`,
    '',
    `Complete your account setup here: ${signupUrl}`,
    '',
    'If you did not expect this invitation, you can safely ignore this message.'
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="margin-bottom: 8px;">You're invited</h2>
      <p>Hi ${displayName},</p>
      <p>${inviter} invited you to join ${company} on TowCalc Pro.</p>
      <p style="margin: 24px 0;">
        <a href="${signupUrl}" style="background: #2563eb; color: white; padding: 12px 18px; border-radius: 999px; text-decoration: none; display: inline-block;">
          Complete your account setup
        </a>
      </p>
      <p style="font-size: 13px; color: #6b7280;">If you did not expect this invitation, you can ignore this message.</p>
    </div>
  `;

  return { subject, text, html };
};

export const buildInviteEmailPayload = ({ token, recipientEmail, recipientName, inviterName, companyName, origin }) => {
  const signupUrl = buildInviteSignupUrl({ token, origin });
  const { subject, text, html } = buildInviteEmailContent({
    recipientName,
    recipientEmail,
    inviterName,
    companyName,
    signupUrl,
  });

  return {
    to: recipientEmail,
    subject,
    text,
    html,
    signup_url: signupUrl,
  };
};
