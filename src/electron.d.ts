export interface IpcBridge {
  auth: {
    generateSessionId: () => Promise<string>;
    openAuthWindow: (sessionId: string) => Promise<string>;
    signInWithToken: (token: string) => Promise<{
      user: {
        uid: string;
        email: string | null;
        displayName: string | null;
        photoURL: string | null;
        emailVerified: boolean;
      }
    }>;
    onTokenReceived: (callback: (data: { token: string; user: any }) => void) => () => void;
    // Google OAuth methods
    googleAuth: (authUrl: string) => void;
    onOAuthReply: (callback: (code: string) => void) => () => void;
  };
  logs?: {
    onMainProcessLog: (callback: (log: { type: string; message: string }) => void) => () => void;
  };
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
    once: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
    removeListener: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  };
}

declare global {
  interface Window {
    electron: IpcBridge;
  }
} 