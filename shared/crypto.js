// shared/crypto.js
// Local-only password hashing using the Web Crypto API (PBKDF2 + SHA-256).
// The plaintext Padlox password is never stored and never leaves the device.

export const PBKDF2_ITERATIONS = 300000;
const HASH_ALGO = 'SHA-256';
const KEY_LENGTH_BITS = 256;
const SALT_LENGTH_BYTES = 16;

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
}

async function deriveHash(password, saltBytes, iterations) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: HASH_ALGO },
    keyMaterial,
    KEY_LENGTH_BITS
  );
  return toBase64(bits);
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Create a new verifier record for a password. Only the salt, derived
 * hash, and iteration count are stored — never the password itself.
 */
export async function createVerifier(password) {
  const salt = generateSalt();
  const hash = await deriveHash(password, salt, PBKDF2_ITERATIONS);
  return {
    salt: toBase64(salt),
    hash,
    iterations: PBKDF2_ITERATIONS,
    algo: HASH_ALGO,
    version: 1,
    createdAt: Date.now()
  };
}

/**
 * Verify a candidate password against a stored verifier record.
 */
export function validateVerifier(config) {
  const invalid = () => { throw new Error('Invalid Padlox password data.'); };
  if (!config || typeof config !== 'object' || Array.isArray(config)) invalid();
  if (config.version !== undefined && config.version !== 1) invalid();
  if (config.algo !== HASH_ALGO || config.iterations !== PBKDF2_ITERATIONS) invalid();
  for (const [field, length] of [['salt', SALT_LENGTH_BYTES], ['hash', KEY_LENGTH_BITS / 8]]) {
    if (typeof config[field] !== 'string' || config[field].length !== 4 * Math.ceil(length / 3)) invalid();
    let bytes;
    try { bytes = fromBase64(config[field]); } catch { invalid(); }
    if (bytes.length !== length || toBase64(bytes) !== config[field]) invalid();
  }
  return config;
}

export function validateNewPassword(password) {
  if (typeof password !== 'string' || password.length > 1024 || !password.trim()) {
    throw new Error('Use a six-digit or longer PIN, or a password with at least eight characters.');
  }
  const minimum = /^\d+$/.test(password) ? 6 : 8;
  if (password.length < minimum) {
    throw new Error('Use a six-digit or longer PIN, or a password with at least eight characters.');
  }
}

export async function verifyPassword(password, config) {
  if (config == null) return false;
  validateVerifier(config);
  if (typeof password !== 'string' || password.length > 1024) return false;
  const candidateHash = await deriveHash(password, fromBase64(config.salt), config.iterations);
  return constantTimeEqual(candidateHash, config.hash);
}
