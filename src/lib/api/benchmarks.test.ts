import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/lib/supabase';
import {
  designateBenchmark,
  fetchBenchmarkOverview,
  fetchMyBenchmarks,
  parseAthleteBenchmark,
  personalBenchmarkSlots,
  retireBenchmark,
} from '@/lib/api/benchmarks';

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
  getSupabaseClient: vi.fn(),
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));

const rpcMock = vi.mocked(supabase.rpc);

beforeEach(() => {
  rpcMock.mockReset();
});

const ROW = {
  id: 'b1',
  template_id: 'the-valve',
  duration_minutes: 10,
  time_domain: 10,
  version_key: '',
  movement_variants: {},
  designated_at: '2026-01-01T10:00:00.000Z',
  retired_at: null,
};

describe('designateBenchmark', () => {
  it('sends the workout, the clock and the domain it claims', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, benchmark: ROW }, error: null } as never);

    const result = await designateBenchmark({
      templateId: 'the-valve',
      durationMinutes: 10,
      timeDomain: 10,
    });

    expect(rpcMock).toHaveBeenCalledWith('designate_benchmark', {
      p_template_id: 'the-valve',
      p_duration_minutes: 10,
      p_time_domain: 10,
      p_version_key: '',
      p_movement_variants: {},
    });
    expect(result.data?.id).toBe('b1');
  });

  it('stores the modification itself, not only its fingerprint', () => {
    // version_key is what attempts are matched on, but it is a one-way
    // fingerprint. Seeding a retest needs the selection back.
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        benchmark: {
          ...ROW,
          version_key: 'Diamond Push-ups#push-up--knees',
          movement_variants: { 'Diamond Push-ups': 'push-up--knees' },
        },
      },
      error: null,
    } as never);

    return designateBenchmark({
      templateId: 'the-valve',
      durationMinutes: 10,
      timeDomain: 10,
      versionKey: 'Diamond Push-ups#push-up--knees',
      movementVariants: { 'Diamond Push-ups': 'push-up--knees' },
    }).then((result) => {
      expect(rpcMock).toHaveBeenCalledWith(
        'designate_benchmark',
        expect.objectContaining({
          p_movement_variants: { 'Diamond Push-ups': 'push-up--knees' },
        })
      );
      expect(result.data?.movementVariants).toEqual({
        'Diamond Push-ups': 'push-up--knees',
      });
    });
  });

  it('says what to do about a full slate rather than just failing', async () => {
    rpcMock.mockResolvedValue({ data: { ok: false, reason: 'at_limit' }, error: null } as never);
    const result = await designateBenchmark({
      templateId: 'the-valve',
      durationMinutes: 10,
      timeDomain: 10,
    });
    expect(result.error?.message).toMatch(/Retire one first/);
  });

  it('explains why a coach workout is refused', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, reason: 'coach_workout' },
      error: null,
    } as never);
    const result = await designateBenchmark({
      templateId: 'coach:abc',
      durationMinutes: 10,
      timeDomain: 10,
    });
    expect(result.error?.message).toMatch(/change one underneath you/);
  });

  it('does not leak a reason string this build does not recognise', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, reason: 'some_future_reason' },
      error: null,
    } as never);
    const result = await designateBenchmark({
      templateId: 'the-valve',
      durationMinutes: 10,
      timeDomain: 10,
    });
    expect(result.error?.message).toBe('Something went wrong. Please try again.');
  });

  it('asks a signed-out athlete to sign in', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Authentication required' },
    } as never);
    const result = await designateBenchmark({
      templateId: 'the-valve',
      durationMinutes: 10,
      timeDomain: 10,
    });
    expect(result.error?.message).toBe('Sign in to keep benchmarks.');
  });
});

describe('fetchMyBenchmarks', () => {
  it('returns retired benchmarks too — they keep their history', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        benchmarks: [ROW, { ...ROW, id: 'b2', retired_at: '2026-03-01T10:00:00.000Z' }],
      },
      error: null,
    } as never);

    const result = await fetchMyBenchmarks();
    expect(result.data).toHaveLength(2);
    expect(result.data?.[1].retiredAt).toBe('2026-03-01T10:00:00.000Z');
  });

  it('drops a malformed row rather than failing the whole list', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, benchmarks: [ROW, { id: 'b2' }, { ...ROW, time_domain: 7 }] },
      error: null,
    } as never);

    const result = await fetchMyBenchmarks();
    expect(result.data).toHaveLength(1);
  });
});

describe('retireBenchmark', () => {
  it('reports an already-retired benchmark as such', async () => {
    rpcMock.mockResolvedValue({ data: { ok: false, reason: 'not_found' }, error: null } as never);
    const result = await retireBenchmark('b1');
    expect(result.ok).toBe(false);
    expect(result.error?.message).toMatch(/already retired/);
  });
});

describe('personalBenchmarkSlots', () => {
  it('holds a slot for a live benchmark', () => {
    const benchmark = parseAthleteBenchmark(ROW);
    expect(personalBenchmarkSlots([benchmark!])).toEqual([
      { domain: 10, source: 'personal', templateId: 'the-valve', durationMinutes: 10 },
    ]);
  });

  it('holds nothing for a retired one', () => {
    const retired = parseAthleteBenchmark({ ...ROW, retired_at: '2026-03-01T10:00:00.000Z' });
    expect(personalBenchmarkSlots([retired!])).toEqual([]);
  });
});

describe('fetchBenchmarkOverview', () => {
  it('leaves attempts off by default, for the rally point', () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, benchmarks: [ROW], campaigns: [], attempts: [] },
      error: null,
    } as never);

    return fetchBenchmarkOverview().then((result) => {
      expect(rpcMock).toHaveBeenCalledWith('benchmark_overview', {
        p_include_attempts: false,
      });
      expect(result.data?.benchmarks).toHaveLength(1);
      expect(result.data?.attempts).toEqual([]);
    });
  });

  it('asks for attempts when the card needs a series', () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        benchmarks: [],
        campaigns: [],
        attempts: [
          {
            mission_id: 'm1',
            template_id: 'the-valve',
            duration_minutes: 10,
            created_at: '2026-01-01T10:00:00.000Z',
            scheduled_at: null,
            final_score: 142,
            modified_movements: ['Diamond Push-ups'],
            movement_variants: { 'Diamond Push-ups': 'push-up--knees' },
          },
        ],
      },
      error: null,
    } as never);

    return fetchBenchmarkOverview(true).then((result) => {
      expect(rpcMock).toHaveBeenCalledWith('benchmark_overview', { p_include_attempts: true });
      expect(result.data?.attempts[0]).toEqual({
        missionId: 'm1',
        templateId: 'the-valve',
        durationMinutes: 10,
        createdAt: '2026-01-01T10:00:00.000Z',
        scheduledAt: null,
        finalScore: 142,
        modifiedMovements: ['Diamond Push-ups'],
        movementVariants: { 'Diamond Push-ups': 'push-up--knees' },
      });
    });
  });

  it('returns campaign schedules raw, for deriveCampaignRoles to read', () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        benchmarks: [],
        campaigns: [
          {
            name: 'Winter',
            status: 'active',
            schedule: [
              { week_number: 1, template_id: 'the-hemodynamic', duration_minutes: 10 },
              { week_number: 2, template_id: null, duration_minutes: 10 },
            ],
          },
        ],
        attempts: [],
      },
      error: null,
    } as never);

    return fetchBenchmarkOverview().then((result) => {
      expect(result.data?.campaigns[0]).toEqual({
        name: 'Winter',
        status: 'active',
        schedule: [
          { weekNumber: 1, templateId: 'the-hemodynamic', durationMinutes: 10 },
          { weekNumber: 2, templateId: null, durationMinutes: 10 },
        ],
      });
    });
  });

  it('drops a malformed row rather than failing the whole overview', () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        benchmarks: [ROW, { id: 'broken' }],
        campaigns: [{ status: 'active' }],
        attempts: [{ mission_id: 'm1' }],
      },
      error: null,
    } as never);

    return fetchBenchmarkOverview(true).then((result) => {
      expect(result.data?.benchmarks).toHaveLength(1);
      expect(result.data?.campaigns).toEqual([]);
      expect(result.data?.attempts).toEqual([]);
    });
  });

  it('asks a signed-out athlete to sign in', () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Authentication required' },
    } as never);
    return fetchBenchmarkOverview().then((result) => {
      expect(result.error?.message).toBe('Sign in to keep benchmarks.');
    });
  });
});
