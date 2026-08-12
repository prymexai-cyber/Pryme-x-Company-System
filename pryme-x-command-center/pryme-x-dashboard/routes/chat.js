const express = require('express');
const Group = require('../models/Group');
const Message = require('../models/Message');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { requireFullAccess } = require('../middleware/rbac');

const router = express.Router();

// GET /api/chat/groups — groups the current user belongs to
router.get('/groups', requireAuth, async (req, res) => {
  const groups = await Group.find({ members: req.user._id })
    .populate('members', 'username jobPosition avatarColor isOnline')
    .sort({ updatedAt: -1 });
  res.json({ groups });
});

// POST /api/chat/groups — Full Access users only
router.post('/groups', requireAuth, requireFullAccess, async (req, res) => {
  const { name, description, memberIds } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name is required.' });

  const members = new Set([req.user._id.toString(), ...(memberIds || [])]);
  const group = await Group.create({
    name,
    description: description || '',
    members: Array.from(members),
    createdBy: req.user._id,
  });

  const populated = await group.populate('members', 'username jobPosition avatarColor isOnline');
  res.status(201).json({ group: populated });
});

// POST /api/chat/groups/:id/join — any authenticated user can join an open group
router.post('/groups/:id/join', requireAuth, async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });

  await Group.updateOne({ _id: group._id }, { $addToSet: { members: req.user._id } });
  res.json({ ok: true });
});

// POST /api/chat/groups/:id/leave — ONLY Full Access users and CEOs may leave a group.
// Preview Only members are locked in once added and must be removed by a Full Access
// member, the CEO, or via Staff Management.
router.post('/groups/:id/leave', requireAuth, requireFullAccess, async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (group.isGeneral) return res.status(400).json({ error: 'You cannot leave the General company channel.' });

  await Group.updateOne({ _id: group._id }, { $pull: { members: req.user._id } });
  res.json({ ok: true });
});

// DELETE /api/chat/groups/:id — Full Access / CEO only. General channel is protected.
router.delete('/groups/:id', requireAuth, requireFullAccess, async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (group.isGeneral) return res.status(400).json({ error: 'The General company channel cannot be deleted.' });

  await Message.deleteMany({ group: group._id });
  await group.deleteOne();

  req.app.get('io').to(`group:${group._id}`).emit('chat:groupDeleted', { groupId: group._id.toString() });
  res.json({ ok: true });
});

// GET /api/chat/groups/:id/messages — message history (paginated)
router.get('/groups/:id/messages', requireAuth, async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (!group.members.some((m) => m.toString() === req.user._id.toString())) {
    return res.status(403).json({ error: 'You are not a member of this group.' });
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const messages = await Message.find({ group: group._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'username avatarColor')
    .lean();

  res.json({ messages: messages.reverse() });
});

module.exports = router;
