const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['CEO', 'STAFF'],
      default: 'STAFF',
    },
    accessLevel: {
      type: String,
      enum: ['FULL', 'PREVIEW'],
      default: 'PREVIEW',
    },
    jobPosition: {
      type: String,
      default: 'Team Member',
    },
    description: {
      type: String,
      default: '',
      maxlength: 500,
    },
    avatarColor: {
      type: String,
      default: '#c9a44c', // metallic gold default
    },
    mustChangePassword: {
      type: Boolean,
      default: true, // invited users must rotate temp password on first login
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

UserSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    role: this.role,
    accessLevel: this.accessLevel,
    jobPosition: this.jobPosition,
    description: this.description,
    avatarColor: this.avatarColor,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
    mustChangePassword: this.mustChangePassword,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', UserSchema);
