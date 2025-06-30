const express = require('express');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const FeatureToggle = require('../models/FeatureToggle');

const router = express.Router();

// Middleware to check admin
function adminOnly(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'No token' });
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isAdmin) return res.status(403).json({ message: 'Admins only' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Middleware to require admin
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'No token' });
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isAdmin) return res.status(403).json({ message: 'Not admin' });
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Get all users
router.get('/users', adminOnly, async (req, res) => {
  const users = await User.find().select('-password');
  res.json(users);
});

// Update user (make admin, change subscription)
router.put('/users/:id', adminOnly, async (req, res) => {
  const { isAdmin, subscriptionStatus } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isAdmin, subscriptionStatus },
    { new: true }
  ).select('-password');
  res.json(user);
});

// Delete user
router.delete('/users/:id', adminOnly, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: 'User deleted' });
});

// Get all feature toggles
router.get('/features', requireAdmin, async (req, res) => {
  const features = await FeatureToggle.find();
  res.json(features);
});

// Update a feature toggle
router.post('/toggle-feature', requireAdmin, async (req, res) => {
  const { feature, enabled } = req.body;
  const updated = await FeatureToggle.findOneAndUpdate(
    { feature },
    { enabled },
    { upsert: true, new: true }
  );
  res.json(updated);
});

// Get a user's API keys and enabled models
router.get('/users/:id/ai-settings', adminOnly, async (req, res) => {
  const user = await User.findById(req.params.id).select('apiKeys enabledModels email');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ apiKeys: user.apiKeys, enabledModels: user.enabledModels, email: user.email });
});

// Update a user's API keys and enabled models
router.put('/users/:id/ai-settings', adminOnly, async (req, res) => {
  const { apiKeys, enabledModels } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { apiKeys, enabledModels },
    { new: true }
  ).select('apiKeys enabledModels email');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ apiKeys: user.apiKeys, enabledModels: user.enabledModels, email: user.email });
});

module.exports = router; 