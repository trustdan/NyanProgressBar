import * as vscode from 'vscode';

type NyanConfigSnapshot = {
  animationSpeed: 'slow' | 'normal' | 'fast';
  reducedMotion: boolean;
};

type Message = {
  type: 'start' | 'stop' | 'config' | 'status';
  payload?: unknown;
};

export class NyanWebviewViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'nyan.progress';

  private view?: vscode.WebviewView;
  private readonly pendingMessages: Message[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
    };

    webviewView.webview.html = this.renderHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message?.type === 'toggle') {
        vscode.commands.executeCommand('nyanProgress.toggle');
      }
    });
    webviewView.onDidDispose(() => {
      this.view = undefined;
    });
    this.flushQueue();
    this.postMessage({ type: 'config', payload: this.readConfiguration() });
  }

  reveal(preserveFocus: boolean): void {
    if (this.view) {
      this.view.show?.(preserveFocus);
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
    if (this.view) {
      this.view.webview.postMessage(message).then(undefined, (error: unknown) => {
        console.error('[NyanProgress] Failed to post message to webview', error);
      });
    } else {
      this.pendingMessages.push(message);
    }
  }

  private flushQueue(): void {
    if (!this.view || this.pendingMessages.length === 0) {
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

