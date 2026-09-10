import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

/**
 * When Supabase fires PASSWORD_RECOVERY (hash token consumed on any SPA path),
 * send the athlete to the set-new-password page.
 */
export function PasswordRecoveryRedirect() {
  const { isPasswordRecovery, isAuthLoading } = useAmrapAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthLoading || !isPasswordRecovery) {
      return;
    }
    if (location.pathname === '/reset-password') {
      return;
    }
    navigate('/reset-password', { replace: true });
  }, [isAuthLoading, isPasswordRecovery, location.pathname, navigate]);

  return null;
}
