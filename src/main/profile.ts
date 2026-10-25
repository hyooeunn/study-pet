import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Profile } from '../shared/ipc.js';

const NICKNAME_MAX = 12;
const DEFAULT_HAIR = '#493b30'; // 원본 그림의 머리색 (갈색)
const DEFAULT_SKIN = '#ffeae4'; // 원본 그림의 피부색

// Win: %APPDATA%/Study Pet/profile.json, mac: ~/Library/Application Support/Study Pet/profile.json
const file = () => path.join(app.getPath('userData'), 'profile.json');

// 예전에 머리색을 폴더 이름으로 저장했던 프로필 → 같은 색 코드로
const LEGACY_HAIR: Record<string, string> = {
  brown: '#493b30',
  black: '#191414',
  lightbrown: '#bc9678',
  blonde: '#fff1bc',
};

const toHex = (v: unknown, fallback: string) =>
  typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback;

// renderer에서 온 값은 믿지 않고 형태를 다시 맞춘다
export function sanitizeProfile(input: unknown): Profile | null {
  const p = input as Partial<Profile> | null;
  const nickname = typeof p?.nickname === 'string' ? p.nickname.trim().slice(0, NICKNAME_MAX) : '';
  if (!nickname) return null;
  const hair = p?.appearance?.hairColor;
  const skin = p?.appearance?.skinColor;
  return {
    nickname,
    appearance: {
      hairColor: toHex(LEGACY_HAIR[hair as string] ?? hair, DEFAULT_HAIR),
      // 예전 프로필(피부색 없음)은 기본 피부색으로
      skinColor: toHex(skin, DEFAULT_SKIN),
    },
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
