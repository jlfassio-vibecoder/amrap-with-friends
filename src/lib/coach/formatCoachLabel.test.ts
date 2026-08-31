import { describe, expect, it } from 'vitest';
import { formatCoachEventLabel, formatCoachLabel, formatCoachProps } from './formatCoachLabel';

describe('formatCoachLabel', () => {
  it('formats snake_case RPC and event names', () => {
    expect(formatCoachLabel('get_athlete_profile')).toBe('Get athlete profile');
    expect(formatCoachLabel('intake_submitted')).toBe('Intake submitted');
    expect(formatCoachLabel('upsert_athlete_profile')).toBe('Upsert athlete profile');
  });

  it('formats kebab-case template ids', () => {
    expect(formatCoachLabel('blood-shunt')).toBe('Blood shunt');
  });

  it('formats single-word values', () => {
    expect(formatCoachLabel('host')).toBe('Host');
    expect(formatCoachLabel('running')).toBe('Running');
  });
});

describe('formatCoachEventLabel', () => {
  it('appends formatted RPC name for rpc_call events', () => {
    expect(
      formatCoachEventLabel('rpc_call', { rpc_name: 'upsert_athlete_profile', ok: true })
    ).toBe('Rpc call · Upsert athlete profile');
  });

  it('returns formatted event name for non-rpc events', () => {
    expect(formatCoachEventLabel('intake_submitted', {})).toBe('Intake submitted');
  });
});

describe('formatCoachProps', () => {
  it('humanizes keys and slug-like string values', () => {
    const formatted = formatCoachProps({
      unit_system: 'imperial',
      is_first_time: true,
      biological_sex: 'M',
      perceived_classification: 'special_ops',
    });
    expect(formatted).toBe(
      JSON.stringify({
        'Unit system': 'Imperial',
        'Is first time': true,
        'Biological sex': 'M',
        'Perceived classification': 'Special ops',
      })
    );
  });

  it('leaves UUIDs and free text unchanged', () => {
    const formatted = formatCoachProps({
      mission_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      error_message: 'Something went wrong. Please try again.',
    });
    expect(formatted).toBe(
      JSON.stringify({
        'Mission id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'Error message': 'Something went wrong. Please try again.',
      })
    );
  });
});
