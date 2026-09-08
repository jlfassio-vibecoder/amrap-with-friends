import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Named in the console so a failing widget is identifiable, not anonymous. */
  name: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Keeps a non-essential mission widget from taking the workout down with it.
 *
 * The live mission view renders the clock, Start, Log round and the audio cue
 * effect in one tree. React unmounts the whole root on an uncaught render
 * error, so a throw inside any decorative widget rendered beside them takes out
 * the buttons and the sound as well — and the athlete sees a dead screen
 * mid-workout with no clue why.
 *
 * Nothing shown through this boundary is worth that. A widget that fails
 * renders nothing and the mission carries on.
 */
export class MissionWidgetBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Loud in the console, silent on screen: the athlete is mid-mission and
    // cannot act on this, but it must not vanish for whoever debugs it later.
    console.error(`[mission] ${this.props.name} failed and was hidden`, error, info);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
