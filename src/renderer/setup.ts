import type { Appearance } from '../shared/ipc.js';
import { DEFAULT_APPEARANCE, HAIR_COLORS, NICKNAME_MAX, SKIN_COLORS } from './appearance.config.js';
import { createCharacter } from './character.js';

const api = window.petAPI;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const form = $<HTMLFormElement>('form');
const nicknameInput = $<HTMLInputElement>('nickname');
const submit = $<HTMLButtonElement>('submit');
const previewName = $('preview-name');

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

// 색 고르기 창을 드래그하면 input 이벤트가 연달아 오므로 한 프레임에 한 번만 다시 그림
let redrawQueued = false;
function updateAppearance(patch: Partial<Appearance>) {
  appearance = { ...appearance, ...patch };
  if (redrawQueued) return;
  redrawQueued = true;
  requestAnimationFrame(() => {
    redrawQueued = false;
    character.setAppearance(appearance);
  });
}

const SWATCH_CLASS =
  'block size-8 rounded-full border-2 border-stone-300 transition peer-checked:ring-4 peer-checked:ring-orange-300 peer-checked:ring-offset-2 peer-focus-visible:ring-4 peer-focus-visible:ring-orange-200';
const CUSTOM_CLASS =
  'size-8 cursor-pointer rounded-full border-0 bg-transparent p-0 ring-orange-300 ring-offset-2 [&.selected]:ring-4 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-dashed [&::-webkit-color-swatch]:border-stone-400 [&::-webkit-color-swatch-wrapper]:p-0';

// 팔레트 동그라미들 + 맨 끝 "직접 고르기"(color input)
function buildPalette(
  container: HTMLElement,
  name: string,
  presets: readonly { color: string; label: string }[],
  current: string,
  onChange: (color: string) => void
) {
  const custom = document.createElement('input');
  custom.type = 'color';
  custom.className = CUSTOM_CLASS;
  custom.value = current;
  custom.classList.toggle('selected', !presets.some((p) => p.color === current));

  for (const preset of presets) {
    const label = document.createElement('label');
    label.className = 'cursor-pointer';
    label.title = preset.label;
    label.innerHTML = `<input type="radio" class="peer sr-only" /><span class="${SWATCH_CLASS}"></span>`;
    const radio = label.querySelector('input')!;
    radio.name = name;
    radio.value = preset.color;
    radio.checked = preset.color === current;
    (label.lastElementChild as HTMLElement).style.backgroundColor = preset.color;
    radio.addEventListener('change', () => {
      custom.value = preset.color;
      custom.classList.remove('selected');
      onChange(preset.color);
    });
    container.appendChild(label);
  }

  const customLabel = document.createElement('label');
  customLabel.className = 'ml-1 flex items-center';
  customLabel.title = '직접 고르기';
  customLabel.appendChild(custom);
  container.appendChild(customLabel);

  custom.addEventListener('input', () => {
    container.querySelectorAll<HTMLInputElement>(`input[name=${name}]`).forEach((r) => (r.checked = false));
    custom.classList.add('selected');
    onChange(custom.value);
  });
}

buildPalette($('hair-colors'), 'hair', HAIR_COLORS, appearance.hairColor, (c) => updateAppearance({ hairColor: c }));
buildPalette($('skin-colors'), 'skin', SKIN_COLORS, appearance.skinColor, (c) => updateAppearance({ skinColor: c }));

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
