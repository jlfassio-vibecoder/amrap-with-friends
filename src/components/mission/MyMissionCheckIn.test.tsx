import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PAIN_CHECK_IN_WARNING } from '@/data/missionCheckIn';
import { MyMissionCheckIn } from '@/components/mission/MyMissionCheckIn';

afterEach(cleanup);

const LONG_NOTES =
  'Right shoulder was grumbling from the third round on, so I cut the range on the ' +
  'push-ups and slowed the transitions. Worth warming it up properly next time.';

describe('MyMissionCheckIn', () => {
  it('renders nothing when no check-in was logged', () => {
    const { container } = render(<MyMissionCheckIn rpe={null} sessionNotes="" checkIns={{}} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the notes in full, not truncated into a tooltip', () => {
    // The badge this replaced put the whole check-in in a `title` attribute cut
    // to 40 characters — unreachable on touch, and never the words as written.
    render(<MyMissionCheckIn rpe={null} sessionNotes={LONG_NOTES} checkIns={{}} />);

    expect(screen.getByText(LONG_NOTES)).toBeTruthy();
    expect(document.querySelector('[title]')).toBeNull();
  });

  it('shows the RPE with the word that goes with the number', () => {
    render(<MyMissionCheckIn rpe={8} sessionNotes="" checkIns={{}} />);
    expect(screen.getByText(/RPE 8/)).toBeTruthy();
    expect(screen.getByText(/Brutal/)).toBeTruthy();
  });

  it('names each dimension so a bare option is not ambiguous', () => {
    render(
      <MyMissionCheckIn
        rpe={null}
        sessionNotes=""
        checkIns={{ starting_soreness: 'soreness--mild', sleep: 'sleep--poor' }}
      />
    );
    expect(screen.getByText('Starting soreness: Mild')).toBeTruthy();
    expect(screen.getByText('Sleep last night: Poor')).toBeTruthy();
  });

  it('surfaces a recorded pain mark rather than banking it silently', () => {
    render(<MyMissionCheckIn rpe={null} sessionNotes="" checkIns={{ pain: 'pain--felt' }} />);
    // "Felt pain" already reads as a sentence; "Pain: Felt pain" does not.
    expect(screen.getByText('Felt pain')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(PAIN_CHECK_IN_WARNING);
  });

  it('ignores an option id this build no longer knows', () => {
    const { container } = render(
      <MyMissionCheckIn rpe={null} sessionNotes="" checkIns={{ mood: 'mood--retired' }} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('treats whitespace-only notes as no notes', () => {
    const { container } = render(<MyMissionCheckIn rpe={null} sessionNotes="   " checkIns={{}} />);
    expect(container.innerHTML).toBe('');
  });
});
