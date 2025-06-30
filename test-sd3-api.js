const axios = require('axios');

// Test SD3 API with the provided key
async function testSD3API() {
  const apiKey = 'sk-X5eiJOErzeRySSpED9z5gFIhF4ld2rS12PpWvz9cP32Xn5U5';
  
  console.log('Testing Stability AI API...');
  console.log('API Key:', apiKey.substring(0, 10) + '...');
  
  try {
    // First, let's check what engines are available
    console.log('\n🔍 Checking available engines...');
    const enginesResponse = await axios.get(
      'https://api.stability.ai/v1/engines/list',
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('✅ Available engines:');
    enginesResponse.data.engines.forEach(engine => {
      console.log(`  - ${engine.id} (${engine.name})`);
    });
    
    // Find SD3 engine
    const sd3Engine = enginesResponse.data.engines.find(engine => 
      engine.id.includes('sd3') || engine.id.includes('stable-diffusion-v3') || engine.name.toLowerCase().includes('sd3')
    );
    
    if (!sd3Engine) {
      console.log('\n❌ No SD3 engine found. Available engines:');
      enginesResponse.data.engines.forEach(engine => {
        console.log(`  - ${engine.id}: ${engine.name}`);
      });
      return;
    }
    
    console.log(`\n🎯 Using engine: ${sd3Engine.id} (${sd3Engine.name})`);
    
    // Test image generation with the correct engine
    console.log('\n🖼️ Testing image generation...');
    const response = await axios.post(
      `https://api.stability.ai/v1/generation/${sd3Engine.id}/text-to-image`,
      {
        text_prompts: [
          {
            text: 'a beautiful sunset over mountains',
            weight: 1
          }
        ],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        samples: 1,
        steps: 30,
        style_preset: "photographic"
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 120000
      }
    );
    
    console.log('✅ Image generation successful!');
    console.log('Response status:', response.status);
    console.log('Response data keys:', Object.keys(response.data));
    
    if (response.data.artifacts && response.data.artifacts[0]) {
      console.log('✅ Image generated successfully!');
      console.log('Image data length:', response.data.artifacts[0].base64?.length || 'N/A');
      console.log('✅ SD3 API integration is working correctly!');
    } else {
      console.log('❌ No image data in response');
      console.log('Response data:', JSON.stringify(response.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ API test failed:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.error('🔑 API key appears to be invalid or expired');
    } else if (error.response?.status === 403) {
      console.error('🚫 Access denied - check your account permissions');
    } else if (error.response?.status === 429) {
      console.error('⏰ Rate limit exceeded');
    } else if (error.response?.status === 404) {
      console.error('🔍 Resource not found - check the engine ID');
    }
  }
}

// Run the test
testSD3API(); 