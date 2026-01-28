import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(1); // 1: credentials, 2: OTP
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone_number: ''
  });
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, register, sendOTP, verifyOTP } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        toast.success('Login successful!');
        navigate('/dashboard');
      } else {
        if (step === 1) {
          // Send OTP
          await sendOTP(formData.phone_number);
          toast.success('OTP sent to your phone');
          setStep(2);
        } else {
          // Verify OTP and register
          const otpResult = await verifyOTP(formData.phone_number, otp);
          
          if (otpResult.valid) {
            await register(
              formData.email,
              formData.password,
              formData.full_name,
              formData.phone_number
            );
            toast.success('Registration successful!');
            navigate('/kyc');
          } else {
            toast.error('Invalid OTP');
          }
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Set guest mode
    localStorage.setItem('guest_mode', 'true');
    toast.success('Exploring as guest. Sign up to save your work!');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-obsidian">
      <Card className="w-full max-w-md glass">
        <CardHeader>
          <CardTitle className="text-3xl font-black">
            {isLogin ? 'LOGIN' : step === 1 ? 'REGISTER' : 'VERIFY OTP'}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? 'Sign in to your account'
              : step === 1
              ? 'Create your account'
              : 'Enter the OTP sent to your phone'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 && (
              <>
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">
                      Full Name
                    </label>
                    <Input
                      data-testid="full-name-input"
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                      className="bg-gunmetal border-white/10 text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">
                    Email
                  </label>
                  <Input
                    data-testid="email-input"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="bg-gunmetal border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">
                    Password
                  </label>
                  <Input
                    data-testid="password-input"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={8}
                    className="bg-gunmetal border-white/10 text-white"
                  />
                </div>

                {!isLogin && (
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">
                      Phone Number
                    </label>
                    <PhoneInput
                      data-testid="phone-input"
                      international
                      defaultCountry="US"
                      value={formData.phone_number}
                      onChange={(value) => setFormData({ ...formData, phone_number: value })}
                      className="bg-gunmetal border border-white/10 rounded-sm p-2 text-white"
                    />
                  </div>
                )}
              </>
            )}

            {step === 2 && (
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  OTP Code
                </label>
                <Input
                  data-testid="otp-input"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  className="bg-gunmetal border-white/10 text-white text-center text-2xl tracking-widest"
                />
              </div>
            )}

            <Button
              data-testid="submit-button"
              type="submit"
              disabled={loading}
              className="w-full bg-electric-indigo hover:bg-electric-indigo/90 glow"
            >
              {loading ? 'Processing...' : isLogin ? 'Login' : step === 1 ? 'Send OTP' : 'Verify & Register'}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <button
              data-testid="toggle-mode-button"
              onClick={() => {
                setIsLogin(!isLogin);
                setStep(1);
              }}
              className="text-sm text-slate-400 hover:text-white block w-full"
            >
              {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
            </button>
            
            <button
              data-testid="skip-button"
              onClick={handleSkip}
              className="text-sm text-neon-mint hover:text-neon-mint/80 font-bold"
            >
              Skip & Explore Features →
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
