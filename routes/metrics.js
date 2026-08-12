const express = require('express');
const Metrics = require('../models/Metrics');
const { requireAuth } = require('../middleware/auth');
const { requireFullAccess } = require('../middleware/rbac');

const router = express.Router();

// GET /api/metrics — everyone authenticated can view
router.get('/', requireAuth, async (req, res) => {
  const metrics = await Metrics.getSingleton();
  res.json({ metrics });
});

// PATCH /api/metrics — Full Access only
router.patch('/', requireAuth, requireFullAccess, async (req, res) => {
  const { completedProjects, activeProjects, failedProjects } = req.body;
  const metrics = await Metrics.getSingleton();

  if (completedProjects !== undefined) metrics.completedProjects = Math.max(0, parseInt(completedProjects, 10) || 0);
  if (activeProjects !== undefined) metrics.activeProjects = Math.max(0, parseInt(activeProjects, 10) || 0);
  if (failedProjects !== undefined) metrics.failedProjects = Math.max(0, parseInt(failedProjects, 10) || 0);
  metrics.updatedBy = req.user._id;

  await metrics.save();

  // Broadcast live update to every connected client.
  req.app.get('io').emit('metrics:update', metrics);

  res.json({ metrics });
});

module.exports = router;
