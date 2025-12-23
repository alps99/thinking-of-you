import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { authApi } from '../lib/api';
import type { User, Family } from '../types';

interface AuthContextType {
  user: User | null;
  family: Family | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (account: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, familyName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setUser(null);
        setFamily(null);
        return;
      }

      const { user, family } = await authApi.me();
      setUser(user);
      setFamily(family);
    } catch {
      localStorage.removeItem('access_token');
      setUser(null);
      setFamily(null);
    }
  };

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, []);

  const login = async (account: string, password: string) => {
    const { user, family } = await authApi.login({ account, password });
    setUser(user);
    setFamily(family);
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    familyName: string
  ) => {
    const { user, family } = await authApi.register({
      email,
      password,
      name,
      familyName,
    });
    setUser(user);
    setFamily(family);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    setFamily(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        family,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
