# Nyan Progress (VS Code)

Rich, non-intrusive Nyan Cat progress visuals for VS Code tasks, commands, and custom workflows.

## Preview

> Animated capture coming soon.

## Features

- Status bar indicator with looping Nyan iconography to signal active work.
- Dedicated panel view that renders an animated cat and rainbow track.
- Commands to toggle, stop, or demo the animation for quick smoke checks.
- Configurable animation tempo, optional reduced-motion mode, automatic panel reveal, and task/debug auto-tracking.
- Respects reduced-motion preferences and exposes keyboard-friendly controls.

## Commands

- `Nyan Progress: Toggle Animation` (`nyanProgress.toggle`)
- `Nyan Progress: Stop Animation` (`nyanProgress.stop`)
- `Nyan Progress: Play Demo Animation` (`nyanProgress.demo`)

## Settings

| Setting | Description | Default |
| --- | --- | --- |
| `nyanProgress.enableStatusBar` | Show the status bar indicator while Nyan progress is active. | `true` |
| `nyanProgress.autoRevealOnTask` | Reveal the panel view when tracked work begins. | `true` |
| `nyanProgress.animationSpeed` | Control the animation tempo (`slow`, `normal`, `fast`). | `normal` |
| `nyanProgress.reducedMotion` | Use a gentler visual treatment for accessibility. | `false` |
| `nyanProgress.trackTasks` | Automatically animate when VS Code tasks start. | `true` |
| `nyanProgress.trackDebugSessions` | Automatically animate when debug sessions begin. | `true` |

## Embedding the API

```ts
import * as vscode from 'vscode';
import type { NyanProgressApi } from 'vscode-nyan-progress';

const extension = vscode.extensions.getExtension<NyanProgressApi>('your-publisher.vscode-nyan-progress');
const nyan = await extension?.activate?.();
await nyan?.withProgress(
  { location: vscode.ProgressLocation.Window, title: 'Deploying…' },
  async (progress, token) => {
    // do work while Nyan keeps things bright ✨
  }
);
```

- `withProgress` mirrors `vscode.window.withProgress` but drives the status bar + panel animation.
- `beginContext(reason)` returns a disposable for long-lived workflows; dispose it to end the animation.
- `stopAll(reason?)` cancels every active context (manual override).

## Development

```bash
npm install
npm run watch

# In another terminal
code .
```

- Press `F5` to launch an Extension Development Host and run the demo command via the Command Palette.
- Lint: `npm run lint`
- Tests: `npm test`

## Roadmap

- Hook into VS Code Tasks & Debug sessions to auto-drive the animation. ✅
- Provide helper API (`withProgress`) for external extensions. ✅
- Add documentation assets (screenshots, animated GIFs, marketplace listing).

## License

MIT
