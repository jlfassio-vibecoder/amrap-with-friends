import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PreMissionScalingPicker } from '@/components/mission/PreMissionScalingPicker';

afterEach(cleanup);

const PUSH_UPS = { name: 'Diamond Push-ups', target: 10 };
const NO_LADDER = { name: 'Something Unlibraried', target: 10 };

describe('PreMissionScalingPicker', () => {
  it('renders nothing when no movement has a scaling ladder', () => {
    const { container } = render(
      <PreMissionScalingPicker workout={[NO_LADDER]} variants={{}} onChange={() => {}} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('offers only movements that have a ladder', () => {
    render(
      <PreMissionScalingPicker workout={[PUSH_UPS, NO_LADDER]} variants={{}} onChange={() => {}} />
    );
    expect(screen.getByText('Diamond Push-ups')).toBeTruthy();
    expect(screen.queryByText('Something Unlibraried')).toBeNull();
  });

  it('reports a chosen option', () => {
    const onChange = vi.fn();
    render(<PreMissionScalingPicker workout={[PUSH_UPS]} variants={{}} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'From the knees' }));
    expect(onChange).toHaveBeenCalledWith({ 'Diamond Push-ups': 'push-up--knees' });
  });

  it('clears the choice when the same option is pressed again', () => {
    const onChange = vi.fn();
    render(
      <PreMissionScalingPicker
        workout={[PUSH_UPS]}
        variants={{ 'Diamond Push-ups': 'push-up--knees' }}
        onChange={onChange}
      />
    );

    const chip = screen.getByRole('button', { name: 'From the knees' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chip);
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('replaces rather than stacks when a second option is pressed', () => {
    const onChange = vi.fn();
    render(
      <PreMissionScalingPicker
        workout={[PUSH_UPS]}
        variants={{ 'Diamond Push-ups': 'push-up--knees' }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hands elevated' }));
    expect(onChange).toHaveBeenCalledWith({ 'Diamond Push-ups': 'push-up--incline' });
  });

  it('says modifying costs nothing, where the athlete decides', () => {
    render(<PreMissionScalingPicker workout={[PUSH_UPS]} variants={{}} onChange={() => {}} />);
    expect(screen.getByText(/Need to modify a movement/i)).toBeTruthy();
    expect(screen.getByText(/Modifying does not lower your score/i)).toBeTruthy();
  });

  it('summarises how many modifications are already chosen', () => {
    render(
      <PreMissionScalingPicker
        workout={[PUSH_UPS]}
        variants={{ 'Diamond Push-ups': 'push-up--knees' }}
        onChange={() => {}}
      />
    );
    expect(screen.getByText('1 chosen')).toBeTruthy();
  });
});
