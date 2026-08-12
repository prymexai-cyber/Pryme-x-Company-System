const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Group = require('../models/Group');
const { requireAuth } = require('../middleware/auth');
const { requireCEO } = require('../middleware/rbac');
const { sendInviteEmail } = require('../utils/mailer');

const router = express.Router();

// GET /api/users — list all staff (everyone authenticated can see the directory)
router.get('/', requireAuth, async (req, res) => {
  const users = await User.find().sort({ createdAt: 1 });
  res.json({ users: users.map((u) => u.toSafeJSON()) });
});

// POST /api/users/invite — CEO only
router.post('/invite', requireAuth, requireCEO, async (req, res) => {
  try {
    const { username, email, tempPassword, accessLevel, jobPosition, description } = req.body;

    if (!username || !email || !tempPassword || !accessLevel) {
      return res.status(400).json({ error: 'username, email, tempPassword and accessLevel are required.' });
    }
    if (!['FULL', 'PREVIEW'].includes(accessLevel)) {
      return res.status(400).json({ error: 'accessLevel must be FULL or PREVIEW.' });
    }
    if (tempPassword.length < 8) {
      return res.status(400).json({ error: 'Temporary password must be at least 8 characters.' });
    }

    const existing = await User.findOne({ $or: [{ username }, { email: email.toLowerCase() }] });
    if (existing) {
      return res.status(409).json({ error: 'A user with that username or email already exists.' });
    }

    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const newUser = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: 'STAFF',
      accessLevel,
      jobPosition: jobPosition || 'Team Member',
      description: description || '',
      mustChangePassword: true,
      invitedBy: req.user._id,
    });

    // Add the new staff member to the company-wide "General" channel automatically.
    await Group.updateOne({ isGeneral: true }, { $addToSet: { members: newUser._id } });

    const loginUrl = `${process.env.CLIENT_URL || ''}/login.html`;

    try {
      await sendInviteEmail({
        to: newUser.email,
        username: newUser.username,
        tempPassword,
        jobPosition: newUser.jobPosition,
        accessLevel: newUser.accessLevel,
        loginUrl,
      });
    } catch (mailErr) {
      console.error('[Invite] Email send failed:', mailErr.message);
      return res.status(201).json({
        user: newUser.toSafeJSON(),
        warning: 'User created, but the invitation email failed to send. Verify GMAIL_USER / GMAIL_APP_PASSWORD.',
      });
    }

    res.status(201).json({ user: newUser.toSafeJSON(), emailSent: true });
  } catch (err) {
    console.error('[Users] invite error:', err);
    res.status(500).json({ error: 'Server error while inviting user.' });
  }
});

// PATCH /api/users/:id/access — CEO only: change a staff member's access level
router.patch('/:id/access', requireAuth, requireCEO, async (req, res) => {
  const { accessLevel } = req.body;
  if (!['FULL', 'PREVIEW'].includes(accessLevel)) {
    return res.status(400).json({ error: 'accessLevel must be FULL or PREVIEW.' });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (user.role === 'CEO') return res.status(400).json({ error: 'Cannot modify a CEO & Founder account.' });

  user.accessLevel = accessLevel;
  await user.save();
  res.json({ user: user.toSafeJSON() });
});

// DELETE /api/users/:id — CEO only: revoke a staff member
router.delete('/:id', requireAuth, requireCEO, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (user.role === 'CEO') return res.status(400).json({ error: 'Cannot delete a CEO & Founder account.' });

  await Group.updateMany({}, { $pull: { members: user._id } });
  await user.deleteOne();
  res.json({ ok: true });
});

// PATCH /api/users/me/profile — any authenticated user customizes their own profile
router.patch('/me/profile', requireAuth, async (req, res) => {
  const { jobPosition, description, avatarColor } = req.body;

  // CEO title is protected — always "CEO & Founder", never editable away from it.
  if (jobPosition !== undefined && req.user.role !== 'CEO') {
    req.user.jobPosition = String(jobPosition).slice(0, 80);
  }
  if (description !== undefined) {
    req.user.description = String(description).slice(0, 500);
  }
  if (avatarColor !== undefined) {
    req.user.avatarColor = String(avatarColor).slice(0, 20);
  }

  await req.user.save();
  res.json({ user: req.user.toSafeJSON() });
});

module.exports = router;
