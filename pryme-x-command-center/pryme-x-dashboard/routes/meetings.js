const express = require('express');
const crypto = require('crypto');
const Meeting = require('../models/Meeting');
const { requireAuth } = require('../middleware/auth');
const { requireFullAccess } = require('../middleware/rbac');

const router = express.Router();

// GET /api/meetings/active — the currently live meeting, if any
router.get('/active', requireAuth, async (req, res) => {
  const meeting = await Meeting.findOne({ active: true }).populate('startedBy', 'username jobPosition');
  res.json({ meeting });
});

// POST /api/meetings/start — Full Access only
router.post('/start', requireAuth, requireFullAccess, async (req, res) => {
  const existing = await Meeting.findOne({ active: true });
  if (existing) {
    return res.status(409).json({ error: 'A meeting is already live.', meeting: existing });
  }

  const roomId = crypto.randomBytes(8).toString('hex');
  const meeting = await Meeting.create({
    roomId,
    title: req.body.title || 'Executive Meeting',
    startedBy: req.user._id,
    participants: [req.user._id],
  });

  const populated = await meeting.populate('startedBy', 'username jobPosition');

  // Every online, authorized staff member is notified automatically — no meeting ID needed.
  req.app.get('io').emit('meeting:started', populated);

  res.status(201).json({ meeting: populated });
});

// POST /api/meetings/:id/end — Full Access only (or the meeting starter)
router.post('/:id/end', requireAuth, requireFullAccess, async (req, res) => {
  const meeting = await Meeting.findById(req.params.id);
  if (!meeting || !meeting.active) return res.status(404).json({ error: 'No active meeting found.' });

  meeting.active = false;
  meeting.endedAt = new Date();
  await meeting.save();

  req.app.get('io').emit('meeting:ended', { roomId: meeting.roomId });
  res.json({ ok: true });
});

module.exports = router;
