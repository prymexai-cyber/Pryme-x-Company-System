const mongoose = require('mongoose');

// Singleton document — there is only ever one metrics record for the company.
const MetricsSchema = new mongoose.Schema(
  {
    completedProjects: { type: Number, default: 0, min: 0 },
    activeProjects: { type: Number, default: 0, min: 0 },
    failedProjects: { type: Number, default: 0, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

MetricsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({});
  }
  return doc;
};

module.exports = mongoose.model('Metrics', MetricsSchema);
