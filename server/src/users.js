import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.resolve(__dirname, '..', '.cache');
const usersPath = path.join(cacheDir, 'users.json');
const { Pool } = pg;
const databaseUrl = String(process.env.DATABASE_URL || '').trim();
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    })
  : null;

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

  const token = randomBytes(28).toString('hex');
  const now = new Date().toISOString();
  const existing = await findUserByEmail(cleanEmail);
  const user = await upsertUser({
    id: existing?.id || randomBytes(10).toString('hex'),
    name: cleanName,
    email: cleanEmail,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    confirmedAt: existing?.confirmedAt || null,
    confirmationToken: token,
    confirmationSentAt: now
  });

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

  const user = await findUserByConfirmationToken(cleanToken);
  if (!user) return null;

  const confirmedAt = new Date().toISOString();
  const confirmedUser = await upsertUser({
    ...user,
    confirmedAt,
    confirmationToken: null,
    updatedAt: confirmedAt
  });

  return publicUser(confirmedUser);
}

export async function deleteSignup(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!cleanEmail) {
    const error = new Error('Email is required.');
    error.status = 400;
    throw error;
  }

  await deleteUserByEmail(cleanEmail);

  return { ok: true };
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    confirmedAt: user.confirmedAt
  };
}

async function findUserByEmail(email) {
  if (pool) {
    const result = await pool.query(
      `select id, name, email, created_at, updated_at, confirmed_at, confirmation_token, confirmation_sent_at
       from public.app_users
       where email = $1
       limit 1`,
      [email]
    );
    return result.rows[0] ? dbRowToUser(result.rows[0]) : null;
  }

  const users = await readUsers();
  return users[email] || null;
}

async function findUserByConfirmationToken(token) {
  if (pool) {
    const result = await pool.query(
      `select id, name, email, created_at, updated_at, confirmed_at, confirmation_token, confirmation_sent_at
       from public.app_users
       where confirmation_token = $1
       limit 1`,
      [token]
    );
    return result.rows[0] ? dbRowToUser(result.rows[0]) : null;
  }

  const users = await readUsers();
  return Object.values(users).find((candidate) => candidate.confirmationToken === token) || null;
}

async function upsertUser(user) {
  if (pool) {
    const result = await pool.query(
      `insert into public.app_users (
          id,
          name,
          email,
          created_at,
          updated_at,
          confirmed_at,
          confirmation_token,
          confirmation_sent_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (email) do update set
          name = excluded.name,
          updated_at = excluded.updated_at,
          confirmed_at = excluded.confirmed_at,
          confirmation_token = excluded.confirmation_token,
          confirmation_sent_at = excluded.confirmation_sent_at
        returning id, name, email, created_at, updated_at, confirmed_at, confirmation_token, confirmation_sent_at`,
      [
        user.id,
        user.name,
        user.email,
        user.createdAt,
        user.updatedAt,
        user.confirmedAt,
        user.confirmationToken,
        user.confirmationSentAt
      ]
    );
    return dbRowToUser(result.rows[0]);
  }

  const users = await readUsers();
  users[user.email] = user;
  await writeUsers(users);
  return user;
}

async function deleteUserByEmail(email) {
  if (pool) {
    await pool.query('delete from public.app_users where email = $1', [email]);
    return;
  }

  const users = await readUsers();
  delete users[email];
  await writeUsers(users);
}

function dbRowToUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    confirmedAt: toIsoString(row.confirmed_at),
    confirmationToken: row.confirmation_token,
    confirmationSentAt: toIsoString(row.confirmation_sent_at)
  };
}

function toIsoString(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
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
