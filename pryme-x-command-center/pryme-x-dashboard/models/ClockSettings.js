const mongoose = require('mongoose');

const ClockEntrySchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    timezone: { type: String, required: true }, // IANA tz, e.g. "Asia/Colombo"
    flag: { type: String, default: '🌐' },
  },
  { _id: false }
);

const DEFAULT_CLOCKS = [
  { label: 'Sri Lanka (HQ)', timezone: 'Asia/Colombo', flag: '🇱🇰' },
  { label: 'United States (NY)', timezone: 'America/New_York', flag: '🇺🇸' },
  { label: 'United Kingdom', timezone: 'Europe/London', flag: '🇬🇧' },
  { label: 'United Arab Emirates', timezone: 'Asia/Dubai', flag: '🇦🇪' },
  { label: 'Singapore', timezone: 'Asia/Singapore', flag: '🇸🇬' },
  { label: 'Japan', timezone: 'Asia/Tokyo', flag: '🇯🇵' },
  { label: 'Australia (Sydney)', timezone: 'Australia/Sydney', flag: '🇦🇺' },
  { label: 'Germany', timezone: 'Europe/Berlin', flag: '🇩🇪' },
  { label: 'India', timezone: 'Asia/Kolkata', flag: '🇮🇳' },
  { label: 'South Africa', timezone: 'Africa/Johannesburg', flag: '🇿🇦' },
];

const ClockSettingsSchema = new mongoose.Schema(
  {
    clocks: { type: [ClockEntrySchema], default: DEFAULT_CLOCKS },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

ClockSettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({ clocks: DEFAULT_CLOCKS });
  }
  return doc;
};

module.exports = mongoose.model('ClockSettings', ClockSettingsSchema);
module.exports.DEFAULT_CLOCKS = DEFAULT_CLOCKS;
