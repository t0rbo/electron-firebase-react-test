import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Authentication methods
  auth: {
    // Generate a new session ID
    generateSessionId: (): Promise<string> => {
      return ipcRenderer.invoke('generate-session-id');
    },
    
    // Open the authentication window
    openAuthWindow: (sessionId: string): Promise<string> => {
      return ipcRenderer.invoke('open-auth-window', sessionId);
    },
    
    // Sign in with an ID token
    signInWithToken: (token: string): Promise<{
      user: {
        uid: string;
        email: string | null;
        displayName: string | null;
        photoURL: string | null;
        emailVerified: boolean;
      }
    }> => {
      return ipcRenderer.invoke('sign-in-with-token', token);
    },
    
    // Listen for token received events
    onTokenReceived: (callback: (data: { token: string; user: any }) => void) => {
      const listener = (_event: IpcRendererEvent, data: { token: string; user: any }) => {
        console.log('PRELOAD: Token received event triggered');
        console.log('PRELOAD: Token data available:', !!data.token);
        console.log('PRELOAD: User data available:', !!data.user);
        
        if (data.token) {
          console.log('PRELOAD: Token preview:', data.token.substring(0, 10) + '...');
          console.log('PRELOAD: Token length:', data.token.length);
        } else {
          console.error('PRELOAD: No token data received!');
        }
        
        if (data.user) {
          console.log('PRELOAD: User data:', JSON.stringify(data.user));
        }
        
        // Forward the data to the callback
        callback(data);
      };
      console.log('PRELOAD: Setting up token listener for auth-token-received event');
      ipcRenderer.on('auth-token-received', listener);
      return () => {
        console.log('PRELOAD: Removing token listener');
        ipcRenderer.removeListener('auth-token-received', listener);
      };
    },
    
    // Google OAuth functions
    googleAuth: (authUrl: string) => {
      // Instead of opening an external browser, invoke a main process function
      return ipcRenderer.invoke('google-auth:open-auth-window', authUrl);
    },
    
    // Add a listener for OAuth responses
    onOAuthReply: (callback: (code: string) => void) => {
      const subscription = (event: IpcRendererEvent, code: string) => {
        callback(code);
      };
      
      ipcRenderer.on('oauth-reply', subscription);
      
      // Return a function to remove the listener
      return () => {
        ipcRenderer.removeListener('oauth-reply', subscription);
      };
    }
  },
  
  // Logs functionality
  logs: {
    onMainProcessLog: (callback: (log: { type: string; message: string }) => void) => {
      const listener = (_event: IpcRendererEvent, log: { type: string; message: string }) => {
        callback(log);
      };
      ipcRenderer.on('main-process-log', listener);
      return () => {
        ipcRenderer.removeListener('main-process-log', listener);
      };
    }
  },
  
  // IPC renderer methods for direct communication
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]): Promise<any> => {
      return ipcRenderer.invoke(channel, ...args);
    },
    on: (channel: string, listener: (event: any, ...args: any[]) => void): void => {
      ipcRenderer.on(channel, listener);
    },
    once: (channel: string, listener: (event: any, ...args: any[]) => void): void => {
      ipcRenderer.once(channel, listener);
    },
    removeListener: (channel: string, listener: (event: any, ...args: any[]) => void): void => {
      ipcRenderer.removeListener(channel, listener);
    }
  }
});

// Export empty object to ensure this file is treated as a module
export {}; 