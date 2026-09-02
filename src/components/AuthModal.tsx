import { AuthForm, type PasswordMode } from '@/components/AuthForm';

interface AuthModalProps {
  onClose: () => void;
  /** Open on password Sign in or Create account. Defaults to sign-in. */
  initialPasswordMode?: PasswordMode;
  /**
   * False where an account is genuinely required (squad, campaigns), so the
   * modal stops telling people signing in that it was optional.
   */
  guestAllowed?: boolean;
  /** Defaults to onClose. Header Create account uses this to send missing profiles to intake. */
  onAuthenticated?: () => void;
}

export function AuthModal({
  onClose,
  initialPasswordMode = 'sign-in',
  guestAllowed = true,
  onAuthenticated = onClose,
}: AuthModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={onClose}
    >
      <div className="card w-full max-w-sm p-6" onClick={(event) => event.stopPropagation()}>
        <AuthForm
          titleId="auth-modal-title"
          onClose={onClose}
          onAuthenticated={onAuthenticated}
          initialPasswordMode={initialPasswordMode}
          guestAllowed={guestAllowed}
        />
      </div>
    </div>
  );
}
