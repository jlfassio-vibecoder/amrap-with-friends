import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';

const CreateSessionPage = lazy(() => import('./pages/CreateSessionPage'));
const JoinSessionPage = lazy(() => import('./pages/JoinSessionPage'));
const SessionWaitingRoomPage = lazy(() => import('./pages/SessionWaitingRoomPage'));
const MySessionsPage = lazy(() => import('./pages/MySessionsPage'));
const TimerDevPage = lazy(() => import('./pages/dev/TimerDevPage'));

function RouteFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-sm text-gray-600">
      Loading…
    </main>
  );
}

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreateSessionPage />} />
        <Route path="/join" element={<JoinSessionPage />} />
        <Route path="/session/:sessionId" element={<SessionWaitingRoomPage />} />
        <Route path="/my-sessions" element={<MySessionsPage />} />
        {import.meta.env.DEV && <Route path="/dev/timer" element={<TimerDevPage />} />}
      </Routes>
    </Suspense>
  );
}

export default App;
