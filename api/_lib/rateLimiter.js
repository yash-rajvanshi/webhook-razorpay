// ─── Per-User Rate Limiter ────────────────────────────────────────────────────
// In-memory cooldown map: userId → last command timestamp (ms)
// Since this is serverless, the map resets on cold starts — acceptable for our use case.

const cooldowns = new Map();

const COOLDOWN_MS = 2000; // 2 seconds between any command per user

/**
 * Checks whether a user is allowed to run a command.
 * Returns true if allowed, false if rate-limited.
 * Also updates the last-seen timestamp on every allowed call.
 *
 * @param {number|string} userId - Telegram user ID
 * @returns {boolean}
 */
function rateLimit(userId) {
  const now = Date.now();
  const lastSeen = cooldowns.get(String(userId));

  if (lastSeen && (now - lastSeen) < COOLDOWN_MS) {
    return false; // Too soon — rate-limited
  }

  cooldowns.set(String(userId), now);
  return true; // Allowed
}

module.exports = { rateLimit, COOLDOWN_MS };
