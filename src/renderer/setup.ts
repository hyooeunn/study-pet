import type { Appearance } from '../shared/ipc.js';
import { DEFAULT_APPEARANCE, HAIR_COLORS, NICKNAME_MAX } from './appearance.config.js';
import { createCharacter } from './character.js';

const api = window.petAPI;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const form = $<HTMLFormElement>('form');
const nicknameInput = $<HTMLInputElement>('nickname');
const submit = $<HTMLButtonElement>('submit');
const previewName = $('preview-name');
const hairList = $('hair-colors');

const existing = await api.getProfile();
let appearance: Appearance = existing?.appearance ?? DEFAULT_APPEARANCE;

// 이미 캐릭터가 있으면 "꾸미기" 모드
if (existing) {
  $('title').textContent = '캐릭터 꾸미기';
  $('subtitle').textContent = '바꾸고 싶은 걸 골라 줘';
  submit.textContent = '저장';
  nicknameInput.value = existing.nickname;
}
nicknameInput.maxLength = NICKNAME_MAX;

// 미리보기: 움직임 없이 정면을 보고 가만히 서 있는 모습
const character = createCharacter($('stage'), { size: 150, appearance, still: true });
character.el.classList.remove('cursor-grab');
character.setStatus('idle');

for (const color of HAIR_COLORS) {
  const label = document.createElement('label');
  label.className = 'flex cursor-pointer flex-col items-center gap-1.5';
  label.innerHTML = `
    <input type="radio" name="hair" class="peer sr-only" />
    <span class="size-11 rounded-full border-2 border-stone-300 transition peer-checked:ring-4 peer-checked:ring-orange-300 peer-checked:ring-offset-2 peer-focus-visible:ring-4 peer-focus-visible:ring-orange-200"></span>
    <span class="text-xs text-stone-600"></span>`;
  const radio = label.querySelector('input')!;
  radio.value = color.id;
  radio.checked = color.id === appearance.hairColor;
  (label.children[1] as HTMLElement).style.backgroundColor = color.swatch;
  label.children[2].textContent = color.label;
  radio.addEventListener('change', () => {
    appearance = { ...appearance, hairColor: color.id };
    character.setAppearance(appearance);
  });
  hairList.appendChild(label);
}

function syncName() {
  const name = nicknameInput.value.trim();
  previewName.textContent = name;
  submit.disabled = name.length === 0;
}
nicknameInput.addEventListener('input', syncName);
syncName();
nicknameInput.focus();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (submit.disabled) return;
  submit.disabled = true;
  // 저장되면 main이 이 창을 닫고 펫을 띄움 (꾸미기 모드면 펫에 바로 반영)
  const ok = await api.saveProfile({ nickname: nicknameInput.value.trim(), appearance });
  if (!ok) submit.disabled = false;
});
