/**
 * UI sound effects (disabled).
 *
 * The project previously used synthesized Web Audio “VHS camcorder” SFX for
 * hover/select/navigation. Per request, **all website UI sounds are removed**.
 *
 * Keep the same exported API so components don't need touching, but make every
 * function a no-op so nothing is created, loaded, resumed, or played.
 */

export function playClick() {}
export function playSelect() {}
export function playStart() {}
export function playNavigate() {}
export function playStop() {}
export function playHover() {}
export function playError() {}
export function initAudio() {}
