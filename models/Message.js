const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 4000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', MessageSchema);
