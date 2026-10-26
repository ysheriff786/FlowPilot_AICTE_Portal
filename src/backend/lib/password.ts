const COMMON = ['password', 'password123', '123456789012', 'qwertyuiop', 'letmein12345', 'admin12345678', 'welcome123456'];

export const validatePassword = (password: string, email?: string): string | null => {
  if (password.length < 12) return 'Password must be at least 12 characters';
  if (email && password.toLowerCase() === email.toLowerCase()) return 'Password must not equal your email';
  if (COMMON.includes(password.toLowerCase())) return 'Password is too common';
  return null;
};