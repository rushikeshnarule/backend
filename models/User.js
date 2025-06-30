const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // hashed
  isAdmin: { type: Boolean, default: false },
  stripeCustomerId: { type: String },
  subscriptionStatus: { type: String, default: 'inactive' },
  createdAt: { type: Date, default: Date.now },
  generatedContent: [
    {
      type: { type: String }, // blog, linkedin, youtube, tweet, linkedin-post
      topic: String,
      content: String,
      createdAt: { type: Date, default: Date.now },
      linkedinPostId: String, // For LinkedIn posts
      imageData: String // For generated images
    }
  ],
  apiKeys: {
    type: Map,
    of: String, // e.g., { gemini: '...', gpt4: '...' }
    default: {},
  },
  enabledModels: {
    type: [String], // e.g., ['gemini', 'gpt-4']
    default: ['gemini'],
  },
  apiUsage: {
    type: Map,
    of: Number, // e.g., { gemini: 12, gpt4: 5 }
    default: {},
  },
  apiQuota: {
    type: Map,
    of: Number, // e.g., { gemini: 1000, gpt4: 500 }
    default: {},
  },
  // LinkedIn integration fields
  linkedin: {
    accessToken: String,
    expiresAt: Date,
    profileId: String,
    profileName: String,
    connected: { type: Boolean, default: false }
  },
  // Twitter integration fields
  twitter: {
    accessToken: String,
    refreshToken: String,
    expiresAt: Date,
    connected: { type: Boolean, default: false }
  }
});

module.exports = mongoose.model('User', userSchema); 