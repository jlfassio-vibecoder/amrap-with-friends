/**
 * Measure what a live mission costs as the roster grows.
 *
 * Builds one real mission through the same anon RPCs the browser calls --
 * join_mission, log_round, get_mission_live_state -- pausing at each roster
 * checkpoint to time a full snapshot and weigh its bytes. The reconcile added
 * in #165 pulls that snapshot on every client every LIVE_RECONCILE_MS, so the
 * measured payload is the input to the only projection that matters.
 *
 * It writes to whatever project the env points at, and deletes everything it
 * created in a finally block. Run it against production only deliberately.
 *
 *   npx tsx scripts/load-test-roster.ts --checkpoints 10,25,50,100 --rounds 10
 *   npx tsx scripts/load-test-roster.ts --checkpoints 5,10 --rounds 3 --keep
 */
import { readFileSync } from 'node:fs';
import { LIVE_RECONCILE_MS } from '../src/lib/realtime/liveReconcile';
import {
  formatBytes,
  percentile,
  projectReconcileCost,
  projectRoundFanOut,
} from '../src/lib/perf/reconcileCost';

const WORKOUT = [
  { name: 'Air Squats', reps: 10, unit: 'reps' },
  { name: 'Hand-Release Push-ups', reps: 10, unit: 'reps' },
];
const DURATION_MINUTES = 20;
const SEGMENT_INDEX = 0;
/** Concurrent in-flight RPCs. Enough to finish; not enough to look like abuse. */
const CONCURRENCY = 8;
const SNAPSHOT_SAMPLES = 7;

interface Args {
  checkpoints: number[];
  rounds: number;
  keep: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const at = argv.indexOf(flag);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const checkpoints = (get('--checkpoints') ?? '10,25,50,100')
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (checkpoints.length === 0) {
    throw new Error('--checkpoints needs at least one positive integer');
  }
  const rounds = Number.parseInt(get('--rounds') ?? '10', 10);
  if (!Number.isFinite(rounds) || rounds < 0) {
    throw new Error('--rounds must be a non-negative integer');
  }
  return { checkpoints, rounds, keep: argv.includes('--keep') };
}

function readEnv(): { url: string; anonKey: string; serviceKey: string } {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  // .env is the project's own file; process.env wins so CI can override.
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (match && !env[match[1]!]) {
        env[match[1]!] = match[2]!.replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // No .env: rely on the real environment.
  }
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    throw new Error('Need VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY');
  }
  return { url, anonKey, serviceKey };
}

const { url, anonKey, serviceKey } = readEnv();

async function rpc<T>(name: string, body: unknown): Promise<T> {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${name} -> ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  return (await response.json()) as T;
}

/** The snapshot call, measured: wall time and the bytes actually on the wire. */
async function timeSnapshot(
  missionId: string,
  seat: { participantId: string; claimToken: string }
): Promise<{ ms: number; bytes: number; rounds: number; participants: number }> {
  const startedAt = performance.now();
  const response = await fetch(`${url}/rest/v1/rpc/get_mission_live_state`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_mission_id: missionId,
      p_participant_id: seat.participantId,
      p_claim_token: seat.claimToken,
      p_host_token: null,
      p_since: null,
    }),
  });
  const text = await response.text();
  const ms = performance.now() - startedAt;
  if (!response.ok) {
    throw new Error(`get_mission_live_state -> ${response.status} ${text.slice(0, 200)}`);
  }
  const payload = JSON.parse(text) as {
    rounds?: unknown[];
    participants?: unknown[];
  };
  return {
    ms,
    // Byte length, not string length: nicknames are ASCII here but the caller
    // should not have to assume that.
    bytes: Buffer.byteLength(text, 'utf8'),
    rounds: payload.rounds?.length ?? 0,
    participants: payload.participants?.length ?? 0,
  };
}

async function inBatches<T>(items: T[], run: (item: T) => Promise<unknown>): Promise<void> {
  for (let index = 0; index < items.length; index += CONCURRENCY) {
    await Promise.all(items.slice(index, index + CONCURRENCY).map(run));
  }
}

async function deleteAll(missionId: string): Promise<void> {
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  for (const table of [
    'rounds',
    'participant_segment_results',
    'messages',
    'participants',
    'analytics_events',
  ]) {
    await fetch(`${url}/rest/v1/${table}?mission_id=eq.${missionId}`, {
      method: 'DELETE',
      headers,
    });
  }
  await fetch(`${url}/rest/v1/missions?id=eq.${missionId}`, { method: 'DELETE', headers });
}

interface Seat {
  participantId: string;
  claimToken: string;
}

interface Row {
  roster: number;
  rounds: number;
  bytes: number;
  p50: number;
  p95: number;
}

/**
 * One checkpoint gets its own mission, because join_mission refuses a roster
 * once the clock is running ("Mission locked"). Filling a single mission
 * incrementally would therefore have to start it before the last athletes
 * arrived -- so each size is built, started, logged and weighed on its own.
 */
async function runCheckpoint(roster: number, rounds: number, created: string[]): Promise<Row> {
  const host = await rpc<{
    mission_id: string;
    host_token: string;
    participant_id: string;
    claim_token: string;
  }>('create_mission', {
    p_duration_minutes: DURATION_MINUTES,
    p_nickname: 'loadtest-host',
    p_workout: WORKOUT,
    p_template_id: null,
    p_intensity_tier: null,
    p_scheduled_at: null,
    p_timezone: 'UTC',
  });
  const missionId = host.mission_id;
  created.push(missionId);

  const seats: Seat[] = [{ participantId: host.participant_id, claimToken: host.claim_token }];
  await inBatches([...Array(Math.max(0, roster - 1)).keys()], async (index) => {
    const joined = await rpc<{ participant_id: string; claim_token: string }>('join_mission', {
      p_mission_id: missionId,
      p_nickname: `athlete-${index}`,
    });
    seats.push({ participantId: joined.participant_id, claimToken: joined.claim_token });
  });

  // log_round only writes while the mission is running, and join_mission only
  // works before it is -- so the roster has to be complete before this line.
  await rpc('update_mission_state', {
    p_mission_id: missionId,
    p_host_token: host.host_token,
    p_state: 'work',
    p_time_left_sec: DURATION_MINUTES * 60,
    p_is_paused: false,
    p_started_at: new Date().toISOString(),
  });

  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    await inBatches(seats, async (seat) => {
      // log_round answers with ok:false rather than an HTTP error, so a refusal
      // is silent unless it is read. A measurement built on rounds that were
      // never written is worse than no measurement.
      const result = await rpc<{ ok: boolean; reason?: string }>('log_round', {
        p_mission_id: missionId,
        p_participant_id: seat.participantId,
        p_claim_token: seat.claimToken,
        p_round_index: roundIndex,
        p_elapsed_sec_at_round: (roundIndex + 1) * 30,
        p_segment_index: SEGMENT_INDEX,
        p_missed_log_reps: null,
      });
      if (result.ok !== true) {
        throw new Error(`log_round refused: ${result.reason ?? 'unknown'}`);
      }
    });
  }

  const samples = [];
  for (let sample = 0; sample < SNAPSHOT_SAMPLES; sample += 1) {
    samples.push(await timeSnapshot(missionId, seats[0]!));
  }
  const last = samples[samples.length - 1]!;
  if (last.participants !== seats.length || last.rounds !== seats.length * rounds) {
    throw new Error(
      `snapshot disagrees with the roster we built: expected ${seats.length} participants ` +
        `and ${seats.length * rounds} rounds, got ${last.participants} and ${last.rounds}`
    );
  }

  return {
    roster: last.participants,
    rounds: last.rounds,
    bytes: last.bytes,
    p50: percentile(
      samples.map((s) => s.ms),
      50
    ),
    p95: percentile(
      samples.map((s) => s.ms),
      95
    ),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log(`project      ${url}`);
  console.log(`checkpoints  ${args.checkpoints.join(', ')}`);
  console.log(`rounds each  ${args.rounds}`);
  console.log('');

  const created: string[] = [];
  const rows: Row[] = [];

  try {
    for (const checkpoint of args.checkpoints) {
      const row = await runCheckpoint(checkpoint, args.rounds, created);
      rows.push(row);
      console.log(
        `  roster ${String(row.roster).padStart(4)}  ` +
          `rounds ${String(row.rounds).padStart(5)}  ` +
          `snapshot ${formatBytes(row.bytes).padStart(9)}  ` +
          `p50 ${row.p50.toFixed(0).padStart(4)}ms  ` +
          `p95 ${row.p95.toFixed(0).padStart(4)}ms`
      );
    }

    console.log('');
    console.log(
      `Projected per ${DURATION_MINUTES}-minute mission, reconcile every ${
        LIVE_RECONCILE_MS / 1000
      }s:`
    );
    console.log('  roster   snapshot    pulls        egress   realtime msgs');
    for (const row of rows) {
      const cost = projectReconcileCost({
        snapshotBytes: row.bytes,
        participants: row.roster,
        missionMinutes: DURATION_MINUTES,
        reconcileMs: LIVE_RECONCILE_MS,
      });
      const fanOut = projectRoundFanOut(row.roster, args.rounds);
      console.log(
        `  ${String(row.roster).padStart(6)}   ${formatBytes(row.bytes).padStart(8)}   ` +
          `${String(cost.totalSnapshots).padStart(6)}   ${formatBytes(cost.totalBytes).padStart(10)}   ` +
          `${fanOut.toLocaleString('en-US').padStart(13)}`
      );
    }
  } finally {
    if (args.keep) {
      console.log(`\n--keep: left ${created.length} mission(s): ${created.join(', ')}`);
    } else {
      console.log('\ncleaning up...');
      for (const missionId of created) {
        await deleteAll(missionId);
      }
      console.log(`deleted ${created.length} mission(s) and everything under them.`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
