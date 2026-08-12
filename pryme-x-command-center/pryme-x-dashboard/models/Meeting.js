const mongoose = require('mongoose');

const MeetingSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true },
    title: { type: String, default: 'Executive Meeting' },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    active: { type: Boolean, default: true },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Meeting', MeetingSchema);
