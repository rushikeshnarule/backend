const axios = require('axios');

// Test LinkedIn API configuration
async function testLinkedInConfig() {
  console.log('🔍 Testing LinkedIn API Configuration...');
  
  const config = {
    clientId: '7758njncq2tz2z',
    clientSecret: 'WPL_AP1.YbcEwWD3yfUdOCje.LgRicw==',
    redirectUri: 'http://localhost:3000/auth/linkedin/callback',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scope: 'w_member_social r_liteprofile r_emailaddress'
  };

  console.log('✅ LinkedIn Configuration:');
  console.log('  - Client ID:', config.clientId);
  console.log('  - Client Secret:', config.clientSecret.substring(0, 10) + '...');
  console.log('  - Redirect URI:', config.redirectUri);
  console.log('  - Scope:', config.scope);
  
  // Test OAuth URL generation
  const state = Math.random().toString(36).substring(7);
  const authUrl = `${config.authUrl}?` +
    `response_type=code&` +
    `client_id=${config.clientId}&` +
    `redirect_uri=${encodeURIComponent(config.redirectUri)}&` +
    `scope=${encodeURIComponent(config.scope)}&` +
    `state=${state}`;
  
  console.log('\n🔗 Generated OAuth URL:');
  console.log(authUrl);
  
  console.log('\n📋 Next Steps:');
  console.log('1. Make sure your LinkedIn app is configured with the redirect URI:');
  console.log('   http://localhost:3000/auth/linkedin/callback');
  console.log('2. Ensure your app has the required permissions:');
  console.log('   - w_member_social (for posting)');
  console.log('   - r_liteprofile (for profile info)');
  console.log('   - r_emailaddress (for email)');
  console.log('3. Test the OAuth flow by visiting the generated URL');
  
  return config;
}

// Test LinkedIn API endpoints (if you have a valid access token)
async function testLinkedInAPI(accessToken) {
  if (!accessToken) {
    console.log('\n⚠️  No access token provided. Skipping API tests.');
    return;
  }

  console.log('\n🧪 Testing LinkedIn API endpoints...');
  
  try {
    // Test profile endpoint
    console.log('Testing profile endpoint...');
    const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });
    
    console.log('✅ Profile API working:');
    console.log('  - Profile ID:', profileResponse.data.id);
    console.log('  - Name:', `${profileResponse.data.localizedFirstName} ${profileResponse.data.localizedLastName}`);
    
  } catch (error) {
    console.error('❌ LinkedIn API test failed:');
    console.error('  - Status:', error.response?.status);
    console.error('  - Error:', error.response?.data || error.message);
  }
}

// Run tests
async function runTests() {
  try {
    const config = await testLinkedInConfig();
    
    // Uncomment the line below and add a valid access token to test API endpoints
    // await testLinkedInAPI('your_access_token_here');
    
    console.log('\n✅ LinkedIn integration setup complete!');
    console.log('🚀 Ready to implement OAuth flow and posting functionality.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTests(); 