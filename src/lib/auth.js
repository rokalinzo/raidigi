import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

/* Autentikasi RaiDigi.
   - Pembeli: email + kata sandi (bcrypt), sesi = cookie bertanda tangan HMAC.
   - Admin: kredensial terpisah dari env ADMIN_EMAIL / ADMIN_PASSWORD. */

const SESSION_COOKIE = "rdg_session";
const ADMIN_COOKIE = "rdg_admin";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  return "raidigi-dev-secret-wajib-diganti-di-produksi";
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return body + "." + sig;
}

function verify(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function checkPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/* ---------------- Sesi pembeli ---------------- */

export async function setSessionCookie(user) {
  const store = await cookies();
  const token = sign({
    uid: user.id,
    name: user.name,
    email: user.email,
    exp: Date.now() + MAX_AGE * 1000,
  });
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const payload = verify(token);
  if (!payload || !payload.uid) return null;
  return { id: payload.uid, name: payload.name, email: payload.email };
}

/* ---------------- Sesi admin ---------------- */

export function adminConfigured() {
  return !!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
}

export function checkAdminCredentials(email, password) {
  if (!adminConfigured()) return false;
  const e = Buffer.from(String(email || ""));
  const pe = Buffer.from(process.env.ADMIN_EMAIL);
  const p = Buffer.from(String(password || ""));
  const pp = Buffer.from(process.env.ADMIN_PASSWORD);
  const emailOk = e.length === pe.length && crypto.timingSafeEqual(e, pe);
  const passOk = p.length === pp.length && crypto.timingSafeEqual(p, pp);
  return emailOk && passOk;
}

export async function setAdminCookie() {
  const store = await cookies();
  const token = sign({ admin: true, email: process.env.ADMIN_EMAIL, exp: Date.now() + MAX_AGE * 1000 });
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminCookie() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function isAdmin() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  const payload = verify(token);
  return !!(payload && payload.admin);
}
