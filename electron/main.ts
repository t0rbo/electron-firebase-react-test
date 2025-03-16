import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import url from 'url';
import { setupAuthHandlers } from './ipc/authHandlers';
import { initializeFirebaseAdmin, database, manuallyInitializeDatabase } from './firebase/admin';
import { createServer } from 'http';
import { parse } from 'url';

let mainWindow: BrowserWindow | null = null;

// Set default NODE_ENV if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = app.isPackaged ? 'production' : 'development';
}

// Port for the OAuth callback server
const OAUTH_CALLBACK_PORT = 14500;
let httpServer: any = null;

const isDevelopment = process.env.NODE_ENV === 'development';
console.log(`Application running in ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode (NODE_ENV=${process.env.NODE_ENV})`);

// Get the directory name equivalent for ES modules
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Create a function to redirect logs to renderer
function redirectLogsToRenderer() {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  // Override console.log
  console.log = (...args) => {
    // Call original implementation first
    originalConsoleLog(...args);
    
    // Send to renderer if mainWindow exists
    if (mainWindow && !mainWindow.isDestroyed()) {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      mainWindow.webContents.send('main-process-log', {
        type: 'log',
        message
      });
    }
  };
  
  // Override console.error
  console.error = (...args) => {
    // Call original implementation first
    originalConsoleError(...args);
    
    // Send to renderer if mainWindow exists
    if (mainWindow && !mainWindow.isDestroyed()) {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      mainWindow.webContents.send('main-process-log', {
        type: 'error',
        message
      });
    }
  };
  
  // Override console.warn
  console.warn = (...args) => {
    // Call original implementation first
    originalConsoleWarn(...args);
    
    // Send to renderer if mainWindow exists
    if (mainWindow && !mainWindow.isDestroyed()) {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      mainWindow.webContents.send('main-process-log', {
        type: 'warn',
        message
      });
    }
  };
}

async function createWindow() {
  console.log("Creating main window...");
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Show devtools automatically in development mode
  if (isDevelopment) {
    mainWindow.webContents.openDevTools();
  }

  // Load the app
  if (isDevelopment) {
    console.log("Loading development URL");
    try {
      // In development, try to load from the local dev server
      await mainWindow.loadURL('http://localhost:5173/');
    } catch (error) {
      console.log("Failed to load from development server, falling back to built files");
      // If development server isn't available, fall back to built files
      await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  } else {
    console.log("Loading production URL");
    // In production, load the locally built files
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.once('dom-ready', () => {
    // Redirect logs once DOM is ready
    redirectLogsToRenderer();
    console.log('===== ELECTRON MAIN LOGS REDIRECTED TO RENDERER =====');
    console.log('Firebase logs should now be visible in the renderer console');
  });
  
  // Initialize the HTTP server for OAuth callback
  setupOAuthCallbackServer();
}

// Set up OAuth callback server to handle Google sign-in redirects
function setupOAuthCallbackServer() {
  console.log('Setting up OAuth callback server on port 14500...');
  
  // Create an HTTP server to handle OAuth callbacks
  httpServer = createServer((req, res) => {
    console.log(`Received request at OAuth server: ${req.method} ${req.url}`);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Request-Method', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', '*');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Focus the main window when a callback is received
    if (mainWindow) {
      mainWindow.focus();
      mainWindow.show();
    }

    console.log(`OAuth callback received: ${req.url}`);
    res.writeHead(200);

    // Handle OAuth callback
    if (req.url && req.url.startsWith('/oauth')) {
      const parsedUrl = parse(req.url, true);
      const code = parsedUrl.query.code as string;
      
      // Send the authorization code to the renderer process
      if (mainWindow && code) {
        console.log('Sending OAuth code to renderer process:', code.substring(0, 10) + '...');
        mainWindow.webContents.send('oauth-reply', code);
      }
      
      // Show a message to close the browser tab
      res.write('<html><body><h3>Authentication successful!</h3><p>You can close this window now.</p><script>window.close();</script></body></html>');
    }
    
    res.end();
  }).listen(OAUTH_CALLBACK_PORT, 'localhost', () => {
    console.log(`OAuth callback server is now running at http://localhost:${OAUTH_CALLBACK_PORT}`);
  });

  httpServer.on('error', (err) => {
    console.error('Error starting OAuth callback server:', err);
  });

  console.log(`OAuth callback server setup complete`);
}

// Initialize app
app.whenReady().then(async () => {
  try {
    console.log("Initializing Firebase Admin SDK from main process");
    await initializeFirebaseAdmin();
    console.log("Firebase Admin SDK initialization complete");
    
    // Check if database is initialized
    if (database) {
      console.log("Firebase database successfully initialized");
      
      // List available methods on the database object for debugging
      console.log("Available database methods:", 
        Object.getOwnPropertyNames(Object.getPrototypeOf(database!))
          .filter(prop => typeof database![prop] === 'function')
          .join(', ')
      );
      
      // Test if we can create a reference
      try {
        if (typeof database.ref === 'function') {
          const testRef = database.ref('test');
          console.log("Successfully created test database reference");
          
          // Try to read from the test path
          if (typeof testRef.once === 'function') {
            try {
              console.log("Reading test data from database...");
              const snapshot = await testRef.once('value');
              console.log("Database read successful, data:", snapshot.val() || "No data");
            } catch (readError) {
              console.error("Error reading from database:", readError);
            }
          } else {
            console.error("Database reference missing 'once' method");
          }
        } else {
          console.error("Database object missing 'ref' method");
        }
      } catch (refError) {
        console.error("Error creating database reference:", refError);
      }
    } else {
      console.error("Firebase database initialization failed");
      
      // Try manual initialization as a fallback
      console.log("Attempting manual database initialization as fallback");
      try {
        const db = manuallyInitializeDatabase();
        console.log(db ? "Manual database initialization successful" : "Manual initialization also failed");
        
        if (db) {
          // Test if we can create a reference with manually initialized DB
          try {
            const testRef = db.ref('test');
            console.log("Successfully created test database reference with manually initialized DB");
            
            // Try to read from the test path
            const snapshot = await testRef.once('value');
            console.log("Database read successful with manual DB, data:", snapshot.val() || "No data");
          } catch (refError) {
            console.error("Error using manually initialized database:", refError);
          }
        }
      } catch (error) {
        console.error("Manual database initialization failed:", error);
      }
    }
    
    // Setup IPC handlers
    setupAuthHandlers();
    
    await createWindow();
  } catch (error) {
    console.error("Error during app initialization:", error);
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app cleanup
app.on('before-quit', () => {
  if (httpServer) {
    httpServer.close();
  }
});

// Export mainWindow for use in other files
export { mainWindow }; 