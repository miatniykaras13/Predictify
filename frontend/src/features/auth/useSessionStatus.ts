import { useSyncExternalStore } from 'react';
import { session } from './session';

export function useSessionStatus() {
  return useSyncExternalStore(session.subscribe, session.getStatus);
}
