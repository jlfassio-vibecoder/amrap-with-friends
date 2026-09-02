import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { FeaturedWodCard } from '@/components/home/FeaturedWodCard';
import { GlobalPresenceBroadcaster } from '@/components/GlobalPresenceBroadcaster';
import { PasswordRecoveryRedirect } from '@/components/PasswordRecoveryRedirect';
import { RequireIntake } from '@/components/RequireIntake';
import { RequireCoach } from '@/components/RequireCoach';
import { useSeo } from '@/hooks/useSeo';

const CreateMissionPage = lazy(() => import('./pages/CreateMissionPage'));
const JoinMissionPage = lazy(() => import('./pages/JoinMissionPage'));
const MissionWaitingRoomPage = lazy(() => import('./pages/MissionWaitingRoomPage'));
const RallyPointPage = lazy(() => import('./pages/RallyPointPage'));
const MyMissionsPage = lazy(() => import('./pages/MyMissionsPage'));
const CreateCampaignPage = lazy(() => import('./pages/CreateCampaignPage'));
const CampaignDetailPage = lazy(() => import('./pages/CampaignDetailPage'));
const JoinCampaignPage = lazy(() => import('./pages/JoinCampaignPage'));
const SquadPage = lazy(() => import('./pages/SquadPage'));
const JoinSquadPage = lazy(() => import('./pages/JoinSquadPage'));
const HUDPage = lazy(() => import('./pages/HUDPage'));
const IntakePage = lazy(() => import('./pages/IntakePage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const CoachPage = lazy(() => import('./pages/CoachPage'));
const CoachWodsPage = lazy(() => import('./pages/CoachWodsPage'));
const TimerDevPage = lazy(() => import('./pages/dev/TimerDevPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function RouteFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-sm text-secondary">
      Loading…
    </main>
  );
}

function App() {
  useSeo();

  return (
    <>
      <GlobalPresenceBroadcaster />
      <PasswordRecoveryRedirect />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            path="/create"
            element={
              <RequireIntake guestMode="sign-in" signedOutPreview={<FeaturedWodCard />}>
                <CreateMissionPage />
              </RequireIntake>
            }
          />
          <Route path="/join" element={<JoinMissionPage />} />
          <Route path="/rally-point/:rallyPointId" element={<RallyPointPage />} />
          {/* Public: the invite preview is what convinces someone to sign up,
              so it must render before the auth gate. */}
          <Route path="/campaign/join" element={<JoinCampaignPage />} />
          <Route
            path="/campaign/new"
            element={
              <RequireIntake
                guestMode="sign-in"
                gateTitle="New campaign"
                gateMessage="Sign in and set up your profile to plan a campaign. Campaigns track weeks of work, so they need an account."
                gateAllowsGuest={false}
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
                gateAllowsGuest={false}
              >
                <CampaignDetailPage />
              </RequireIntake>
            }
          />
          <Route path="/squad/join" element={<JoinSquadPage />} />
          <Route
            path="/squad"
            element={
              <RequireIntake
                guestMode="sign-in"
                gateTitle="Your squad"
                gateMessage="Sign in and set up your profile to invite people to your squad."
                gateAllowsGuest={false}
              >
                <SquadPage />
              </RequireIntake>
            }
          />
          <Route path="/mission/:missionId" element={<MissionWaitingRoomPage />} />
          <Route path="/my-missions" element={<MyMissionsPage />} />
          <Route path="/intake" element={<IntakePage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
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
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
