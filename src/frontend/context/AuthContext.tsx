import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { TOKEN_KEY, USER_KEY } from '../services/api';

export type UserRole = 'COLLEGE' | 'OFFICER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  institutionId?: string | null;
  institution?: { id: string; name: string; type: string } | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readStoredUser = (): User | null => {
  const saved = localStorage.getItem(USER_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as User;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken) {
      logout();
      return;
    }

    try {
      const response = await api.get<User>('/auth/me');
      setUser(response.data);
      setToken(currentToken);
      localStorage.setItem(USER_KEY, JSON.stringify(response.data));
    } catch {
      logout();
    }
  }, [logout]);

  useEffect(() => {
    // Show the cached profile immediately, then confirm the token with the API.
    const stored = readStoredUser();
    if (stored) setUser(stored);

    const bootstrap = async () => {
      if (localStorage.getItem(TOKEN_KEY)) {
        await refreshUser();
      }
      setIsLoading(false);
    };

    bootstrap();

    const onUnauthorized = () => logout();
    window.addEventListener('flowpilot:unauthorized', onUnauthorized);
    return () => window.removeEventListener('flowpilot:unauthorized', onUnauthorized);
  }, [refreshUser, logout]);

  const login = (newToken: string, userData: User) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
