const mongoose = require('mongoose');

const featureToggleSchema = new mongoose.Schema({
  feature: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
});

module.exports = mongoose.model('FeatureToggle', featureToggleSchema); 