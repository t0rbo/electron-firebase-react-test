import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, startAuthFlow } from '../services/authService';

// Feature detection to check if we're in Electron or browser
const isElectron = () => {
  return window && window.electron && window.electron.auth;
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing user on mount
  useEffect(() => {
    // Here you could check for a stored user in localStorage or electron-store
    try {
      // Attempt to load user from localStorage in web environment
      if (!isElectron()) {
        const savedUser = localStorage.getItem('auth_user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      }
    } catch (e) {
      console.error('Error loading saved user:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Starting authentication flow...');
      
      // Start the authentication flow - this will handle both web and Electron environments
      const user = await startAuthFlow();
      
      console.log('Authentication successful:', user.displayName);
      
      // Save the user
      setUser(user);
      
      // Save user to localStorage in web environment
      if (!isElectron() && user) {
        localStorage.setItem('auth_user', JSON.stringify(user));
      }
      
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Clear the user
    setUser(null);
    
    // Clear from localStorage in web environment
    if (!isElectron()) {
      localStorage.removeItem('auth_user');
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 