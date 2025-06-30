const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

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

// Main image generation function
async function generateImage(prompt, negativePrompt, model, size, style, apiKey) {
  try {
    switch (model) {
      case 'dall-e-3':
        return await generateDalleImage(prompt, size, apiKey);
      case 'midjourney':
        return await generateMidjourneyImage(prompt, apiKey);
      default:
        throw new Error(`Unsupported model: ${model}`);
    }
  } catch (error) {
    console.error(`Error generating image with ${model}:`, error);
    throw error;
  }
}

// DALL-E 3 implementation
async function generateDalleImage(prompt, size, apiKey) {
  const response = await axios.post(
    'https://api.openai.com/v1/images/generations',
    {
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: size,
      quality: 'standard',
      response_format: 'url'
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const imageUrl = response.data.data[0].url;
  const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  return imageResponse.data;
}

// Midjourney implementation (placeholder - you'll need to implement based on Midjourney's API)
async function generateMidjourneyImage(prompt, apiKey) {
  // This is a placeholder - Midjourney API implementation would go here
  throw new Error('Midjourney API not implemented yet');
}

// Main image generation endpoint
router.post('/generate-image', requireAuth, async (req, res) => {
  const { prompt, negativePrompt, model, size, style } = req.body;
  
  console.log('Image generation request:', { model, size, style, promptLength: prompt?.length });
  
  try {
    // Get user and check permissions
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('User found:', { userId: user._id, enabledModels: user.enabledModels });
    
    // Check if model is enabled for user
    if (!user.enabledModels?.includes(model)) {
      console.log('Model not enabled:', { model, enabledModels: user.enabledModels });
      return res.status(403).json({ 
        message: `Model ${model} is not enabled for this user`,
        enabledModels: user.enabledModels 
      });
    }
    
    // Get API key for the model
    let apiKey;
    
    // Handle both Map and object formats for apiKeys
    if (user.apiKeys instanceof Map) {
      apiKey = user.apiKeys.get(model);
    } else if (user.apiKeys && typeof user.apiKeys === 'object') {
      apiKey = user.apiKeys[model];
    } else {
      apiKey = null;
    }
    
    console.log('API key retrieval debug:', {
      model: model,
      apiKeysType: typeof user.apiKeys,
      isMap: user.apiKeys instanceof Map,
      isObject: typeof user.apiKeys === 'object',
      availableKeys: user.apiKeys instanceof Map ? Array.from(user.apiKeys.keys()) : Object.keys(user.apiKeys || {}),
      foundKey: apiKey ? 'Yes' : 'No'
    });
    
    if (!apiKey) {
      console.log('API key not found for model:', model);
      return res.status(400).json({ 
        message: `API key not found for model ${model}`,
        availableKeys: user.apiKeys instanceof Map ? Array.from(user.apiKeys.keys()) : Object.keys(user.apiKeys || {}),
        instructions: getApiKeyInstructions(model)
      });
    }
    
    console.log('API key found for model:', model);
    console.log('API key details:', {
      model: model,
      keyLength: apiKey.length,
      keyPrefix: apiKey.substring(0, 10),
      keySuffix: apiKey.substring(apiKey.length - 4),
      isString: typeof apiKey === 'string',
      hasNvapiPrefix: apiKey.startsWith('nvapi-')
    });
    
    // Check quota
    const usage = user.apiUsage?.get(model) || 0;
    const quota = user.apiQuota?.get(model) || 1000;
    if (usage >= quota) {
      return res.status(403).json({ message: `Quota reached for ${model}` });
    }
    
    console.log('Starting image generation with model:', model);
    
    let imageBuffer;
    let usedModel = model;
    
    try {
      // Try the requested model first
      imageBuffer = await generateImage(prompt, negativePrompt, model, size, style, apiKey);
    } catch (error) {
      console.log('Primary model failed, trying fallback:', error.message);
      
      // If NVIDIA model fails, try DALL-E 3 as fallback
      if (model.startsWith('nvidia-') && user.apiKeys?.get('dall-e-3')) {
        try {
          console.log('Trying DALL-E 3 as fallback');
          imageBuffer = await generateImage(prompt, negativePrompt, 'dall-e-3', size, style, user.apiKeys.get('dall-e-3'));
          usedModel = 'dall-e-3';
        } catch (fallbackError) {
          console.log('Fallback also failed:', fallbackError.message);
          throw error; // Throw the original error
        }
      } else {
        throw error;
      }
    }
    
    console.log('Image generated successfully, size:', imageBuffer.length);
    
    // Update usage for the model that was actually used
    await User.findByIdAndUpdate(req.userId, {
      $inc: { [`apiUsage.${usedModel}`]: 1 }
    });
    
    // Save to user's generated content
    await User.findByIdAndUpdate(req.userId, {
      $push: { 
        generatedContent: { 
          type: 'image', 
          topic: prompt, 
          content: `Generated image using ${usedModel}`,
          imageData: imageBuffer.toString('base64')
        } 
      }
    });
    
    // Set response headers for image
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'public, max-age=31536000'
    });
    
    res.send(imageBuffer);
    
  } catch (error) {
    console.error('Image generation error:', {
      error: error.message,
      stack: error.stack,
      model,
      userId: req.userId
    });
    
    // Provide more specific error messages
    let errorMessage = 'Failed to generate image';
    let errorDetails = 'Please check your API keys and model configuration';
    
    if (error.message.includes('Invalid NVIDIA API key')) {
      errorMessage = 'NVIDIA API Key Error';
      errorDetails = 'Please get your NGC API key from https://ngc.nvidia.com/setup/api-key and add it to the admin panel.';
    } else if (error.message.includes('NVIDIA API error')) {
      errorMessage = 'NVIDIA API Error';
      errorDetails = 'Please verify your NVIDIA API key and ensure the model is available in your NGC account.';
    } else if (error.message.includes('OpenAI')) {
      errorMessage = 'OpenAI API Error';
      errorDetails = 'Please verify your OpenAI API key and billing status.';
    } else if (error.message.includes('Stability AI')) {
      errorMessage = 'Stability AI API Error';
      errorDetails = 'Please verify your Stability AI API key.';
    } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      errorMessage = 'API Key Error';
      errorDetails = 'Invalid or expired API key. Please check your API key in the admin panel.';
    } else if (error.message.includes('429') || error.message.includes('Rate limit')) {
      errorMessage = 'Rate Limit Exceeded';
      errorDetails = 'You have exceeded the API rate limit. Please try again later.';
    }
    
    res.status(500).json({ 
      message: errorMessage, 
      error: error.message,
      details: errorDetails,
      model: model,
      help: getApiKeyInstructions(model)
    });
  }
});

// Test endpoint to verify NVIDIA API key
router.post('/test-nvidia-key', requireAuth, async (req, res) => {
  const { model = 'nvidia-sdxl' } = req.body;
  
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get API key
    let apiKey;
    if (user.apiKeys instanceof Map) {
      apiKey = user.apiKeys.get(model);
    } else if (user.apiKeys && typeof user.apiKeys === 'object') {
      apiKey = user.apiKeys[model];
    }
    
    if (!apiKey) {
      return res.status(400).json({ 
        message: `API key not found for model ${model}`,
        availableKeys: user.apiKeys instanceof Map ? Array.from(user.apiKeys.keys()) : Object.keys(user.apiKeys || {})
      });
    }
    
    // Test the API key with a simple request
    const testUrl = 'https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-xl';
    const testBody = {
      text_prompts: [
        {
          text: "a simple red circle",
          weight: 1
        }
      ],
      cfg_scale: 7.5,
      sampler: "K_DPM_2_ANCESTRAL",
      seed: 12345,
      steps: 5, // Use fewer steps for testing
      width: 512,
      height: 512
    };
    
    console.log('Testing NVIDIA API key...');
    console.log('API Key:', apiKey.substring(0, 10) + '...');
    
    const response = await axios.post(testUrl, testBody, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });
    
    res.json({
      success: true,
      message: 'NVIDIA API key is valid',
      status: response.status,
      responseData: response.data
    });
    
  } catch (error) {
    console.error('NVIDIA API key test failed:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    res.status(500).json({
      success: false,
      message: 'NVIDIA API key test failed',
      error: error.response?.data || error.message,
      status: error.response?.status
    });
  }
});

// Endpoint to list available Stability AI engines for the user's API key
router.get('/list-sd-engines', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Try both 'sd3' and 'stable-diffusion' keys for compatibility
    let apiKey = null;
    if (user.apiKeys instanceof Map) {
      apiKey = user.apiKeys.get('sd3') || user.apiKeys.get('stable-diffusion');
    } else if (user.apiKeys && typeof user.apiKeys === 'object') {
      apiKey = user.apiKeys['sd3'] || user.apiKeys['stable-diffusion'];
    }
    if (!apiKey) {
      return res.status(400).json({ message: 'No Stability AI API key found for sd3 or stable-diffusion' });
    }
    const response = await axios.get('https://api.stability.ai/v1/engines/list', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });
    res.json({ engines: response.data.engines });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to list Stability AI engines',
      error: error.response?.data || error.message
    });
  }
});

// Helper function to provide API key setup instructions
function getApiKeyInstructions(model) {
  const instructions = {
    'nvidia-sdxl': {
      title: 'NVIDIA NGC API Key Setup',
      steps: [
        '1. Go to https://ngc.nvidia.com/',
        '2. Sign up or log in to your NVIDIA account',
        '3. Navigate to "Setup" → "API Key"',
        '4. Generate a new API key',
        '5. Copy the key and paste it in the admin panel',
        '6. Ensure you have access to Stable Diffusion XL model'
      ],
      note: 'NVIDIA NGC account is required for accessing their models.'
    },
    'dall-e-3': {
      title: 'OpenAI API Key Setup',
      steps: [
        '1. Go to https://platform.openai.com/',
        '2. Sign up or log in to your OpenAI account',
        '3. Navigate to "API Keys" section',
        '4. Create a new API key',
        '5. Copy the key and paste it in the admin panel',
        '6. Ensure you have billing set up for image generation'
      ],
      note: 'OpenAI requires billing information for image generation.'
    },
    'sd3': {
      title: 'Stability AI API Key Setup',
      steps: [
        '1. Go to https://platform.stability.ai/',
        '2. Sign up or log in to your Stability AI account',
        '3. Navigate to "Account" → "API Keys"',
        '4. Generate a new API key',
        '5. Copy the key and paste it in the admin panel'
      ],
      note: 'Stability AI offers free credits for new users.'
    }
  };
  
  return instructions[model] || {
    title: 'API Key Setup',
    steps: ['Please check the provider\'s documentation for API key setup instructions.'],
    note: 'API keys are required for image generation services.'
  };
}

module.exports = router; 