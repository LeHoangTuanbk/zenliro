import type { A2AActor } from '../../store/agent-store';

export type ActorStyle = { label: string; color: string; avatar: string };

export const ACTOR_STYLE: Record<A2AActor, ActorStyle> = {
  editor: { label: 'Editor', color: '#4d9fec', avatar: 'E' },
  reviewer: { label: 'Reviewer', color: '#68c98a', avatar: 'R' },
  user: { label: 'You', color: '#f5c542', avatar: 'U' },
};

export const WIDTH_PX = 380;

export type PanelMode = 'centered' | 'maximized' | 'minimized';
