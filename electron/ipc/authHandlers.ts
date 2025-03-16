import { ipcMain, BrowserWindow, shell } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { database, adminAuth, manuallyInitializeDatabase } from '../firebase/admin';
import * as path from 'path';
import * as url from 'url';
import { mainWindow } from '../main';
import fetch from 'node-fetch';
import { setupGoogleAuthHandlers } from './googleAuthHandler';

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Function to verify the Firebase ID token and return user data
 */
export const signInWithIdToken = async (idToken: string) => {
  try {
    // Check if adminAuth was initialized properly
    if (!adminAuth) {
      console.log("Admin Auth is null, checking if we can initialize Firebase Admin");
      
      try {
        // First try to manually initialize Firebase again
        const db = manuallyInitializeDatabase();
        console.log("Manual initialization result:", db ? "Success" : "Failed");
        
        // Re-check if adminAuth is available after initialization
        if (!adminAuth && isDevelopment) {
          console.log("DEV MODE: Admin Auth still not available, using mock data");
          
          // For development, return a mock user with a recognizable ID
          return {
            uid: "dev-mock-user-id",
            email: "dev@example.com",
            displayName: "Development User",
            photoURL: null,
            emailVerified: true,
          };
        } else if (!adminAuth) {
          console.error("PRODUCTION MODE: Admin Auth still not available after initialization attempt");
          throw new Error("Authentication failed: Firebase Admin SDK not initialized");
        }
      } catch (initError) {
        console.error("Error during manual Firebase Admin initialization:", initError);
        
        if (isDevelopment) {
          console.log("DEV MODE: Using mock data due to initialization error");
          
          // For development, return a mock user
          return {
            uid: "dev-mock-user-id",
            email: "dev@example.com",
            displayName: "Development User",
            photoURL: null,
            emailVerified: true,
          };
        } else {
          throw new Error("Authentication failed: Cannot initialize Firebase Admin");
        }
      }
    }
    
    // For development mode, we can skip token verification and use a mock token
    if (isDevelopment && idToken.startsWith('dev-')) {
      console.log("DEV MODE: Using mock token data");
      return {
        uid: "dev-mock-user-id",
        email: "dev@example.com",
        displayName: "Development User",
        photoURL: null,
        emailVerified: true,
      };
    }

    // Verify the ID token using the Admin SDK (if available)
    if (adminAuth && typeof adminAuth.verifyIdToken === 'function') {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      
      // Get the user record
      if (typeof adminAuth.getUser === 'function') {
        const userRecord = await adminAuth.getUser(decodedToken.uid);
        
        // Return user data
        return {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          photoURL: userRecord.photoURL,
          emailVerified: userRecord.emailVerified,
        };
      } else {
        console.log('getUser function not available, using decoded token data');
        
        // Return data from decoded token
        return {
          uid: decodedToken.uid,
          email: decodedToken.email || null,
          displayName: decodedToken.name || null,
          photoURL: decodedToken.picture || null,
          emailVerified: decodedToken.email_verified || false,
        };
      }
    } else {
      console.error("verifyIdToken function not available on adminAuth");
      
      if (isDevelopment) {
        console.log("DEV MODE: Using mock data due to missing verifyIdToken function");
        return {
          uid: "dev-mock-user-id",
          email: "dev@example.com",
          displayName: "Development User",
          photoURL: null,
          emailVerified: true,
        };
      } else {
        throw new Error("Authentication failed: Firebase Admin SDK not properly initialized");
      }
    }
  } catch (error) {
    console.error("Error signing in with ID token:", error);
    
    // If we're in development mode, we can return mock data
    if (isDevelopment) {
      console.log("DEV MODE: Returning mock user data after error");
      return {
        uid: "dev-mock-user-id",
        email: "dev@example.com",
        displayName: "Development User",
        photoURL: null,
        emailVerified: true,
      };
    }
    
    // In production, throw the error to be handled by the caller
    throw error;
  }
};

/**
 * Setup all authentication-related IPC handlers
 */
export const setupAuthHandlers = () => {
  console.log('Setting up auth handlers...');
  
  // Set up Google Auth handlers
  console.log('Initializing Google Auth handlers...');
  setupGoogleAuthHandlers();
  console.log('Google Auth handlers initialized');

  // Add direct test for Firebase connectivity
  console.log('===== FIREBASE CONNECTION TEST =====');
  if (database) {
    try {
      // Test database connection by reading from the auth_sessions path
      const testPath = 'auth_sessions';
      console.log(`Testing database connection with path: ${testPath}`);
      
      const testRef = database.ref ? database.ref(testPath) : 
                     (database as any).child ? (database as any).child(testPath) : null;
                     
      if (testRef && typeof testRef.on === 'function') {
        console.log('Database reference created successfully, attempting to listen...');
        
        // Set up a test listener that logs EVERYTHING
        testRef.on('value', (snapshot) => {
          console.log('FIREBASE CONNECTION SUCCESS: Database connection working!');
          console.log('FIREBASE CONNECTION SUCCESS: Data available:', snapshot.exists());
          console.log('FIREBASE CONNECTION SUCCESS: All data in auth_sessions:', JSON.stringify(snapshot.val()));
        }, (error) => {
          console.error('FIREBASE CONNECTION FAILURE: Firebase test connection error:', error);
        });
        
        console.log('Test listener set up successfully');
      } else {
        console.error('FIREBASE CONNECTION FAILURE: Failed to create database reference for test');
      }
    } catch (error) {
      console.error('FIREBASE CONNECTION FAILURE: Error testing Firebase connection:', error);
    }
  } else {
    console.error('FIREBASE CONNECTION FAILURE: Database not initialized');
  }

  ipcMain.handle('auth:listen-for-token', async (event, sessionId) => {
    console.log(`Setting up listener for sessionId: ${sessionId}`);
    
    try {
      // Try to get database if it doesn't exist yet
      let db = database;
      if (!db) {
        console.log('Database not initialized, attempting manual initialization');
        try {
          db = manuallyInitializeDatabase();
        } catch (error) {
          console.error('Failed to manually initialize database:', error);
        }
      }
      
      if (!db) {
        if (isDevelopment) {
          console.log('DEV MODE: No database available, simulating authentication for development');
          // For development, if no database connection, simulate auth after a delay
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              console.log('DEV MODE: Simulating auth token received');
              mainWindow.webContents.send('auth-token-received', {
                token: 'dev-simulated-token',
                uid: 'dev-simulated-uid'
              });
            }
          }, 3000);
          
          return { success: true, message: 'DEV MODE: Using simulated auth (no database)' };
        } else {
          console.error('PRODUCTION MODE: No database available, authentication will not work');
          return { success: false, error: 'Database connection required for authentication' };
        }
      }

      // Create database reference - handle different Firebase SDK versions
      console.log('Creating database reference for session:', sessionId);
      let dbRef;
      
      // Try different methods to get the reference based on the Firebase Admin SDK version
      try {
        // IMPORTANT! Use auth_sessions/${sessionId} to match the web app
        const dbPath = `auth_sessions/${sessionId}`;
        console.log('Using database path:', dbPath);
        
        if (typeof db.ref === 'function') {
          // Firebase Admin SDK v9 and below
          dbRef = db.ref(dbPath);
          console.log('Created database reference using db.ref() method');
        } else if (typeof (db as any).child === 'function') {
          // Some versions use child method directly
          dbRef = (db as any).child(dbPath);
          console.log('Created database reference using db.child() method');
        } else {
          // Try Firebase Admin SDK v9+ with new API
          try {
            const { ref } = require('firebase-admin/database');
            dbRef = ref(db, dbPath);
            console.log('Created database reference using firebase-admin/database ref() function');
          } catch (error) {
            console.error('Failed to use firebase-admin/database ref() function:', error);
          }
        }
      } catch (error) {
        console.error('Failed to create database reference:', error);
        return { success: false, error: 'Failed to create database reference' };
      }
      
      if (!dbRef) {
        console.error('Unable to create database reference with any method');
        return { success: false, error: 'Unable to create database reference' };
      }

      // Set up the listener for token
      console.log('Setting up database listener for token updates');
      
      // Use appropriate method to listen for changes (depends on Firebase SDK version)
      let unsubscribe;
      
      try {
        if (typeof dbRef.on === 'function') {
          // Firebase Admin SDK v8 and below
          dbRef.on('value', (snapshot) => {
            const data = snapshot.val();
            
            // Add detailed debugging information
            console.log('----- Firebase Data Snapshot -----');
            console.log('Raw data received:', JSON.stringify(data, null, 2));
            console.log('Data exists:', data ? 'YES' : 'NO');
            if (data) {
              console.log('Available keys:', Object.keys(data));
              console.log('Has idToken:', data.idToken ? 'YES' : 'NO');
              console.log('Has token:', data.token ? 'YES' : 'NO');
              console.log('Has uid:', data.uid ? 'YES' : 'NO');
              console.log('Has user object:', data.user ? 'YES' : 'NO');
              if (data.user) console.log('User keys:', Object.keys(data.user));
            }
            console.log('---------------------------------');
            
            // Check for BOTH token and idToken to handle both formats
            if (data) {
              let token: string | null = null;
              let uid: string | null = null;
              let user: any | null = null;
              
              // Check for web app format (idToken + user object)
              if (data.idToken) {
                console.log('Found idToken in data');
                token = data.idToken;
                user = data.user || null;
                if (user && typeof user === 'object' && 'uid' in user) uid = user.uid;
              }
              
              // Check for older format (token + uid)
              else if (data.token && data.uid) {
                console.log('Found token and uid in data');
                token = data.token;
                uid = data.uid;
              }
              
              if (token) {
                let userIdPreview = 'unknown';
                if (uid && typeof uid === 'string' && uid.length > 8) {
                  userIdPreview = uid.substring(0, 8);
                } else if (uid) {
                  userIdPreview = String(uid);
                }
                
                console.log(`Token received for user ${userIdPreview}...`);
                
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('auth-token-received', {
                    token: token,
                    uid: uid,
                    user: user
                  });
                  console.log('Token sent to renderer process');
                } else {
                  console.error('Main window is not available to send token');
                }
              }
            }
          }, (error) => {
            console.error('Database listen error:', error);
          });
          
          unsubscribe = () => dbRef.off('value');
          console.log('Listener attached using on("value") method');
        } else {
          console.error('Unable to attach listener - no appropriate listen method found');
          return { success: false, error: 'Unable to attach database listener' };
        }
      } catch (error) {
        console.error('Error setting up database listener:', error);
        return { success: false, error: 'Error setting up database listener' };
      }

      // Return success
      console.log('Auth listener setup successfully');
      return { success: true };
    } catch (error) {
      console.error('Error in auth:listen-for-token handler:', error);
      return { success: false, error: error.message };
    }
  });

  // Generate a session ID for authentication
  ipcMain.handle('generate-session-id', () => {
    return uuidv4();
  });

  // Open the authentication window with a session ID
  ipcMain.handle('open-auth-window', async (event, sessionId) => {
    if (!sessionId) throw new Error("No session ID provided");
    
    console.log(`Starting auth process for session ID: ${sessionId}`);
    
    // Use the development auth URL
    const authBaseUrl = process.env.AUTH_BASE_URL || "https://money-moves-fe56b.web.app/login";

    // Make sure sessionId is properly encoded in the URL
    const authUrl = `${authBaseUrl}?sessionId=${encodeURIComponent(sessionId)}`;
    
    // IMPORTANT: Explicitly start the Firebase listener BEFORE opening the browser
    console.log("Explicitly starting Firebase listener before opening browser");
    setupFirebaseListenerWithFallback(sessionId, true);

    // In development mode, we can provide a quicker fallback for testing
    if (isDevelopment) {
      console.log("DEV MODE: Setting up dev mode quick auth in 3 seconds");
      
      // Simulate authentication after a short delay for development testing
      setTimeout(() => {
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log("DEV MODE: Simulating auth token received after timeout");
          mainWindow.webContents.send("auth-token-received", {
            token: "dev-mock-id-token",
            user: {
              uid: "dev-mock-user-id",
              email: "dev@example.com",
              displayName: "Development User", 
              photoURL: null,
              emailVerified: true
            }
          });
        }
      }, 3000);
    }

    // Open the auth URL in the default browser
    console.log(`Opening auth URL: ${authUrl}`);
    await shell.openExternal(authUrl);

    // Return the auth URL so the renderer can display it to the user
    return authUrl;
  });

  // Sign in with an ID token
  ipcMain.handle('sign-in-with-token', async (event, idToken) => {
    try {
      const userData = await signInWithIdToken(idToken);
      return { user: userData };
    } catch (error) {
      console.error('Error signing in with token:', error);
      return { error: error.message || 'Unknown error during sign in' };
    }
  });
  
  // Add a handler to sign in with Google access token
  ipcMain.handle('sign-in-with-google-token', async (event, accessToken) => {
    try {
      if (!adminAuth) {
        throw new Error('Firebase Admin Auth not initialized');
      }
      
      // Fetch the user profile to get the user ID
      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      
      if (!profileResponse.ok) {
        throw new Error(`Failed to fetch user profile: ${profileResponse.statusText}`);
      }
      
      const userProfile = await profileResponse.json() as {
        sub: string;
        email: string;
        name: string;
        picture: string;
      };
      
      // Create a custom Firebase token for this user
      const customToken = await adminAuth.createCustomToken(userProfile.sub, {
        email: userProfile.email,
        displayName: userProfile.name,
        photoURL: userProfile.picture
      });
      
      return {
        success: true,
        firebaseToken: customToken,
        userProfile: {
          uid: userProfile.sub,
          email: userProfile.email,
          displayName: userProfile.name,
          photoURL: userProfile.picture
        }
      };
    } catch (error) {
      console.error('Error signing in with Google token:', error);
      
      if (isDevelopment) {
        console.log('DEV MODE: Returning mock data for Google sign-in');
        // Create a mock token for development
        return {
          success: true,
          firebaseToken: 'dev-mock-token',
          userProfile: {
            uid: 'google-dev-user',
            email: 'google-dev@example.com',
            displayName: 'Google Dev User',
            photoURL: null
          }
        };
      }
      
      return {
        success: false,
        error: error.message || 'Failed to sign in with Google'
      };
    }
  });

  // Function to monitor for authentication using both Firebase and HTTP fallback
  function setupFirebaseListenerWithFallback(sessionId: string, allowSimulation: boolean) {
    let authReceived = false;
    let pollCount = 0;
    const maxPolls = 300; // 5 minutes at 1-second intervals
    let pollingInterval: NodeJS.Timeout | null = null;
    
    console.log(`===== FIREBASE AUTH MONITORING (${sessionId}) =====`);
    
    // Verify database is initialized
    if (!database) {
      console.error('FIREBASE AUTH FAILURE: Database not initialized, cannot setup listener');
      return null;
    }
    
    try {
      // Create a reference to the session data location
      const sessionPath = `auth_sessions/${sessionId}`;
      console.log(`Setting up database listener for path: ${sessionPath}`);
      
      const sessionRef = database.ref ? database.ref(sessionPath) : 
                         (database as any).child ? (database as any).child(sessionPath) : null;
      
      // Verify we have a valid reference
      if (!sessionRef) {
        console.error('FIREBASE AUTH FAILURE: Could not create database reference');
        return null;
      }
      
      // Set up the listener for the token
      console.log('Database reference created successfully, setting up listener...');
      
      sessionRef.on('value', (snapshot) => {
        console.log('FIREBASE AUTH STATUS: Data received for session', sessionId);
        console.log('Data exists:', snapshot.exists());
        console.log('Raw data received:', JSON.stringify(snapshot.val()));
        
        if (snapshot.exists() && !authReceived) {
          const data = snapshot.val();
          
          if (data && data.idToken) {
            authReceived = true;
            console.log('FIREBASE AUTH SUCCESS: Authentication token received from Firebase');
            console.log('Token preview:', data.idToken.substring(0, 10) + '...');
            
            if (mainWindow && !mainWindow.isDestroyed()) {
              console.log('Sending token to renderer process...');
              mainWindow.webContents.send('auth-token-received', {
                token: data.idToken,
                user: data.user || null
              });
              console.log('Token sent to renderer process');
            } else {
              console.error('FIREBASE AUTH FAILURE: Main window not found or destroyed, cannot send token');
            }
          } else {
            console.log('FIREBASE AUTH STATUS: Data received but no token found');
          }
        } else if (!snapshot.exists()) {
          console.log('FIREBASE AUTH STATUS: Null or empty data received from database');
        }
      }, (error) => {
        console.error('FIREBASE AUTH FAILURE: Error setting up Firebase listener:', error);
      });
      
      console.log('Firebase database listener set up successfully');
      
      // Function to poll Firebase using HTTP
      async function pollFirebaseDatabase(sessionId: string, pollCount: number, maxPolls: number): Promise<any> {
        const url = `https://money-moves-fe56b-default-rtdb.firebaseio.com/auth_sessions/${sessionId}.json`;
        console.log(`Polling Firebase REST API (${pollCount}/${maxPolls}): ${url}`);
        
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          return data;
        } catch (error) {
          console.error(`HTTP polling attempt ${pollCount} failed:`, error);
          return null;
        }
      }
      
      // Set up HTTP polling fallback
      console.log('Setting up HTTP polling fallback for session ID');
      
      // Function to stop the polling and log a message
      function clearPolling(reason: string) {
        console.log(`Stopping Firebase polling: ${reason}`);
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
        }
      }
      
      // Function to poll the Firebase REST API
      async function pollForToken(sessionId: string, pollCount: number, maxPolls: number) {
        console.log(`Polling for auth token (attempt ${pollCount}/${maxPolls})`);
        
        try {
          const data = await pollFirebaseDatabase(sessionId, pollCount, maxPolls);
          
          if (data && data.idToken) {
            console.log(`FIREBASE AUTH SUCCESS: Token received for session ${sessionId}`);
            if (mainWindow) {
              mainWindow.webContents.send('auth-token-received', data);
              console.log('Token sent to renderer process');
              clearPolling('Auth token received, stopping polling');
              return true;
            } else {
              console.error('Main window not available to send token');
            }
          } else {
            console.log(`No token data available yet for session ${sessionId} (attempt ${pollCount}/${maxPolls})`);
          }
        } catch (error) {
          console.error('Error during polling:', error);
        }
        
        return false;
      }
      
      // Start polling with an interval
      let currentPollCount = 0;
      pollingInterval = setInterval(async () => {
        currentPollCount++;
        
        if (currentPollCount > maxPolls) {
          clearPolling('Maximum polling attempts reached');
          return;
        }
        
        const success = await pollForToken(sessionId, currentPollCount, maxPolls);
        if (success) {
          authReceived = true;
        }
      }, 1000); // Poll every second
      
      // Set up simulated auth for development only if all else fails
      if (allowSimulation && isDevelopment) {
        console.log('DEV MODE: Setting up dev mode quick auth in 3 seconds');
        
        setTimeout(() => {
          if (!authReceived) {
            console.log('DEV MODE: Simulating auth token received after timeout');
            authReceived = true;
            
            // For development, simulate a token
            const mockToken = 'dev-mock-id-token-for-development-only';
            
            console.log('Attempting to sign in with token in DEVELOPMENT mode');
            console.log('Token preview:', mockToken.substring(0, 10) + '...');
            
            if (mainWindow && !mainWindow.isDestroyed()) {
              console.log('DEV MODE: Using simulated token');
              mainWindow.webContents.send('auth-token-received', {
                token: mockToken,
                user: {
                  uid: 'dev-mock-user-id',
                  email: 'dev@example.com',
                  displayName: 'Development User',
                  photoURL: null,
                  emailVerified: true,
                }
              });
              console.log('Simulated token sent to renderer process');
            } else {
              console.error('FIREBASE AUTH FAILURE: Main window not found or destroyed in DEV mode simulation');
            }
          }
        }, 3000);
      }
    } catch (error) {
      console.error("Error setting up Firebase database listener:", error);
    }
  }
} 