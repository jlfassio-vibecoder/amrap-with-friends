import { useContext } from 'react';
import { AmrapAuthContext } from '@/contexts/AmrapAuthContext';

export function useAmrapAuth() {
  const context = useContext(AmrapAuthContext);
  if (!context) {
    throw new Error('useAmrapAuth must be used within AmrapAuthProvider');
  }
  return context;
}
