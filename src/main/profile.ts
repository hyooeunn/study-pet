import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Profile } from '../shared/ipc.js';

const NICKNAME_MAX = 12;
const DEFAULT_HAIR = 'brown';

// Win: %APPDATA%/Study Pet/profile.json, mac: ~/Library/Application Support/Study Pet/profile.json
const file = () => path.join(app.getPath('userData'), 'profile.json');

// renderer에서 온 값은 믿지 않고 형태를 다시 맞춘다
export function sanitizeProfile(input: unknown): Profile | null {
  const p = input as Partial<Profile> | null;
  const nickname = typeof p?.nickname === 'string' ? p.nickname.trim().slice(0, NICKNAME_MAX) : '';
  if (!nickname) return null;
  const hair = p?.appearance?.hairColor;
  return {
    nickname,
    appearance: { hairColor: typeof hair === 'string' && /^[a-z0-9_-]+$/.test(hair) ? hair : DEFAULT_HAIR },
  };
}

export function loadProfile(): Profile | null {
  try {
    return sanitizeProfile(JSON.parse(fs.readFileSync(file(), 'utf8')));
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile) {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(profile, null, 2), 'utf8');
}
