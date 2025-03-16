import { 
  signInWithPopup, 
  GoogleAuthProvider,
  getAuth
} from 'firebase/auth';
import { app } from '../firebase/config';
import { GoogleAuthService } from './googleAuthService';

// Feature detection to check if we're in Electron or browser
export const isElectron = () => {
  return window && window.electron && window.electron.auth;
};

// User type definition
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

// Get the auth instance from the imported config
const firebaseWeb = !isElectron() ? { app } : null;

/**
 * Generate a new session ID for authentication
 */
export const generateSessionId = async (): Promise<string> => {
  // In Electron, use the IPC bridge
  if (isElectron()) {
    try {
      return await window.electron.auth.generateSessionId();
    } catch (error) {
      console.error('Error generating session ID in Electron:', error);
      throw error;
    }
  }
  
  // In web environment, generate a random ID
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

/**
 * Open the authentication window in the browser
 */
export const openAuthWindow = async (sessionId: string): Promise<string> => {
  // In Electron, use the IPC bridge
  if (isElectron()) {
    try {
      return await window.electron.auth.openAuthWindow(sessionId);
    } catch (error) {
      console.error('Error opening auth window in Electron:', error);
      throw error;
    }
  }
  
  // In web environment, just return the session ID
  console.log('Web environment detected, using direct Firebase authentication');
  return `Web auth flow started with session ID: ${sessionId}`;
};

/**
 * Sign in with a Firebase ID token
 */
export const signInWithToken = async (token: string): Promise<User> => {
  try {
    // In Electron, authenticate through the main process
    if (isElectron()) {
      try {
        const result = await window.electron.auth.signInWithToken(token);
        return result.user;
      } catch (error) {
        console.error('Error signing in with token in Electron:', error);
        throw error;
      }
    }
    
    // In web environment, we would need to sign in directly with Firebase
    // This is a stub for the web environment
    throw new Error('Sign in with token not implemented for web environment');
  } catch (error) {
    console.error('Error signing in with token:', error);
    throw error;
  }
};

/**
 * Web-only function to sign in with Google
 */
export const signInWithGoogle = async (): Promise<User> => {
  if (!firebaseWeb) {
    throw new Error('Firebase not initialized for web environment');
  }
  
  try {
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    return {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || 'Unnamed User',
      photoURL: user.photoURL,
      emailVerified: user.emailVerified
    };
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

/**
 * Start the authentication flow
 * This function generates a session ID, opens the auth window,
 * and returns a promise that resolves when authentication is complete
 */
export const startAuthFlow = async (): Promise<User> => {
  try {
    console.log('===== FIREBASE CONNECTION STATUS =====');
    console.log('Starting authentication flow...');
    
    // Test Firebase connection first
    try {
      if (app) {
        console.log('FIREBASE CONNECTION SUCCESS: Firebase app is initialized');
      } else {
        console.log('FIREBASE CONNECTION FAILURE: Firebase app is not initialized');
      }
    } catch (error) {
      console.error('FIREBASE CONNECTION FAILURE: Error accessing Firebase app:', error);
    }
    
    // If in web environment, use direct Firebase auth
    if (!isElectron()) {
      console.log('Using web authentication flow');
      return await signInWithGoogle();
    }
    
    // In Electron, use the Google Auth flow with local HTTP server
    console.log('Using Electron Google authentication flow with local HTTP server');
    
    try {
      // Initialize Google Auth Service
      await GoogleAuthService.initialize();
      
      // Start Google Auth flow
      const { user } = await GoogleAuthService.signIn();
      
      console.log('Google Auth Success!', user);
      
      // Convert Firebase user to our User type
      return {
        uid: user.uid || user.id || '',
        email: user.email || '',
        displayName: user.displayName || user.name || 'Unnamed User',
        photoURL: user.photoURL || user.picture || null,
        emailVerified: user.emailVerified === undefined ? true : user.emailVerified
      };
    } catch (error) {
      console.error('Error in Google authentication flow:', error);
      
      // Fall back to the original auth flow if Google auth fails
      console.log('Falling back to original authentication flow...');
      
      // Original flow:
      // Generate a session ID
      const sessionId = await generateSessionId();
      console.log(`Generated session ID: ${sessionId}`);
      
      // Open the auth window
      const authUrl = await openAuthWindow(sessionId);
      console.log(`Opened auth window: ${authUrl}`);
      
      // Return a promise that resolves when the token is received
      return new Promise((resolve, reject) => {
        console.log("Setting up listener for auth token...");
        
        const removeListener = window.electron.auth.onTokenReceived((data) => {
          if (data) {
            console.log("FIREBASE CONNECTION SUCCESS: Token data received from main process");
          } else {
            console.log("FIREBASE CONNECTION FAILURE: No token data received from main process");
          }
          
          if (data && data.token) {
            console.log("Valid token received, signing in...");
            
            // Sign in with the token
            signInWithToken(data.token)
              .then((user) => {
                console.log("FIREBASE CONNECTION SUCCESS: User authenticated successfully:", user.displayName);
                removeListener();
                resolve(user);
              })
              .catch((error) => {
                console.error("FIREBASE CONNECTION FAILURE: Error signing in with token:", error);
                removeListener();
                reject(error);
              });
          } else {
            console.warn("FIREBASE CONNECTION FAILURE: Received empty or invalid token data");
            if (data) {
              console.log("Data received:", JSON.stringify(data, null, 2));
            }
          }
        });
        
        // Set a timeout to reject the promise after 5 minutes
        setTimeout(() => {
          console.error("FIREBASE CONNECTION FAILURE: Authentication timed out after 5 minutes");
          removeListener();
          reject(new Error('Authentication timed out'));
        }, 5 * 60 * 1000);
      });
    }
  } catch (error) {
    console.error('FIREBASE CONNECTION FAILURE: Error in auth flow:', error);
    throw error;
  }
}; 