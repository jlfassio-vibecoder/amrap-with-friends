import { Link } from 'react-router-dom';
import { AuthHeaderActions } from '@/components/AuthHeaderActions';

function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="absolute right-6 top-6">
        <AuthHeaderActions />
      </div>
      <h1 className="text-display text-4xl text-ink">AMRAP With Friends</h1>
      <div className="flex gap-4">
        <Link className="btn-primary" to="/create">
          Create session
        </Link>
        <Link className="btn-outline" to="/join">
          Join session
        </Link>
      </div>
    </main>
  );
}

export default HomePage;
