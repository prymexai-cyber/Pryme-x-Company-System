require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const Group = require('../models/Group');
const Metrics = require('../models/Metrics');
const ClockSettings = require('../models/ClockSettings');

async function upsertAdmin(username, password, email) {
  if (!username || !password || !email) {
    console.warn(`[Seed] Skipping admin — missing username/password/email in env for "${username}".`);
    return null;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.findOneAndUpdate(
    { username },
    {
      username,
      email: email.toLowerCase(),
      passwordHash,
      role: 'CEO',
      accessLevel: 'FULL',
      jobPosition: 'CEO & Founder',
      description: 'Founder & Chief Executive Officer, Pryme X AI Cyber Solutions.',
      mustChangePassword: false,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`[Seed] Master admin ready → ${user.username} (${user.email})`);
  return user;
}

async function run() {
  await connectDB();

  const admin1 = await upsertAdmin(
    process.env.ADMIN1_USERNAME,
    process.env.ADMIN1_PASSWORD,
    process.env.ADMIN1_EMAIL
  );
  const admin2 = await upsertAdmin(
    process.env.ADMIN2_USERNAME,
    process.env.ADMIN2_PASSWORD,
    process.env.ADMIN2_EMAIL
  );

  // Ensure the company-wide General channel exists and includes both admins.
  const founders = [admin1?._id, admin2?._id].filter(Boolean);
  let general = await Group.findOne({ isGeneral: true });
  if (!general) {
    general = await Group.create({
      name: 'General',
      description: 'Company-wide channel — Pryme X AI Cyber Solutions',
      members: founders,
      createdBy: founders[0],
      isGeneral: true,
    });
    console.log('[Seed] Created General company channel.');
  } else {
    await Group.updateOne({ _id: general._id }, { $addToSet: { members: { $each: founders } } });
    console.log('[Seed] General company channel already exists — admins ensured as members.');
  }

  await Metrics.getSingleton();
  await ClockSettings.getSingleton();
  console.log('[Seed] Metrics singleton and world clocks initialized.');

  console.log('[Seed] Done.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[Seed] Fatal error:', err);
  process.exit(1);
});
