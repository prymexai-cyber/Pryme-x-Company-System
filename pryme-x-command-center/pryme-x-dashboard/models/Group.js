const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isGeneral: { type: Boolean, default: false }, // default company-wide channel
  },
  { timestamps: true }
);

module.exports = mongoose.model('Group', GroupSchema);
