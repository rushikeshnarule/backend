const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function generateContent(prompt) {
  const response = await axios.post(
    `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
    }
  );
  return response.data.candidates[0]?.content?.parts[0]?.text || '';
}

// Middleware to require auth and get user
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'No token' });
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Blog Writing
router.post('/blog', requireAuth, async (req, res) => {
  const { topic, model = 'gemini' } = req.body;
  try {
    // Check quota
    const user = await User.findById(req.userId);
    const usage = user.apiUsage?.get(model) || 0;
    const quota = user.apiQuota?.get(model) || 1000;
    if (usage >= quota) {
      return res.status(403).json({ message: `Quota reached for ${model}` });
    }
    const prompt = `Write a detailed blog post about: ${topic}`;
    const content = await generateContent(prompt);
    // Save to user
    await User.findByIdAndUpdate(req.userId, {
      $push: { generatedContent: { type: 'blog', topic, content } },
      $inc: { [`apiUsage.${model}`]: 1 }
    });
    res.json({ content, usage: usage + 1, quota });
  } catch (err) {
    res.status(500).json({ message: 'Gemini API error', error: err.message });
  }
});

// LinkedIn Post
router.post('/linkedin', requireAuth, async (req, res) => {
  const { topic } = req.body;
  try {
    const prompt = `Write a professional LinkedIn post about: ${topic}`;
    const content = await generateContent(prompt);
    await User.findByIdAndUpdate(req.userId, {
      $push: { generatedContent: { type: 'linkedin', topic, content } }
    });
    res.json({ content });
  } catch (err) {
    res.status(500).json({ message: 'Gemini API error', error: err.message });
  }
});

// YouTube Title, Description, Hashtags, Captions
router.post('/youtube', requireAuth, async (req, res) => {
  const { topic } = req.body;
  try {
    const prompt = `Generate a YouTube video title, description, hashtags, and captions for: ${topic}`;
    const content = await generateContent(prompt);
    await User.findByIdAndUpdate(req.userId, {
      $push: { generatedContent: { type: 'youtube', topic, content } }
    });
    res.json({ content });
  } catch (err) {
    res.status(500).json({ message: 'Gemini API error', error: err.message });
  }
});

// Tweet
router.post('/tweet', requireAuth, async (req, res) => {
  const { topic } = req.body;
  try {
    const prompt = `Write a creative tweet about: ${topic}`;
    const content = await generateContent(prompt);
    await User.findByIdAndUpdate(req.userId, {
      $push: { generatedContent: { type: 'tweet', topic, content } }
    });
    res.json({ content });
  } catch (err) {
    res.status(500).json({ message: 'Gemini API error', error: err.message });
  }
});

module.exports = router; 