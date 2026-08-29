import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import { FeaturedWodCard } from '@/components/home/FeaturedWodCard';
import { GlobalPresenceBroadcaster } from '@/components/GlobalPresenceBroadcaster';
import { RequireIntake } from '@/components/RequireIntake';
import { RequireCoach } from '@/components/RequireCoach';

const CreateSessionPage = lazy(() => import('./pages/CreateSessionPage'));
const JoinSessionPage = lazy(() => import('./pages/JoinSessionPage'));
const SessionWaitingRoomPage = lazy(() => import('./pages/SessionWaitingRoomPage'));
const MySessionsPage = lazy(() => import('./pages/MySessionsPage'));
const CreateCampaignPage = lazy(() => import('./pages/CreateCampaignPage'));
const CampaignDetailPage = lazy(() => import('./pages/CampaignDetailPage'));
const HUDPage = lazy(() => import('./pages/HUDPage'));
const IntakePage = lazy(() => import('./pages/IntakePage'));
const CoachPage = lazy(() => import('./pages/CoachPage'));
const CoachWodsPage = lazy(() => import('./pages/CoachWodsPage'));
const TimerDevPage = lazy(() => import('./pages/dev/TimerDevPage'));

function RouteFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-sm text-secondary">
      Loading…
    </main>
  );
}

function App() {
  return (
    <>
      <GlobalPresenceBroadcaster />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/create"
            element={
              <RequireIntake guestMode="sign-in" signedOutPreview={<FeaturedWodCard />}>
                <CreateSessionPage />
              </RequireIntake>
            }
          />
          <Route path="/join" element={<JoinSessionPage />} />
          <Route
            path="/campaign/new"
            element={
              <RequireIntake
                guestMode="sign-in"
                gateTitle="New campaign"
                gateMessage="Sign in and set up your profile to plan a campaign. Campaigns track weeks of work, so they need an account."
              >
                <CreateCampaignPage />
              </RequireIntake>
            }
          />
          <Route
            path="/campaign/:campaignId"
            element={
              <RequireIntake
                guestMode="sign-in"
                gateTitle="Campaign"
                gateMessage="Sign in to see this campaign. Campaigns are only visible to the crew training them."
              >
                <CampaignDetailPage />
              </RequireIntake>
            }
          />
          <Route path="/session/:sessionId" element={<SessionWaitingRoomPage />} />
          <Route path="/my-sessions" element={<MySessionsPage />} />
          <Route path="/intake" element={<IntakePage />} />
          <Route
            path="/hud"
            element={
              // Copilot suggestion ignored: passthrough keeps HUDPage guest copy; RequireIntake still redirects signed-in users missing a dossier.
              <RequireIntake guestMode="passthrough">
                <HUDPage />
              </RequireIntake>
            }
          />
          <Route
            path="/coach"
            element={
              <RequireCoach>
                <CoachPage />
              </RequireCoach>
            }
          />
          <Route
            path="/coach/wods"
            element={
              <RequireCoach>
                <CoachWodsPage />
              </RequireCoach>
            }
          />
          {import.meta.env.DEV && <Route path="/dev/timer" element={<TimerDevPage />} />}
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
