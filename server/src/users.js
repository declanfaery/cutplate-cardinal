import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.resolve(__dirname, '..', '.cache');
const usersPath = path.join(cacheDir, 'users.json');

export async function createSignup({ name, email }) {
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!cleanName) {
    const error = new Error('Name is required.');
    error.status = 400;
    throw error;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    const error = new Error('A valid email is required.');
    error.status = 400;
    throw error;
  }

  const users = await readUsers();
  const token = randomBytes(28).toString('hex');
  const now = new Date().toISOString();
  const existing = users[cleanEmail];
  const user = {
    id: existing?.id || randomBytes(10).toString('hex'),
    name: cleanName,
    email: cleanEmail,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    confirmedAt: existing?.confirmedAt || null,
    confirmationToken: token,
    confirmationSentAt: now
  };

  users[cleanEmail] = user;
  await writeUsers(users);

  const delivery = await sendConfirmationEmail(user, token);

  return {
    user: publicUser(user),
    emailSent: delivery.sent,
    devConfirmationUrl: delivery.devConfirmationUrl
  };
}

export async function confirmSignup(token) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) return null;

  const users = await readUsers();
  const user = Object.values(users).find((candidate) => candidate.confirmationToken === cleanToken);
  if (!user) return null;

  user.confirmedAt = new Date().toISOString();
  user.confirmationToken = null;
  user.updatedAt = user.confirmedAt;
  users[user.email] = user;
  await writeUsers(users);

  return publicUser(user);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    confirmedAt: user.confirmedAt
  };
}

async function readUsers() {
  try {
    const raw = await readFile(usersPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeUsers(users) {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(usersPath, JSON.stringify(users, null, 2));
}

async function sendConfirmationEmail(user, token) {
  const baseUrl = String(process.env.EMAIL_CONFIRM_BASE_URL || `http://localhost:${process.env.PORT || 4000}`)
    .trim()
    .replace(/\/$/, '');
  const confirmUrl = `${baseUrl}/api/confirm-email?token=${encodeURIComponent(token)}`;
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.EMAIL_FROM || '').trim();

  if (apiKey && from) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: user.email,
        subject: 'Confirm your CutPlate Cardinal email',
        html: buildConfirmationHtml(user.name, confirmUrl),
        text: `Confirm your CutPlate Cardinal email: ${confirmUrl}`
      })
    });

    if (!response.ok) {
      const error = new Error(`Email provider returned ${response.status}.`);
      error.status = 502;
      throw error;
    }

    return { sent: true, devConfirmationUrl: null };
  }

  console.log(`CutPlate confirmation link for ${user.email}: ${confirmUrl}`);
  return { sent: false, devConfirmationUrl: confirmUrl };
}

function buildConfirmationHtml(name, confirmUrl) {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(confirmUrl);

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h1>Welcome to CutPlate Cardinal, ${safeName}</h1>
      <p>Confirm your email so your meal plans and calendar can be tied to your account.</p>
      <p><a href="${safeUrl}" style="display:inline-block;background:#55c51f;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Confirm email</a></p>
      <p>If the button does not work, open this link: ${safeUrl}</p>
    </div>
  `;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
