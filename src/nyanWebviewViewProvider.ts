import * as vscode from 'vscode';

type NyanConfigSnapshot = {
  animationSpeed: 'slow' | 'normal' | 'fast';
  reducedMotion: boolean;
};

type Message = {
  type: 'start' | 'stop' | 'config' | 'status' | 'ready';
  payload?: unknown;
};

export class NyanWebviewViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'nyan.progress';

  private view?: vscode.WebviewView;
  private readonly pendingMessages: Message[] = [];
  private isReady = false;
  private pendingReveal?: boolean; // undefined = no pending reveal, true = preserve focus, false = steal focus

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    console.log('[NyanProgress] resolveWebviewView called, isReady:', this.isReady, 'pendingMessages:', this.pendingMessages.length);
    this.view = webviewView;
    this.isReady = false;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
    };

    webviewView.webview.html = this.renderHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message?.type === 'ready') {
        console.log('[NyanProgress] Received ready message, flushing', this.pendingMessages.length, 'pending messages');
        this.isReady = true;
        this.flushQueue();
        this.postMessage({ type: 'config', payload: this.readConfiguration() });
        if (this.pendingReveal !== undefined && this.view) {
          console.log('[NyanProgress] Revealing view after ready, preserveFocus:', this.pendingReveal);
          this.view.show?.(this.pendingReveal);
          this.pendingReveal = undefined;
        }
        return;
      }
      if (message?.type === 'toggle') {
        vscode.commands.executeCommand('nyanProgress.toggle');
      }
    });
    webviewView.onDidDispose(() => {
      console.log('[NyanProgress] View disposed');
      this.view = undefined;
      this.isReady = false;
      this.pendingReveal = undefined;
    });
    this.flushQueue();
  }

  reveal(preserveFocus: boolean): void {
    if (this.view && this.isReady) {
      console.log('[NyanProgress] Revealing view immediately, preserveFocus:', preserveFocus);
      this.view.show?.(preserveFocus);
      this.pendingReveal = undefined;
    } else {
      console.log('[NyanProgress] Deferring reveal, preserveFocus:', preserveFocus);
      this.pendingReveal = preserveFocus;
    }
  }

  start(reason?: string): void {
    this.postMessage({ type: 'start', payload: { reason, config: this.readConfiguration() } });
  }

  stop(): void {
    this.postMessage({ type: 'stop' });
  }

  updateConfiguration(): void {
    this.postMessage({ type: 'config', payload: this.readConfiguration() });
  }

  setStatusText(text: string): void {
    this.postMessage({ type: 'status', payload: text });
  }

  dispose(): void {
    this.view = undefined;
    this.pendingMessages.length = 0;
  }

  private postMessage(message: Message): void {
    if (this.view && this.isReady) {
      console.log('[NyanProgress] Sending message:', message.type);
      this.view.webview.postMessage(message).then(undefined, (error: unknown) => {
        console.error('[NyanProgress] Failed to post message to webview', error);
      });
    } else {
      console.log('[NyanProgress] Queueing message:', message.type, '(view:', !!this.view, 'isReady:', this.isReady, ')');
      this.pendingMessages.push(message);
    }
  }

  private flushQueue(): void {
    if (!this.view || !this.isReady || this.pendingMessages.length === 0) {
      return;
    }
    for (const message of this.pendingMessages.splice(0)) {
      this.postMessage(message);
    }
  }

  private readConfiguration(): NyanConfigSnapshot {
    const config = vscode.workspace.getConfiguration('nyanProgress');
    return {
      animationSpeed: config.get<'slow' | 'normal' | 'fast'>('animationSpeed', 'normal'),
      reducedMotion: config.get('reducedMotion', false),
    };
  }

  private renderHtml(webview: vscode.Webview): string {
    const mediaUri = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'nyan.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'nyan.js'));
    const catUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'rsz_cat.png'));
    const rcatUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'rsz_rcat.png'));

    const cspSource = webview.cspSource;
    const nonce = createNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; style-src ${cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>Nyan Progress</title>
</head>
<body>
  <div class="nyan-shell" role="status" aria-live="polite" aria-atomic="true" aria-busy="false">
    <div class="status-line">
      <span class="status-text">Ready for takeoff…</span>
      <button class="action-btn" type="button" data-action="toggle" aria-label="Toggle animation" aria-pressed="false" title="Toggle Nyan animation">▶</button>
    </div>
    <div class="viewport" aria-hidden="true">
      <div class="starfield" aria-hidden="true"></div>
      <div class="sparkles" aria-hidden="true"></div>
      <div class="rainbow-track" aria-hidden="true"></div>
      <div class="nyan-cat" data-facing="right" aria-hidden="true">
        <img class="sprite sprite-right" src="${catUri}" alt="" draggable="false"/>
        <img class="sprite sprite-left" src="${rcatUri}" alt="" draggable="false"/>
      </div>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function createNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => possible.charAt(Math.floor(Math.random() * possible.length))).join('');
}

