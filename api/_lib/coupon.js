const { getDb } = require('./db');

/**
 * Adds a new coupon code to the database.
 * @param {string} code - The coupon code to add.
 * @returns {{ success: boolean, reason?: string }}
 */
async function addCoupon(code) {
  const db = await getDb();
  const couponsColl = db.collection('coupons');

  const normalizedCode = code.toUpperCase().trim();

  // Check if coupon already exists
  const existing = await couponsColl.findOne({ code: normalizedCode });
  if (existing) {
    return { success: false, reason: 'already_exists' };
  }

  await couponsColl.insertOne({
    code: normalizedCode,
    used: false,
    createdAt: new Date(),
    redeemedBy: null,
    redeemedAt: null
  });

  return { success: true };
}

/**
 * Atomically validates and redeems a coupon code.
 * Uses findOneAndUpdate to prevent race conditions.
 * @param {string} code - The coupon code to redeem.
 * @param {string} telegramId - The Telegram ID of the user redeeming.
 * @returns {{ success: boolean, reason?: string, coupon?: object }}
 */
async function redeemCoupon(code, telegramId) {
  const db = await getDb();
  const couponsColl = db.collection('coupons');

  const normalizedCode = code.toUpperCase().trim();

  // Atomic findOneAndUpdate — only matches if code exists AND used is false
  const result = await couponsColl.findOneAndUpdate(
    { code: normalizedCode, used: false },
    {
      $set: {
        used: true,
        redeemedBy: telegramId,
        redeemedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    // Determine if the code exists but was already used, or doesn't exist at all
    const exists = await couponsColl.findOne({ code: normalizedCode });
    if (exists) {
      return { success: false, reason: 'already_used' };
    }
    return { success: false, reason: 'invalid' };
  }

  return { success: true, coupon: result };
}

/**
 * Lists all coupons in the database.
 * @returns {Array} Array of coupon documents.
 */
async function listCoupons() {
  const db = await getDb();
  const couponsColl = db.collection('coupons');

  return await couponsColl.find({}).sort({ createdAt: -1 }).toArray();
}

module.exports = { addCoupon, redeemCoupon, listCoupons };
