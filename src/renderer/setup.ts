import type { Appearance } from '../shared/ipc.js';
import { ACCESSORY_COLORS, DEFAULT_APPEARANCE, HAIR_COLORS, HAIR_STYLES, NICKNAME_MAX, SKIN_COLORS } from './appearance.config.js';
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
const ORIGINAL_CLASS = 'grid place-items-center bg-white text-[10px] leading-none text-stone-500';
const CUSTOM_CLASS =
  'size-8 cursor-pointer rounded-full border-0 bg-transparent p-0 ring-orange-300 ring-offset-2 [&.selected]:ring-4 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-dashed [&::-webkit-color-swatch]:border-stone-400 [&::-webkit-color-swatch-wrapper]:p-0';

// 팔레트 동그라미들 + 맨 끝 "직접 고르기"(color input). color: null 칸은 "원래 색"
function buildPalette<C extends string | null>(
  container: HTMLElement,
  name: string,
  presets: readonly { color: C; label: string }[],
  current: C,
  onChange: (color: C) => void
) {
  const custom = document.createElement('input');
  custom.type = 'color';
  custom.className = CUSTOM_CLASS;
  custom.value = current ?? '#ffd84d';
  custom.classList.toggle('selected', !presets.some((p) => p.color === current));

  for (const preset of presets) {
    const label = document.createElement('label');
    label.className = 'cursor-pointer';
    label.title = preset.label;
    label.innerHTML = `<input type="radio" class="peer sr-only" /><span class="${SWATCH_CLASS}"></span>`;
    const radio = label.querySelector('input')!;
    radio.name = name;
    radio.value = preset.color ?? '';
    radio.checked = preset.color === current;
    const swatch = label.lastElementChild as HTMLElement;
    if (preset.color) {
      swatch.style.backgroundColor = preset.color;
    } else {
      swatch.classList.add(...ORIGINAL_CLASS.split(' '));
      swatch.textContent = '원래';
    }
    radio.addEventListener('change', () => {
      if (preset.color) custom.value = preset.color;
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
    onChange(custom.value as C);
  });
}

buildPalette($('hair-colors'), 'hair', HAIR_COLORS, appearance.hairColor, (c) => updateAppearance({ hairColor: c }));
buildPalette($('skin-colors'), 'skin', SKIN_COLORS, appearance.skinColor, (c) => updateAppearance({ skinColor: c }));

// 악세사리 색 칸은 고른 머리 모양(+항상 입는 아이템)에 악세사리가 있을 때만 보임
const rig = await api.loadRig();
const accessoryField = $('accessory-field');
function syncAccessoryField() {
  const worn = [...(rig?.items ?? []), ...(rig?.hairStyles[appearance.hairStyle] ?? [])];
  const show = worn.some((item) => item.accent === 'accessory');
  accessoryField.classList.toggle('hidden', !show);
  accessoryField.classList.toggle('flex', show);
}
buildPalette<string | null>($('accessory-colors'), 'accessory', ACCESSORY_COLORS, appearance.accessoryColor, (c) =>
  updateAppearance({ accessoryColor: c })
);
syncAccessoryField();

// 머리 모양: 글자 버튼 (items.json에 실제로 있는 것만)
const STYLE_CLASS =
  'cursor-pointer rounded-full border-2 border-stone-200 bg-white px-3.5 py-1.5 text-sm text-stone-600 transition peer-checked:border-orange-300 peer-checked:bg-orange-50 peer-checked:font-semibold peer-checked:text-stone-800 peer-focus-visible:ring-4 peer-focus-visible:ring-orange-200';
for (const style of HAIR_STYLES) {
  if (rig && !rig.hairStyles[style.id]) continue;
  const label = document.createElement('label');
  label.innerHTML = `<input type="radio" name="hair-style" class="peer sr-only" /><span class="${STYLE_CLASS}"></span>`;
  const radio = label.querySelector('input')!;
  radio.value = style.id;
  radio.checked = style.id === appearance.hairStyle;
  label.lastElementChild!.textContent = style.label;
  radio.addEventListener('change', () => {
    updateAppearance({ hairStyle: style.id });
    syncAccessoryField();
  });
  $('hair-styles').appendChild(label);
}

// 브라우저가 이전 선택 상태를 복원해도, 화면 표시를 실제 값에 맞게 다시 맞춤
const selected: Record<string, string> = {
  'hair-style': appearance.hairStyle,
  hair: appearance.hairColor,
  skin: appearance.skinColor,
  accessory: appearance.accessoryColor ?? '',
};
for (const [name, value] of Object.entries(selected)) {
  document.querySelectorAll<HTMLInputElement>(`input[name=${name}]`).forEach((r) => (r.checked = r.value === value));
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
