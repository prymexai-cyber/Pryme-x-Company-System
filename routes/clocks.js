const express = require('express');
const ClockSettings = require('../models/ClockSettings');
const { requireAuth } = require('../middleware/auth');
const { requireFullAccess } = require('../middleware/rbac');

const router = express.Router();

// GET /api/clocks — everyone authenticated can view
router.get('/', requireAuth, async (req, res) => {
  const settings = await ClockSettings.getSingleton();
  res.json({ settings });
});

// PUT /api/clocks — Full Access only: replace the list of 10 world clocks
router.put('/', requireAuth, requireFullAccess, async (req, res) => {
  const { clocks } = req.body;
  if (!Array.isArray(clocks) || clocks.length === 0) {
    return res.status(400).json({ error: 'clocks must be a non-empty array of { label, timezone, flag }.' });
  }
  if (clocks.length > 12) {
    return res.status(400).json({ error: 'Maximum of 12 clocks.' });
  }

  const settings = await ClockSettings.getSingleton();
  settings.clocks = clocks.map((c) => ({
    label: String(c.label).slice(0, 60),
    timezone: String(c.timezone),
    flag: c.flag ? String(c.flag).slice(0, 8) : '🌐',
  }));
  settings.updatedBy = req.user._id;
  await settings.save();

  req.app.get('io').emit('clocks:update', settings);

  res.json({ settings });
});

module.exports = router;
