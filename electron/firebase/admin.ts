import * as admin from 'firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';
import { cert, initializeApp } from 'firebase-admin/app';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import * as dotenv from 'dotenv';
import isDev from 'electron-is-dev';

// Initialize environment variables
dotenv.config();

// Get the directory name equivalent for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database and auth references that will be initialized and reused
let database: any = null;
let adminAuth: any = null;

/**
 * Initialize Firebase Admin SDK
 */
export const initializeFirebaseAdmin = async () => {
  try {
    console.log('Initializing Firebase Admin SDK');
    
    // Configure Firebase Admin SDK with database URL
    const databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://money-moves-fe56b-default-rtdb.firebaseio.com';
    
    console.log(`Using Firebase Database URL: ${databaseURL}`);
    
    // Check if service account key exists
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    
    try {
      if (fs.existsSync(serviceAccountPath)) {
        console.log(`Found service account at: ${serviceAccountPath}`);
        console.log('Using service account key from file');
        
        try {
          // Load the service account key
          const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
          
          // Initialize the app with the service account
          const app = initializeApp({
            credential: cert(serviceAccount),
            databaseURL: databaseURL
          });
          
          // Get the database and auth instances
          database = getDatabase(app);
          adminAuth = getAuth(app);
        } catch (err) {
          console.log(err.message);
          console.log('Proceeding with mock authentication due to Firebase Admin SDK issues');
        }
      } else if (isDev) {
        console.log('No service account key found, initializing without authentication (dev mode)');
        // Initialize without a service account (for development)
        const app = initializeApp({
          databaseURL: databaseURL
        });
        
        try {
          database = getDatabase(app);
        } catch (error) {
          console.error('Failed to get database instance in dev mode:', error);
        }
        
        try {
          adminAuth = getAuth(app);
        } catch (error) {
          console.error('Failed to get auth instance in dev mode:', error);
        }
      } else {
        console.error('No service account key found and not in development mode');
        throw new Error('Service account key required for production');
      }
    } catch (error) {
      console.error('Error accessing service account key:', error);
      if (isDev) {
        // Fall back to initialize without a service account in dev mode
        try {
          const app = initializeApp({
            databaseURL: databaseURL
          });
          database = getDatabase(app);
          adminAuth = getAuth(app);
        } catch (initError) {
          console.error('Failed to initialize in fallback mode:', initError);
        }
      }
    }
    
    console.log('Firebase Admin SDK initialization complete');
    return { database, adminAuth };
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    return { database: null, adminAuth: null };
  }
};

/**
 * Manually initialize Firebase database connection
 * This is a fallback method if the regular initialization fails
 */
export const manuallyInitializeDatabase = () => {
  try {
    console.log("Manually initializing Firebase database connection");
    
    // If database is already initialized, just return it
    if (database) {
      console.log("Database already initialized");
      return database;
    }
    
    // Create a minimal app with just the database configuration
    const databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://money-moves-fe56b-default-rtdb.firebaseio.com';
    
    console.log(`Using database URL: ${databaseURL}`);
    
    // Try to initialize with credential if possible
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    let app;
    
    try {
      if (fs.existsSync(serviceAccountPath)) {
        console.log("Using service account key for authentication");
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        
        try {
          app = initializeApp({
            credential: cert(serviceAccount),
            databaseURL: databaseURL
          });
        } catch (error) {
          console.log('Failed to create credential certificate:', error);
          // Try initializing without credential in dev mode
          if (isDev) {
            app = initializeApp({
              databaseURL: databaseURL
            });
          }
        }
      } else if (isDev) {
        // For development, initialize without credential
        app = initializeApp({
          databaseURL: databaseURL
        });
      } else {
        throw new Error('Service account key required for production');
      }
      
      // Get the database instance
      if (app) {
        database = getDatabase(app);
        console.log("Database instance created successfully");
        return database;
      }
    } catch (error) {
      console.error("Failed to initialize manual database:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error manually initializing Firebase database:", error);
    throw error;
  }
  
  return null;
};

// Export the references
export { database, adminAuth }; 