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
    createdAt: Date.now()
  };
}

/**
 * Verify a candidate password against a stored verifier record.
 */
export async function verifyPassword(password, config) {
  if (!config || !config.salt || !config.hash) return false;
  const saltBytes = fromBase64(config.salt);
  const candidateHash = await deriveHash(password, saltBytes, config.iterations || PBKDF2_ITERATIONS);
  return constantTimeEqual(candidateHash, config.hash);
}
