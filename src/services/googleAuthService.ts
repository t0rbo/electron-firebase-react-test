import { getAuth, signInWithCustomToken } from 'firebase/auth';

// Service for handling Google authentication
export const GoogleAuthService = {
  // Initialize Google authentication
  initialize: () => {
    console.log('Initializing Google Auth Service');
    console.log('Checking for Electron Google Auth API availability...');
    
    return new Promise<void>((resolve) => {
      // Check if electron API is available
      if (!window.electron?.auth?.googleAuth) {
        console.warn('⚠️ Electron Google Auth API not available - running in browser mode');
      } else {
        console.log('✅ Electron Google Auth API is available');
      }
      resolve();
    });
  },

  // Start the Google authentication flow
  signIn: () => {
    console.log('Starting Google authentication flow...');
    
    return new Promise<{ user: any }>((resolve, reject) => {
      // Check if running in Electron
      if (!window.electron?.auth?.googleAuth) {
        console.warn('Running in browser - Google Auth not available');
        reject(new Error('Google authentication not available in browser mode'));
        return;
      }

      console.log('Requesting Google Auth URL from main process...');
      // Get the Google Auth URL from the main process
      window.electron.ipcRenderer.invoke('google-auth:get-auth-url')
        .then((authUrl: string) => {
          console.log(`Got Google Auth URL: ${authUrl.substring(0, 50)}...`);
          
          // Set up a listener for the OAuth callback
          console.log('Setting up OAuth callback listener...');
          const cleanup = window.electron.auth.onOAuthReply((code: string) => {
            console.log('✅ Received OAuth code, exchanging for tokens...');
            try {
              // Exchange the code for tokens via IPC
              console.log('Calling google-auth:exchange-code...');
              window.electron.ipcRenderer.invoke('google-auth:exchange-code', code)
                .then(async (data: any) => {
                  console.log('Received token exchange response:', data.success ? 'success' : 'failed');
                  
                  if (!data.success) {
                    throw new Error(data.error || 'Failed to exchange code');
                  }
                  
                  // Sign in with Firebase using the custom token
                  if (data.firebaseToken) {
                    console.log('Signing in with Firebase custom token...');
                    const auth = getAuth();
                    const userCredential = await signInWithCustomToken(auth, data.firebaseToken);
                    console.log('✅ Firebase sign-in successful!');
                    resolve({ user: userCredential.user });
                  } else {
                    // If no Firebase token but successful auth, resolve with user profile
                    console.log('No Firebase token, using user profile directly');
                    resolve({ user: data.userProfile });
                  }
                })
                .catch((error: Error) => {
                  console.error('❌ Error during Google sign-in:', error);
                  reject(error);
                })
                .finally(() => {
                  // Remove the listener
                  console.log('Cleaning up OAuth listener');
                  cleanup();
                });
            } catch (error: unknown) {
              console.error('❌ Error during Google sign-in:', error);
              reject(error instanceof Error ? error : new Error(String(error)));
              cleanup();
            }
          });
          
          // Open the Google Auth URL
          console.log('Opening Google Auth URL in browser...');
          window.electron.auth.googleAuth(authUrl);
        })
        .catch((error: Error) => {
          console.error('❌ Error getting Google Auth URL:', error);
          reject(error);
        });
    });
  },
  
  // Sign in with a custom token from the server
  signInWithCustomToken: async (token: string) => {
    console.log('Signing in with custom token...');
    const auth = getAuth();
    return signInWithCustomToken(auth, token);
  }
}; 