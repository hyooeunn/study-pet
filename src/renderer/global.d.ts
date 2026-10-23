import type { PetAPI } from '../shared/ipc.js';

declare global {
  interface Window {
    petAPI: PetAPI;
  }
}

export {};
