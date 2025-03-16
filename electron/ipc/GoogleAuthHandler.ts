import { ipcMain } from 'electron';
import fetch from 'node-fetch';
import { adminAuth } from '../firebase/admin';
import { mainWindow } from '../main';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get Google OAuth credentials
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Validate Google OAuth credentials
if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') {
  console.error('⛔️ GOOGLE_CLIENT_ID is not properly configured in .env file');
} else {
  console.log('✅ GOOGLE_CLIENT_ID is configured');
}

if (!GOOGLE_CLIENT_SECRET || GOOGLE_CLIENT_SECRET === 'YOUR_GOOGLE_CLIENT_SECRET') {
  console.error('⛔️ GOOGLE_CLIENT_SECRET is not properly configured in .env file');
} else {
  console.log('✅ GOOGLE_CLIENT_SECRET is configured');
}

// Google OAuth configuration
const googleConfig = {
  clientId: GOOGLE_CLIENT_ID || '',
  clientSecret: GOOGLE_CLIENT_SECRET || '',
  authEndpoint: 'https://accounts.google.com/o/oauth2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  redirectUri: 'http://localhost:14500/oauth',
  scope: 'profile email'
};

// Set up Google Auth handlers
export const setupGoogleAuthHandlers = () => {
  console.log('Setting up Google Auth handlers...');

  // Exchange OAuth code for tokens
  ipcMain.handle('google-auth:exchange-code', async (event, code: string) => {
    try {
      console.log('Exchanging authorization code for tokens...');
      
      // Validate inputs
      if (!code) {
        console.error('⛔️ No authorization code provided');
        return { success: false, error: 'No authorization code provided' };
      }
      
      if (!googleConfig.clientId || googleConfig.clientId === '') {
        console.error('⛔️ Google Client ID is not configured');
        return { success: false, error: 'Google Client ID is not configured' };
      }
      
      if (!googleConfig.clientSecret || googleConfig.clientSecret === '') {
        console.error('⛔️ Google Client Secret is not configured');
        return { success: false, error: 'Google Client Secret is not configured' };
      }
      
      // Create the token request
      const params = new URLSearchParams();
      params.append('code', code);
      params.append('client_id', googleConfig.clientId);
      params.append('client_secret', googleConfig.clientSecret);
      params.append('redirect_uri', googleConfig.redirectUri);
      params.append('grant_type', 'authorization_code');
      
      // Make the token request
      const response = await fetch(googleConfig.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Token exchange error:', errorData);
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
      }
      
      const tokenData = await response.json() as {
        access_token: string;
        refresh_token?: string;
        id_token: string;
        expires_in: number;
      };
      
      console.log('Token exchange successful');
      
      // Get user profile with the access token
      const userProfile = await getUserProfile(tokenData.access_token);
      
      // If we have firebase auth, sign in with credential
      if (adminAuth) {
        try {
          // Create a Firebase custom token
          const customToken = await adminAuth.createCustomToken(userProfile.id, {
            email: userProfile.email,
            displayName: userProfile.name,
            photoURL: userProfile.picture
          });
          
          return {
            success: true,
            tokens: tokenData,
            userProfile,
            firebaseToken: customToken
          };
        } catch (firebaseError) {
          console.error('Error creating Firebase custom token:', firebaseError);
          
          // Return just the Google tokens and profile if Firebase fails
          return {
            success: true,
            tokens: tokenData,
            userProfile,
            firebaseError: {
              message: firebaseError.message || 'Failed to create Firebase token'
            }
          };
        }
      }
      
      // Return tokens and profile if no Firebase
      return {
        success: true,
        tokens: tokenData,
        userProfile
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      return {
        success: false,
        error: error.message || 'Failed to exchange authorization code'
      };
    }
  });
  
  // Get Google auth URL
  ipcMain.handle('google-auth:get-auth-url', () => {
    console.log('Building Google auth URL...');
    
    // Validate client ID
    if (!googleConfig.clientId || googleConfig.clientId === '') {
      console.error('⛔️ Google Client ID is not configured. Please check your .env file.');
      throw new Error('Google Client ID is not configured. Please check your .env file.');
    }
    
    try {
      const url = new URL(googleConfig.authEndpoint);
      
      // Add required OAuth parameters
      url.searchParams.append('client_id', googleConfig.clientId);
      url.searchParams.append('redirect_uri', googleConfig.redirectUri);
      url.searchParams.append('response_type', 'code');
      url.searchParams.append('scope', googleConfig.scope);
      url.searchParams.append('access_type', 'offline');
      url.searchParams.append('prompt', 'consent');
      
      const authUrl = url.toString();
      console.log(`Generated Google Auth URL: ${authUrl.substring(0, 100)}...`);
      return authUrl;
    } catch (error) {
      console.error('⛔️ Error generating Google Auth URL:', error);
      throw error;
    }
  });
};

// Fetch user profile with access token
async function getUserProfile(accessToken: string) {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Profile fetch failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as {
      sub: string;  // User ID
      name: string;
      email: string;
      picture: string;
    };
    
    return {
      id: data.sub,
      name: data.name,
      email: data.email,
      picture: data.picture
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
} 