const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Group = require('../models/Group');
const Message = require('../models/Message');
const Meeting = require('../models/Meeting');

// userId -> Set of socket ids (a user can have multiple tabs/devices open)
const onlineUsers = new Map();

function initSockets(io) {
  // --- Socket auth middleware: every connection must present a valid JWT ---
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No auth token provided.'));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub);
      if (!user) return next(new Error('User not found.'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed.'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();

    // --- Presence tracking ---
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
    io.emit('presence:update', { userId, isOnline: true });
    socket.emit('presence:list', Array.from(onlineUsers.keys()));

    // Join a personal room (for direct notifications) and every group room they belong to.
    socket.join(`user:${userId}`);
    const groups = await Group.find({ members: userId }).select('_id');
    groups.forEach((g) => socket.join(`group:${g._id}`));

    // --- Chat: send message ---
    socket.on('chat:send', async ({ groupId, content }, ack) => {
      try {
        if (!content || !content.trim()) return ack?.({ error: 'Empty message.' });

        const group = await Group.findById(groupId);
        if (!group || !group.members.some((m) => m.toString() === userId)) {
          return ack?.({ error: 'Not a member of this group.' });
        }

        const message = await Message.create({ group: groupId, sender: userId, content: content.trim() });
        const populated = await message.populate('sender', 'username avatarColor');

        io.to(`group:${groupId}`).emit('chat:message', populated);
        ack?.({ ok: true, message: populated });
      } catch (err) {
        console.error('[Socket] chat:send error:', err);
        ack?.({ error: 'Failed to send message.' });
      }
    });

    // --- Chat: create group (Full Access / CEO only) ---
    socket.on('chat:createGroup', async ({ name, description, memberIds }, ack) => {
      try {
        const isAuthorized = socket.user.role === 'CEO' || socket.user.accessLevel === 'FULL';
        if (!isAuthorized) return ack?.({ error: 'Full Access is required to create groups.' });
        if (!name) return ack?.({ error: 'Group name is required.' });

        const members = new Set([userId, ...(memberIds || [])]);
        const group = await Group.create({ name, description: description || '', members: Array.from(members), createdBy: userId });
        const populated = await group.populate('members', 'username jobPosition avatarColor isOnline');

        Array.from(members).forEach((mId) => {
          io.to(`user:${mId}`).emit('chat:groupCreated', populated);
          // pull that member's sockets into the room live
          const sockets = onlineUsers.get(mId);
          if (sockets) {
            sockets.forEach((sid) => io.sockets.sockets.get(sid)?.join(`group:${group._id}`));
          }
        });

        ack?.({ ok: true, group: populated });
      } catch (err) {
        console.error('[Socket] chat:createGroup error:', err);
        ack?.({ error: 'Failed to create group.' });
      }
    });

    // --- Typing indicator ---
    socket.on('chat:typing', ({ groupId }) => {
      socket.to(`group:${groupId}`).emit('chat:typing', { userId, username: socket.user.username });
    });

    // --- WebRTC signaling (mesh topology, small executive teams) ---
    socket.on('webrtc:join', async ({ roomId }) => {
      socket.join(`room:${roomId}`);
      socket.to(`room:${roomId}`).emit('webrtc:peer-joined', { socketId: socket.id, userId, username: socket.user.username });

      const meeting = await Meeting.findOne({ roomId, active: true });
      if (meeting && !meeting.participants.some((p) => p.toString() === userId)) {
        meeting.participants.push(userId);
        await meeting.save();
      }
    });

    socket.on('webrtc:signal', ({ to, data }) => {
      io.to(to).emit('webrtc:signal', { from: socket.id, data });
    });

    socket.on('webrtc:leave', ({ roomId }) => {
      socket.leave(`room:${roomId}`);
      socket.to(`room:${roomId}`).emit('webrtc:peer-left', { socketId: socket.id });
    });

    // --- Disconnect: update presence once ALL of a user's sockets are gone ---
    socket.on('disconnect', async () => {
      const set = onlineUsers.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          onlineUsers.delete(userId);
          await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
          io.emit('presence:update', { userId, isOnline: false });
        }
      }
    });
  });
}

module.exports = initSockets;
