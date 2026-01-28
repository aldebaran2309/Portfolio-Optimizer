import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('access_token'));
  const [isGuest, setIsGuest] = useState(localStorage.getItem('guest_mode') === 'true');

  useEffect(() => {
    if (token) {
      fetchUser();
    } else if (isGuest) {
      setUser({ guest: true, full_name: 'Guest User' });
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [token, isGuest]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, refresh_token, user: userData } = response.data;
    
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    setToken(access_token);
    setUser(userData);
    
    return userData;
  };

  const register = async (email, password, full_name, phone_number) => {
    const response = await axios.post(`${API}/auth/register`, {
      email,
      password,
      full_name,
      phone_number
    });
    
    const { access_token, refresh_token, user: userData } = response.data;
    
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    setToken(access_token);
    setUser(userData);
    
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('guest_mode');
    setToken(null);
    setUser(null);
    setIsGuest(false);
  };

  const sendOTP = async (phone_number) => {
    const response = await axios.post(`${API}/auth/send-otp`, { phone_number });
    return response.data;
  };

  const verifyOTP = async (phone_number, code) => {
    const response = await axios.post(`${API}/auth/verify-otp`, {
      phone_number,
      code
    });
    return response.data;
  };

  const verifyPhoneNumber = async (phone_number, code) => {
    const response = await axios.post(
      `${API}/auth/verify-phone`,
      { phone_number, code },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    await fetchUser();
    return response.data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        token,
        isGuest,
        login,
        register,
        logout,
        sendOTP,
        verifyOTP,
        verifyPhoneNumber,
        refreshUser: fetchUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
