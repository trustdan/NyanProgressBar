const vscode = acquireVsCodeApi();

const shell = document.querySelector('.nyan-shell');
const statusText = document.querySelector('.status-text');
const actionBtn = document.querySelector('.action-btn');
const viewport = document.querySelector('.viewport');
const rainbowTrack = document.querySelector('.rainbow-track');
const nyanCat = document.querySelector('.nyan-cat');

if (
  !(shell instanceof HTMLElement) ||
  !(statusText instanceof HTMLElement) ||
  !(actionBtn instanceof HTMLButtonElement) ||
  !(viewport instanceof HTMLElement) ||
  !(rainbowTrack instanceof HTMLElement) ||
  !(nyanCat instanceof HTMLElement)
) {
  throw new Error('Nyan progress view failed to initialise. Required DOM nodes are missing.');
}

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const SPEED_LOOKUP = {
  slow: 0.14,
  normal: 0.22,
  fast: 0.32,
};

let running = false;
let reducedMotion = false;
let pxPerMs = SPEED_LOOKUP.normal;
let offset = 0;
let rafHandle = 0;
let lastTimestamp = 0;
let lastConfig = { animationSpeed: 'normal', reducedMotion: false };

window.addEventListener('message', (event) => {
  const message = event.data;
  if (!message || typeof message !== 'object') {
    return;
  }

  console.log('[NyanProgress WebView] Received message:', message.type, 'running:', running);

  switch (message.type) {
    case 'start':
      console.log('[NyanProgress WebView] Starting animation with reason:', message.payload?.reason);
      startAnimation(message.payload?.reason, message.payload?.config);
      break;
    case 'stop':
      console.log('[NyanProgress WebView] Stopping animation');
      stopAnimation(message.payload?.status ?? 'Standing by…');
      break;
    case 'config':
      applyConfiguration(message.payload);
      break;
    case 'status':
      if (typeof message.payload === 'string') {
        updateStatus(message.payload);
      }
      break;
    default:
      break;
  }
});

actionBtn.addEventListener('click', () => {
  vscode.postMessage({ type: 'toggle' });
});

actionBtn.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    vscode.postMessage({ type: 'toggle' });
  }
});

if (typeof reduceMotionQuery.addEventListener === 'function') {
  reduceMotionQuery.addEventListener('change', () => applyConfiguration());
} else if (typeof reduceMotionQuery.addListener === 'function') {
  reduceMotionQuery.addListener(() => applyConfiguration());
}

applyConfiguration();
shell.setAttribute('aria-busy', 'false');
updateButtonState(false);
updateStatus('Standing by…');
actionBtn.setAttribute('aria-label', 'Start animation');
actionBtn.textContent = '▶';
console.log('[NyanProgress WebView] Webview ready, sending ready message');
vscode.postMessage({ type: 'ready' });

function startAnimation(reason = 'In progress…', config) {
  running = true;
  shell.setAttribute('aria-busy', 'true');
  document.body.classList.add('is-active');
  updateStatus(reason);
  updateButtonState(true);
  actionBtn.setAttribute('aria-label', 'Stop animation');
  offset = 0;
  setCatOffset(0);
  applyConfiguration(config);
  lastTimestamp = 0;
  requestNextFrame();
}

function stopAnimation(statusMessage = 'Standing by…') {
  running = false;
  shell.setAttribute('aria-busy', 'false');
  document.body.classList.remove('is-active');
  cancelAnimationFrame(rafHandle);
  rafHandle = 0;
  offset = 0;
  nyanCat.dataset.facing = 'right';
  setCatOffset(0);
  updateButtonState(false);
  actionBtn.setAttribute('aria-label', 'Start animation');
  updateStatus(statusMessage);
}

function applyConfiguration(config) {
  if (config && typeof config === 'object') {
    lastConfig = {
      animationSpeed: config.animationSpeed ?? lastConfig.animationSpeed,
      reducedMotion: Boolean(config.reducedMotion),
    };
  }

  const animationSpeed = lastConfig.animationSpeed in SPEED_LOOKUP ? lastConfig.animationSpeed : 'normal';
  pxPerMs = SPEED_LOOKUP[animationSpeed];
  document.body.dataset.speed = animationSpeed;
  document.body.style.setProperty('--nyan-track-speed', `${(3.6 * SPEED_LOOKUP.normal) / pxPerMs}s`);

  const prefersReduced = reduceMotionQuery.matches;
  reducedMotion = Boolean(lastConfig.reducedMotion) || prefersReduced;
  document.body.classList.toggle('reduced-motion', reducedMotion);
  shell.setAttribute('data-motion', reducedMotion ? 'reduced' : 'animated');

  if (reducedMotion) {
    offset = 0;
    nyanCat.dataset.facing = 'right';
    setCatOffset(0);
  }
}

function updateStatus(text) {
  statusText.textContent = text;
}

function updateButtonState(isRunning) {
  actionBtn.textContent = isRunning ? '❚❚' : '▶';
  actionBtn.setAttribute('data-state', isRunning ? 'running' : 'idle');
  actionBtn.setAttribute('aria-pressed', isRunning ? 'true' : 'false');
}

function setCatOffset(value) {
  nyanCat.style.setProperty('--nyan-x', `${value}px`);
}

function requestNextFrame() {
  if (!running) {
    return;
  }
  rafHandle = requestAnimationFrame(step);
}

function step(timestamp) {
  if (!running) {
    return;
  }

  if (!lastTimestamp) {
    lastTimestamp = timestamp;
  }

  if (reducedMotion) {
    lastTimestamp = timestamp;
    requestNextFrame();
    return;
  }

  const delta = Math.min(timestamp - lastTimestamp, 48);
  const trackWidth = rainbowTrack.clientWidth;
  const catWidth = nyanCat.clientWidth;
  const loopLength = Math.max(1, trackWidth + catWidth + 120);

  offset = (offset + delta * pxPerMs) % loopLength;
  const visibleOffset = offset - catWidth - 60;

  setCatOffset(visibleOffset);
  nyanCat.dataset.facing = 'right';

  lastTimestamp = timestamp;
  requestNextFrame();
}

