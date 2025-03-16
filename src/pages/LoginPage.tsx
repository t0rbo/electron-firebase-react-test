import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { getDatabase, ref, set } from 'firebase/database';
import { app } from '../firebase/config';

// Feature detection to check if we're in Electron or browser
const isElectron = () => {
  return window && window.electron && window.electron.auth;
};

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingSession, setProcessingSession] = useState(false);
  const [sessionProcessed, setSessionProcessed] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  // Get the session ID from the URL
  const sessionId = searchParams.get('sessionId');
  
  // Initialize Firebase auth and database
  const auth = getAuth(app);
  const database = getDatabase(app);

  // Detect if this is a web-only session with no Electron connection
  useEffect(() => {
    // If we're in web environment and there's no sessionId, redirect to the main app
    if (!isElectron() && !sessionId) {
      console.log('Web-only environment detected with no session ID, redirecting to main app');
      navigate('/');
    }
  }, [sessionId, navigate]);
  
  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      
      // If we have a user and a session ID, process the session
      if (user && sessionId && !sessionProcessed) {
        handleAuth(user);
      }
    });
    
    return () => unsubscribe();
  }, [auth, sessionId, sessionProcessed]);
  
  // Handle the authentication process
  const handleAuth = async (userObj: FirebaseUser) => {
    try {
      console.log('Starting authentication process for session:', sessionId);
      setProcessingSession(true);
      
      // Get the ID token
      console.log('Getting ID token for user:', userObj.uid);
      const idToken = await userObj.getIdToken(true);
      console.log('ID token obtained successfully');
      
      // Debug token structure (first few chars only for security)
      const tokenPreview = idToken.substring(0, 10) + '...';
      console.log('Token preview:', tokenPreview);
      
      // Store the token and user info in the database
      const dbPath = `auth_sessions/${sessionId}`;
      console.log('Storing token in database path:', dbPath);
      
      const userData = {
        idToken: idToken,
        verified: true,
        created: new Date().toISOString(),
        user: {
          uid: userObj.uid,
          email: userObj.email,
          displayName: userObj.displayName || '',
          photoURL: userObj.photoURL || '',
          emailVerified: userObj.emailVerified
        }
      };
      
      console.log('Writing user data to database (without token):', {
        ...userData,
        idToken: '***REDACTED***' // Don't log the actual token
      });
      
      await set(ref(database, dbPath), userData);
      console.log('User data successfully written to database');
      
      // Mark session as processed
      setSessionProcessed(true);
      setShowSuccessMessage(true);
      console.log('Authentication successful, showing success message');

      // Auto-close or redirect after a delay in web environment
      if (!isElectron()) {
        setTimeout(() => {
          window.close();
          // If window.close() doesn't work (which is common in modern browsers),
          // we'll navigate back to the main app
          navigate('/');
        }, 3000);
      }
    } catch (error) {
      console.error('Error processing session:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setProcessingSession(false);
    }
  };
  
  // Handle Google sign-in
  const signInWithGoogle = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Google sign-in error:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    }
  };
  
  // If we're still loading, show a loading spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  // If we've processed the session, show a success message
  if (showSuccessMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mt-2 text-lg font-medium text-gray-900">Authentication Successful</h3>
            <p className="mt-1 text-sm text-gray-500">
              You can now return to the application.
            </p>
            <p className="mt-3 text-xs text-gray-500">
              This window will close automatically in a few seconds.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  // If we have a session ID but no user, show the login form
  if (sessionId && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4 text-center">Sign in to continue</h2>
          <p className="mb-6 text-gray-600 text-center">
            This will connect your account to the application.
          </p>
          
          <button
            onClick={signInWithGoogle}
            disabled={processingSession}
            className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" width="24" height="24">
              <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
              </g>
            </svg>
            Sign in with Google
          </button>
          
          {error && (
            <div className="mt-4 p-2 bg-red-100 text-red-700 rounded text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // If we have a user but are still processing the session, show a loading message
  if (user && processingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <div className="animate-spin mx-auto rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900">Processing</h3>
          <p className="mt-1 text-sm text-gray-500">
            Please wait while we complete the authentication process...
          </p>
        </div>
      </div>
    );
  }
  
  // If we have a user but no session ID, show a message
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-center">Invalid Session</h2>
        <p className="text-gray-600 text-center">
          This page should be opened from the application. Please return to the app and try again.
        </p>
      </div>
    </div>
  );
};

export default LoginPage; 