import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { HeroLogoDissolve } from '@/components/home/HeroLogoDissolve';
import { HostScheduledMissionsPanel } from '@/components/mission/HostScheduledMissionsPanel';

interface LandingHeroProps {
  /** Signed-in athletes get a route into the HUD alongside the sign-up CTA. */
  showHudAction: boolean;
}

/**
 * The landing page's dark block: the nav sits inside the hero's night ground
 * rather than on the app's light chrome, so the two read as one panel.
 */
export function LandingHero({ showHudAction }: LandingHeroProps) {
  return (
    <div className="night-panel relative isolate overflow-hidden bg-night text-night-ink">
      <AppHeader title="AMRAP With Friends" hidePageTitle tone="night" />

      <section className="mx-auto grid w-full max-w-[1240px] items-center gap-8 px-6 pb-10 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:px-10 lg:pb-16 lg:pt-16">
        <div>
          <h1 className="landing-headline text-[clamp(3.5rem,10vw,8rem)] text-night-ink">
            AMRAP With Friends
          </h1>
          <p className="landing-headline mt-4 text-[clamp(1.35rem,3.2vw,2.05rem)] tracking-[0.02em] text-gold">
            Stronger Together. Move as one.
          </p>
          <p className="mt-6 max-w-[26rem] text-[15px] leading-[1.6] text-night-secondary">
            Training is hard. Showing up alone is harder. Bring your squad, lock in a shared
            mission, and earn the kind of progress that only happens together.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Link
              className="rounded-card bg-accent px-6 py-3.5 font-semibold text-on-accent hover:bg-accent-hover"
              to="/create"
            >
              Create mission
            </Link>
            <Link
              className="rounded-card bg-accent px-6 py-3.5 font-semibold text-on-accent hover:bg-accent-hover"
              to="/squad"
            >
              Invite your squad →
            </Link>
            <Link
              className="border-b border-gold pb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-night-ink hover:text-gold"
              to="/join"
            >
              Join a mission
            </Link>
            {showHudAction ? (
              <Link
                className="border-b border-gold pb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-night-ink hover:text-gold"
                to="/hud"
              >
                Open your HUD
              </Link>
            ) : null}
          </div>
        </div>

        <div className="-mx-2 lg:mx-0">
          <HeroLogoDissolve />
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1240px] px-6 pb-14 lg:px-10 lg:pb-20">
        <div className="rounded-card border border-night-border bg-surface p-5 text-ink shadow-card">
          <HostScheduledMissionsPanel />
        </div>
      </div>
    </div>
  );
}
