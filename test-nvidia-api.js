const axios = require('axios');

// Your NVIDIA API key
const API_KEY = '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';

// Test request
const testRequest = {
  text_prompts: [
    {
      text: "a simple red circle",
      weight: 1
    }
  ],
  cfg_scale: 7.5,
  sampler: "K_DPM_2_ANCESTRAL",
  seed: 12345,
  steps: 5,
  width: 512,
  height: 512
};

async function testNvidiaAPI() {
  try {
    console.log('Testing NVIDIA API...');
    console.log('API Key:', API_KEY.substring(0, 10) + '...');
    console.log('Request URL: https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-xl');
    
    const response = await axios.post(
      'https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-xl',
      testRequest,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );
    
    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Error:');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.response?.data || error.message);
    console.log('Headers:', error.response?.headers);
  }
}

testNvidiaAPI(); 