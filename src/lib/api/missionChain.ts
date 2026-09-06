import { callRpc } from '@/lib/api/callRpc';
import type { WorkoutExercise } from '@/lib/api/missionTypes';

export type MissionChainApiError = { message: string };

export type MissionChainItemInput = {
  durationMinutes: number;
  workout: WorkoutExercise[];
  templateId?: string | null;
  intensityTier?: number | null;
  /** Only allowed on position 0 when writing a fresh chain after create. */
  startedMissionId?: string | null;
};

export type MissionChainItem = {
  id: string;
  position: number;
  durationMinutes: number;
  workout: WorkoutExercise[];
  templateId: string | null;
  intensityTier: number | null;
  startedMissionId: string | null;
};

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapRpcError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (message.includes('Authentication required')) {
    return 'Sign in to continue.';
  }
  if (message.includes('Rally point not found')) {
    return 'Rally point not found.';
  }
  if (message.includes('Only the host can set the mission chain')) {
    return 'Only the host can set the mission chain.';
  }
  if (message.includes('Cannot rewrite a chain that has already started')) {
    return 'This chain has already started and cannot be changed.';
  }
  if (message.includes('A chain holds at most 5 missions')) {
    return 'A chain holds at most 5 missions.';
  }
  if (message.includes('started_mission_id')) {
    return 'Could not link the first mission to the chain.';
  }
  return message;
}

/** Snake_case payload for `set_mission_chain`. Position is array index. */
export function toMissionChainRpcItems(items: MissionChainItemInput[]): Record<string, unknown>[] {
  return items.map((item, index) => {
    const payload: Record<string, unknown> = {
      duration_minutes: item.durationMinutes,
      workout: item.workout,
    };
    if (item.templateId) {
      payload.template_id = item.templateId;
    }
    if (item.intensityTier !== null && item.intensityTier !== undefined) {
      payload.intensity_tier = item.intensityTier;
    }
    if (index === 0 && item.startedMissionId) {
      payload.started_mission_id = item.startedMissionId;
    }
    return payload;
  });
}

export async function setMissionChain(input: {
  rallyPointId: string;
  items: MissionChainItemInput[];
}): Promise<{ data: { count: number } | null; error: MissionChainApiError | null }> {
  const { data, error } = await callRpc('set_mission_chain', {
    p_rally_point_id: input.rallyPointId,
    p_items: toMissionChainRpcItems(input.items),
  });

  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const count = typeof raw.count === 'number' ? raw.count : input.items.length;
  return { data: { count }, error: null };
}

function parseChainItem(raw: Record<string, unknown>): MissionChainItem | null {
  const id = readString(raw.id);
  const position = typeof raw.position === 'number' ? raw.position : null;
  const durationMinutes = typeof raw.duration_minutes === 'number' ? raw.duration_minutes : null;
  if (!id || position === null || durationMinutes === null) {
    return null;
  }

  return {
    id,
    position,
    durationMinutes,
    workout: Array.isArray(raw.workout) ? (raw.workout as WorkoutExercise[]) : [],
    templateId: readString(raw.template_id),
    intensityTier: typeof raw.intensity_tier === 'number' ? raw.intensity_tier : null,
    startedMissionId: readString(raw.started_mission_id),
  };
}

export async function getMissionChain(
  rallyPointId: string
): Promise<{ data: MissionChainItem[] | null; error: MissionChainApiError | null }> {
  const { data, error } = await callRpc('get_mission_chain', {
    p_rally_point_id: rallyPointId,
  });

  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
  const items: MissionChainItem[] = [];
  for (const entry of itemsRaw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const parsed = parseChainItem(entry as Record<string, unknown>);
    if (parsed) {
      items.push(parsed);
    }
  }

  return { data: items, error: null };
}
