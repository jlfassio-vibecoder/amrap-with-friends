import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AmqapFlowPicker } from './AmqapFlowPicker';
import { AMQAP_FLOWS } from '@/data/amqapFlows';

afterEach(() => {
  cleanup();
});

function renderPicker(overrides: Partial<Parameters<typeof AmqapFlowPicker>[0]> = {}) {
  return render(
    <AmqapFlowPicker
      durationMinutes={10}
      selectedFlowId="foundational"
      selectedTemplateIds={[]}
      onDurationChange={() => undefined}
      onFlowChange={() => undefined}
      onTemplateSelect={() => undefined}
      {...overrides}
    />
  );
}

describe('AmqapFlowPicker', () => {
  it('offers only the 10 and 15 minute clocks', () => {
    renderPicker();

    expect(screen.getByRole('button', { name: '10 min' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '15 min' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '5 min' })).toBeNull();
    expect(screen.queryByRole('button', { name: '20 min' })).toBeNull();
  });

  it('teaches the acronym and shows the selected flow description', () => {
    renderPicker();

    expect(screen.getByText('AMQAP')).toBeTruthy();
    expect(screen.getByText(/as many quality rounds as possible/i)).toBeTruthy();
    expect(screen.getByText(/Hips, thoracic spine, and a full sagittal sweep/i)).toBeTruthy();
  });

  it('calls through when a flow card is selected', () => {
    const onTemplateSelect = vi.fn();
    renderPicker({ onTemplateSelect });

    fireEvent.click(screen.getByRole('button', { name: /Foundational Continuous Flow/ }));

    expect(onTemplateSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'amqap-foundational-10' })
    );
  });

  it('switches families and clocks through the chips', () => {
    const onDurationChange = vi.fn();
    const onFlowChange = vi.fn();
    renderPicker({ onDurationChange, onFlowChange });

    fireEvent.click(screen.getByRole('button', { name: '15 min' }));
    expect(onDurationChange).toHaveBeenCalledWith(15);

    fireEvent.click(screen.getByRole('button', { name: 'Deep hip' }));
    expect(onFlowChange).toHaveBeenCalledWith('deep-hip');
  });

  it('opens domain guidance from the chip ?', () => {
    renderPicker();

    fireEvent.click(screen.getByRole('button', { name: "What's the 10 min quality flow?" }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('10 min quality flow')).toBeTruthy();
    expect(screen.getByText(/synovial pump/i)).toBeTruthy();
  });

  it('lists the 15-minute version of the selected family', () => {
    const fifteen = AMQAP_FLOWS.find((flow) => flow.id === 'amqap-spinal-15');
    renderPicker({ durationMinutes: 15, selectedFlowId: 'spinal' });

    expect(screen.getByText(fifteen!.name)).toBeTruthy();
    expect(screen.queryByText('Foundational Continuous Flow')).toBeNull();
  });
});
