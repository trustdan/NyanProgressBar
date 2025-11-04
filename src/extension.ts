import * as vscode from 'vscode';
import { NyanController, WithNyanProgressOptions } from './nyanController';

let controller: NyanController | undefined;

export interface NyanProgressApi {
  withProgress<T>(
    options: WithNyanProgressOptions,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Thenable<T>
  ): Promise<T>;
  beginContext(reason: string, options?: { autoReveal?: boolean }): vscode.Disposable;
  stopAll(reason?: string): void;
}

export function activate(context: vscode.ExtensionContext): NyanProgressApi {
  controller = new NyanController(context);
  context.subscriptions.push(controller);

  context.subscriptions.push(
    vscode.commands.registerCommand('nyanProgress.toggle', () => {
      controller?.toggle();
    }),
    vscode.commands.registerCommand('nyanProgress.stop', () => {
      controller?.stopAll('Stopped by user');
    }),
    vscode.commands.registerCommand('nyanProgress.demo', async () => {
      await controller?.playDemo();
    })
  );

  const taskContexts = new WeakMap<vscode.TaskExecution, string>();
  context.subscriptions.push(
    vscode.tasks.onDidStartTask((event) => {
      if (!controller || !getConfigFlag('trackTasks', true)) {
        return;
      }
      const reason = `Task: ${event.execution.task.name ?? 'Untitled task'}`;
      const contextId = controller.beginContext(reason, { autoReveal: true });
      taskContexts.set(event.execution, contextId);
    }),
    vscode.tasks.onDidEndTask((event) => {
      if (!controller) {
        return;
      }
      const contextId = taskContexts.get(event.execution);
      if (!contextId) {
        return;
      }
      controller.endContext(contextId, `Task finished: ${event.execution.task.name ?? 'Task'}`);
      taskContexts.delete(event.execution);
    })
  );

  const debugContexts = new WeakMap<vscode.DebugSession, string>();
  context.subscriptions.push(
    vscode.debug.onDidStartDebugSession((session) => {
      if (!controller || session.parentSession) {
        return;
      }
      if (!getConfigFlag('trackDebugSessions', true)) {
        return;
      }
      const reason = `Debugging: ${session.name}`;
      const contextId = controller.beginContext(reason, { autoReveal: true });
      debugContexts.set(session, contextId);
    }),
    vscode.debug.onDidTerminateDebugSession((session) => {
      if (!controller) {
        return;
      }
      const contextId = debugContexts.get(session);
      if (!contextId) {
        return;
      }
      controller.endContext(contextId, `Debug session complete: ${session.name}`);
      debugContexts.delete(session);
    })
  );

  const api: NyanProgressApi = {
    withProgress: (options, task) => {
      if (!controller) {
        throw new Error('Nyan Progress controller is not initialised.');
      }
      return controller.withProgress(options, task);
    },
    beginContext: (reason, options) => {
      if (!controller) {
        throw new Error('Nyan Progress controller is not initialised.');
      }
      const contextId = controller.beginContext(reason, { autoReveal: options?.autoReveal });
      return new vscode.Disposable(() => controller?.endContext(contextId));
    },
    stopAll: (reason) => {
      controller?.stopAll(reason);
    },
  };

  return api;
}

export function deactivate(): void {
  controller?.dispose();
  controller = undefined;
}

function getConfigFlag(key: 'trackTasks' | 'trackDebugSessions', defaultValue: boolean): boolean {
  return vscode.workspace.getConfiguration('nyanProgress').get<boolean>(key, defaultValue);
}
