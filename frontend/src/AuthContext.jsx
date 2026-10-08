import { createContext, useContext, useState, useCallback } from 'react';
import api, { session } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(session.user);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    session.save(data.data);
    setUser(data.data.user);
  }, []);

  const register = useCallback(async (form) => {
    const { data } = await api.post('/auth/register', form);
    session.save(data.data);
    setUser(data.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* token may already be expired - we still log out locally */
    }
    session.clear();
    setUser(null);
  }, []);

  const isStaff = user?.role === 'admin' || user?.role === 'doctor';

  return <AuthContext.Provider value={{ user, isStaff, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
