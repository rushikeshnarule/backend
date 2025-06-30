const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// LinkedIn OAuth Configuration
const LINKEDIN_CONFIG = {
  clientId: '7758njncq2tz2z',
  clientSecret: 'WPL_AP1.YbcEwWD3yfUdOCje.LgRicw==',
  redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/auth/linkedin/callback',
  authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  scope: 'w_member_social r_liteprofile r_emailaddress'
};

// Middleware to require auth
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

// Generate LinkedIn OAuth URL
router.get('/auth-url', requireAuth, (req, res) => {
  const state = Math.random().toString(36).substring(7);
  const authUrl = `${LINKEDIN_CONFIG.authUrl}?` +
    `response_type=code&` +
    `client_id=${LINKEDIN_CONFIG.clientId}&` +
    `redirect_uri=${encodeURIComponent(LINKEDIN_CONFIG.redirectUri)}&` +
    `scope=${encodeURIComponent(LINKEDIN_CONFIG.scope)}&` +
    `state=${state}`;
  
  res.json({ authUrl, state });
});

// LinkedIn OAuth callback
router.get('/callback', requireAuth, async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).json({ message: 'Authorization code not provided' });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(LINKEDIN_CONFIG.tokenUrl, 
      `grant_type=authorization_code&` +
      `code=${code}&` +
      `redirect_uri=${encodeURIComponent(LINKEDIN_CONFIG.redirectUri)}&` +
      `client_id=${LINKEDIN_CONFIG.clientId}&` +
      `client_secret=${LINKEDIN_CONFIG.clientSecret}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, expires_in } = tokenResponse.data;

    // Get user profile to verify connection
    const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    const linkedinProfile = profileResponse.data;

    // Store LinkedIn credentials in user document
    await User.findByIdAndUpdate(req.userId, {
      $set: {
        'linkedin.accessToken': access_token,
        'linkedin.expiresAt': new Date(Date.now() + expires_in * 1000),
        'linkedin.profileId': linkedinProfile.id,
        'linkedin.profileName': `${linkedinProfile.localizedFirstName} ${linkedinProfile.localizedLastName}`,
        'linkedin.connected': true
      }
    });

    res.json({ 
      success: true, 
      message: 'LinkedIn connected successfully',
      profile: {
        id: linkedinProfile.id,
        name: `${linkedinProfile.localizedFirstName} ${linkedinProfile.localizedLastName}`
      }
    });

  } catch (error) {
    console.error('LinkedIn OAuth error:', error.response?.data || error.message);
    res.status(500).json({ 
      message: 'Failed to connect LinkedIn',
      error: error.response?.data || error.message 
    });
  }
});

// Disconnect LinkedIn
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      $unset: {
        'linkedin.accessToken': 1,
        'linkedin.expiresAt': 1,
        'linkedin.profileId': 1,
        'linkedin.profileName': 1,
        'linkedin.connected': 1
      }
    });

    res.json({ success: true, message: 'LinkedIn disconnected successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to disconnect LinkedIn' });
  }
});

// Get LinkedIn connection status
router.get('/status', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const linkedinData = user.linkedin || {};
    
    // Check if token is expired
    if (linkedinData.expiresAt && new Date() > linkedinData.expiresAt) {
      await User.findByIdAndUpdate(req.userId, {
        $unset: {
          'linkedin.accessToken': 1,
          'linkedin.expiresAt': 1,
          'linkedin.connected': 1
        }
      });
      linkedinData.connected = false;
    }

    res.json({
      connected: linkedinData.connected || false,
      profileName: linkedinData.profileName,
      profileId: linkedinData.profileId
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get LinkedIn status' });
  }
});

// Post content to LinkedIn
router.post('/post', requireAuth, async (req, res) => {
  const { content, imageData } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.linkedin?.connected || !user.linkedin?.accessToken) {
      return res.status(400).json({ message: 'LinkedIn not connected' });
    }

    // Check if token is expired
    if (user.linkedin.expiresAt && new Date() > user.linkedin.expiresAt) {
      return res.status(400).json({ message: 'LinkedIn token expired. Please reconnect.' });
    }

    let postData = {
      author: `urn:li:person:${user.linkedin.profileId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    // If image is provided, add it to the post
    if (imageData) {
      // First, register the image upload
      const registerUploadResponse = await axios.post(
        'https://api.linkedin.com/v2/assets?action=registerUpload',
        {
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: `urn:li:person:${user.linkedin.profileId}`,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent'
              }
            ]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${user.linkedin.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'Content-Type': 'application/json'
          }
        }
      );

      const { uploadUrl, asset } = registerUploadResponse.data.value;

      // Upload the image
      const imageBuffer = Buffer.from(imageData, 'base64');
      await axios.post(uploadUrl, imageBuffer, {
        headers: {
          'Authorization': `Bearer ${user.linkedin.accessToken}`,
          'Content-Type': 'application/octet-stream'
        }
      });

      // Update post data to include the image
      postData.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
      postData.specificContent['com.linkedin.ugc.ShareContent'].media = [
        {
          status: 'READY',
          description: {
            text: 'Generated image'
          },
          media: asset,
          title: {
            text: 'Generated content'
          }
        }
      ];
    }

    // Create the post
    const postResponse = await axios.post(
      'https://api.linkedin.com/v2/ugcPosts',
      postData,
      {
        headers: {
          'Authorization': `Bearer ${user.linkedin.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json'
        }
      }
    );

    // Save the post to user's generated content
    await User.findByIdAndUpdate(req.userId, {
      $push: {
        generatedContent: {
          type: 'linkedin-post',
          topic: content.substring(0, 100) + '...',
          content: content,
          linkedinPostId: postResponse.data.id,
          createdAt: new Date()
        }
      }
    });

    res.json({
      success: true,
      message: 'Content posted to LinkedIn successfully',
      postId: postResponse.data.id
    });

  } catch (error) {
    console.error('LinkedIn posting error:', error.response?.data || error.message);
    res.status(500).json({
      message: 'Failed to post to LinkedIn',
      error: error.response?.data || error.message
    });
  }
});

module.exports = router; 