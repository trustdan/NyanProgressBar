import * as vscode from 'vscode';
import { NyanWebviewViewProvider } from './nyanWebviewViewProvider';

type SpeedSetting = 'slow' | 'normal' | 'fast';

type StartOptions = {
  autoReveal?: boolean;
  forceReveal?: boolean;
};

export type WithNyanProgressOptions = vscode.ProgressOptions & {
  autoReveal?: boolean;
  completionMessage?: string;
};

const STATUS_FRAMES = [
  '🐱🟥🟧🟨🟩🟦🟪✨',
  '🟥🐱🟧🟨🟩🟦🟪✨',
  '🟥🟧🐱🟨🟩🟦🟪✨',
  '🟥🟧🟨🐱🟩🟦🟪✨',
  '🟥🟧🟨🟩🐱🟦🟪✨',
  '🟥🟧🟨🟩🟦🐱🟪✨',
  '🟥🟧🟨🟩🟦🟪🐱✨',
  '🟥🟧🟨🟩🟦🟪✨🐱'
];
const SPEED_MULTIPLIER: Record<SpeedSetting, number> = {
  slow: 0.5,
  normal: 1,
  fast: 1.8,
};
const COMPLETION_FALLBACK = 'All clear!';

export class NyanController implements vscode.Disposable {
  private readonly statusBarItem: vscode.StatusBarItem;
  private readonly viewProvider: NyanWebviewViewProvider;
  private readonly disposables: vscode.Disposable[] = [];

  private readonly contexts = new Map<string, string>();
  private manualContextId?: string;

  private statusInterval?: NodeJS.Timeout;
  private statusFrame = 0;
  private running = false;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    this.statusBarItem.name = 'Nyan Progress';
    this.statusBarItem.text = '$(rocket) Nyan idle';
    this.statusBarItem.tooltip = 'Show the Nyan progress animation';
    this.statusBarItem.command = 'nyanProgress.toggle';

    this.viewProvider = new NyanWebviewViewProvider(context);
    this.disposables.push(
      this.statusBarItem,
      vscode.window.registerWebviewViewProvider(NyanWebviewViewProvider.viewType, this.viewProvider)
    );

    this.refreshStatusBarVisibility();

    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('nyanProgress.enableStatusBar')) {
          this.refreshStatusBarVisibility();
        }
        if (
          event.affectsConfiguration('nyanProgress.animationSpeed') ||
          event.affectsConfiguration('nyanProgress.reducedMotion')
        ) {
          this.viewProvider.updateConfiguration();
          if (this.running && this.isReducedMotionEnabled()) {
            this.endStatusAnimation();
            this.statusBarItem.text = '$(rocket) Nyan engaged';
          } else if (this.running) {
            this.beginStatusAnimation();
          }
        }
      })
    );
  }

  beginContext(reason: string, options: StartOptions = {}, contextId?: string): string {
    const id = contextId ?? this.createContextId();
    this.contexts.set(id, reason);
    this.start(reason, options);
    return id;
  }

  endContext(contextId: string, completionMessage = COMPLETION_FALLBACK): void {
    if (!this.contexts.has(contextId)) {
      return;
    }
    this.contexts.delete(contextId);
    if (this.manualContextId === contextId) {
      this.manualContextId = undefined;
    }

    if (this.contexts.size === 0) {
      this.stop(completionMessage);
      return;
    }

    const nextReason = Array.from(this.contexts.values()).pop() ?? 'Working…';
    this.start(nextReason, { autoReveal: false });
  }

  stopAll(reason = COMPLETION_FALLBACK): void {
    this.contexts.clear();
    this.manualContextId = undefined;
    this.stop(reason);
  }

  async withProgress<T>(
    options: WithNyanProgressOptions,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Thenable<T>
  ): Promise<T> {
    const reason = options.title ?? 'Working…';
    const contextId = this.beginContext(reason, { autoReveal: options.autoReveal });
    try {
      return await vscode.window.withProgress(options, task);
    } finally {
      this.endContext(contextId, options.completionMessage ?? COMPLETION_FALLBACK);
    }
  }

  start(reason = 'Working…', options: StartOptions = {}): void {
    const shouldReveal = Boolean(options.forceReveal) || (Boolean(options.autoReveal) && this.isAutoRevealEnabled());

    if (!this.running) {
      this.running = true;
      this.viewProvider.start(reason);
      if (this.isStatusBarEnabled()) {
        this.statusBarItem.show();
      }

      if (this.isReducedMotionEnabled()) {
        this.endStatusAnimation();
        this.statusBarItem.text = '$(rocket) Nyan engaged';
      } else {
        this.beginStatusAnimation();
      }
    }

    this.viewProvider.setStatusText(reason);
    if (this.isStatusBarEnabled()) {
      this.statusBarItem.tooltip = reason;
    }

    if (shouldReveal) {
      this.viewProvider.reveal(true);
    }
  }

  stop(reason = COMPLETION_FALLBACK): void {
    if (!this.running) {
      this.viewProvider.setStatusText(reason);
      this.statusBarItem.text = '$(rocket) Nyan idle';
      this.statusBarItem.tooltip = 'Show the Nyan progress animation';
      return;
    }

    this.running = false;
    this.viewProvider.stop();
    this.viewProvider.setStatusText(reason);
    this.endStatusAnimation();
    this.statusBarItem.text = '$(rocket) Nyan idle';
    this.statusBarItem.tooltip = 'Show the Nyan progress animation';
  }

  toggle(): void {
    if (this.manualContextId) {
      this.endContext(this.manualContextId, 'Manual stop');
      return;
    }
    this.manualContextId = this.beginContext('Manual launch', { forceReveal: true }, 'manual');
  }

  async playDemo(): Promise<void> {
    const contextId = this.beginContext('Demo flight', { forceReveal: true });
    try {
      await new Promise((resolve) => setTimeout(resolve, 6000));
    } finally {
      this.endContext(contextId, 'Demo complete');
    }
  }

  dispose(): void {
    this.stopAll('Extension deactivated');
    this.disposables.forEach((d) => d.dispose());
  }

  private beginStatusAnimation(): void {
    this.endStatusAnimation();
    this.statusFrame = 0;
    this.statusBarItem.text = `$(rocket) ${STATUS_FRAMES[this.statusFrame]}`;
    this.statusFrame = (this.statusFrame + 1) % STATUS_FRAMES.length;

    const speedSetting = this.getAnimationSpeed();
    const intervalMs = Math.max(90, Math.round(220 / SPEED_MULTIPLIER[speedSetting]));

    this.statusInterval = setInterval(() => {
      this.statusBarItem.text = `$(rocket) ${STATUS_FRAMES[this.statusFrame]}`;
      this.statusFrame = (this.statusFrame + 1) % STATUS_FRAMES.length;
    }, intervalMs);
  }

  private endStatusAnimation(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = undefined;
    }
  }

  private refreshStatusBarVisibility(): void {
    if (this.isStatusBarEnabled()) {
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }

  private isStatusBarEnabled(): boolean {
    return vscode.workspace.getConfiguration('nyanProgress').get('enableStatusBar', true);
  }

  private isAutoRevealEnabled(): boolean {
    return vscode.workspace.getConfiguration('nyanProgress').get('autoRevealOnTask', true);
  }

  private getAnimationSpeed(): SpeedSetting {
    return vscode.workspace
      .getConfiguration('nyanProgress')
      .get<SpeedSetting>('animationSpeed', 'normal');
  }

  private isReducedMotionEnabled(): boolean {
    return vscode.workspace.getConfiguration('nyanProgress').get('reducedMotion', false);
  }

  private createContextId(): string {
    return `ctx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

