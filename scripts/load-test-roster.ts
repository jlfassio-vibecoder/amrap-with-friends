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
  direct: boolean;
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
  return {
    checkpoints,
    rounds,
    keep: argv.includes('--keep'),
    direct: argv.includes('--direct'),
  };
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

/** Time one RPC and weigh what actually came back on the wire. */
async function measure(
  name: string,
  body: unknown
): Promise<{ ms: number; bytes: number; payload: Record<string, unknown> }> {
  const startedAt = performance.now();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const ms = performance.now() - startedAt;
  if (!response.ok) {
    throw new Error(`${name} -> ${response.status} ${text.slice(0, 200)}`);
  }
  return {
    ms,
    // Byte length, not string length: nicknames are ASCII here but the caller
    // should not have to assume that.
    bytes: Buffer.byteLength(text, 'utf8'),
    payload: JSON.parse(text) as Record<string, unknown>,
  };
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

/**
 * Seed the roster straight into the tables with the service role.
 *
 * join_mission refuses the 101st seat -- session_participant_limit() is a
 * hard-coded 100 -- so measuring past that through the front door would mean
 * changing production. The question above 100 is about the read path, which
 * does not care how the rows arrived: get_mission_live_state and
 * get_mission_round_counts read participants and rounds, not the RPC that
 * wrote them.
 *
 * This deliberately does NOT measure join_mission or log_round at scale, and
 * says so in the output, because those are the writes it skips.
 */
async function seedDirect(
  missionId: string,
  roster: number,
  rounds: number,
  existing: number
): Promise<void> {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  const ids: string[] = [];
  const CHUNK = 500;
  const toCreate = Math.max(0, roster - existing);

  for (let offset = 0; offset < toCreate; offset += CHUNK) {
    const batch = Array.from({ length: Math.min(CHUNK, toCreate - offset) }, (_, index) => ({
      mission_id: missionId,
      nickname: `athlete-${offset + index}`,
      role: 'joiner',
    }));
    const response = await fetch(`${url}/rest/v1/participants?select=id`, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`seed participants -> ${response.status} ${text.slice(0, 200)}`);
    }
    for (const row of JSON.parse(text) as Array<{ id: string }>) {
      ids.push(row.id);
    }
  }

  const roundRows: Array<Record<string, unknown>> = [];
  for (const participantId of ids) {
    for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
      roundRows.push({
        mission_id: missionId,
        participant_id: participantId,
        round_index: roundIndex,
        elapsed_sec_at_round: (roundIndex + 1) * 30,
        segment_index: SEGMENT_INDEX,
      });
    }
  }
  for (let offset = 0; offset < roundRows.length; offset += CHUNK) {
    const response = await fetch(`${url}/rest/v1/rounds`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(roundRows.slice(offset, offset + CHUNK)),
    });
    if (!response.ok) {
      throw new Error(`seed rounds -> ${response.status} ${(await response.text()).slice(0, 200)}`);
    }
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
  /** The reconcile's actual per-interval call after the counts change. */
  countsBytes: number;
  countsP50: number;
}

/**
 * One checkpoint gets its own mission, because join_mission refuses a roster
 * once the clock is running ("Mission locked"). Filling a single mission
 * incrementally would therefore have to start it before the last athletes
 * arrived -- so each size is built, started, logged and weighed on its own.
 */
async function runCheckpoint(
  roster: number,
  rounds: number,
  created: string[],
  direct: boolean
): Promise<Row> {
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
  let seededRounds = 0;

  if (direct) {
    await seedDirect(missionId, roster, rounds, seats.length);
    seededRounds = (roster - seats.length) * rounds;
  } else {
    await inBatches([...Array(Math.max(0, roster - 1)).keys()], async (index) => {
      const joined = await rpc<{ participant_id: string; claim_token: string }>('join_mission', {
        p_mission_id: missionId,
        p_nickname: `athlete-${index}`,
      });
      seats.push({ participantId: joined.participant_id, claimToken: joined.claim_token });
    });
  }

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
  const countsSamples: Array<{ ms: number; bytes: number }> = [];
  for (let sample = 0; sample < SNAPSHOT_SAMPLES; sample += 1) {
    samples.push(await timeSnapshot(missionId, seats[0]!));
    const counts = await measure('get_mission_round_counts', {
      p_mission_id: missionId,
      p_participant_id: seats[0]!.participantId,
      p_claim_token: seats[0]!.claimToken,
      p_host_token: null,
    });
    if (counts.payload.ok !== true) {
      throw new Error(`get_mission_round_counts refused: ${String(counts.payload.reason)}`);
    }
    const listed = (counts.payload.counts as unknown[]).length;
    const expectedSeats = direct ? roster : seats.length;
    if (listed !== expectedSeats) {
      throw new Error(`counts listed ${listed} seats, expected ${expectedSeats}`);
    }
    countsSamples.push({ ms: counts.ms, bytes: counts.bytes });
  }
  const last = samples[samples.length - 1]!;
  const expectedParticipants = direct ? roster : seats.length;
  const expectedRounds = seededRounds + seats.length * rounds;
  if (last.participants !== expectedParticipants || last.rounds !== expectedRounds) {
    throw new Error(
      `snapshot disagrees with the roster we built: expected ${expectedParticipants} participants ` +
        `and ${expectedRounds} rounds, got ${last.participants} and ${last.rounds}`
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
    countsBytes: countsSamples[countsSamples.length - 1]!.bytes,
    countsP50: percentile(
      countsSamples.map((s) => s.ms),
      50
    ),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log(`project      ${url}`);
  console.log(`checkpoints  ${args.checkpoints.join(', ')}`);
  console.log(`rounds each  ${args.rounds}`);
  if (args.direct) {
    console.log('mode         --direct: rows seeded past the join cap; read path only');
  }
  console.log('');

  const created: string[] = [];
  const rows: Row[] = [];

  try {
    for (const checkpoint of args.checkpoints) {
      const row = await runCheckpoint(checkpoint, args.rounds, created, args.direct);
      rows.push(row);
      console.log(
        `  roster ${String(row.roster).padStart(4)}  ` +
          `rounds ${String(row.rounds).padStart(5)}  ` +
          `snapshot ${formatBytes(row.bytes).padStart(9)} ${row.p50.toFixed(0).padStart(4)}ms  ` +
          `counts ${formatBytes(row.countsBytes).padStart(8)} ${row.countsP50
            .toFixed(0)
            .padStart(4)}ms`
      );
    }

    console.log('');
    console.log(
      `Projected per ${DURATION_MINUTES}-minute mission, reconcile every ${
        LIVE_RECONCILE_MS / 1000
      }s:`
    );
    console.log('  roster    pulls   was (snapshot)   now (counts)   realtime msgs');
    for (const row of rows) {
      const was = projectReconcileCost({
        snapshotBytes: row.bytes,
        participants: row.roster,
        missionMinutes: DURATION_MINUTES,
        reconcileMs: LIVE_RECONCILE_MS,
      });
      // Steady state: the counts agree, so no snapshot follows. A mission that
      // actually drops rows pays one snapshot per hole on top of this.
      const now = projectReconcileCost({
        snapshotBytes: row.countsBytes,
        participants: row.roster,
        missionMinutes: DURATION_MINUTES,
        reconcileMs: LIVE_RECONCILE_MS,
      });
      const fanOut = projectRoundFanOut(row.roster, args.rounds);
      console.log(
        `  ${String(row.roster).padStart(6)}   ${String(was.totalSnapshots).padStart(6)}   ` +
          `${formatBytes(was.totalBytes).padStart(14)}   ${formatBytes(now.totalBytes).padStart(12)}   ` +
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
