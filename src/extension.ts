import * as vscode from 'vscode';
import { NyanController, WithNyanProgressOptions } from './nyanController';

let controller: NyanController | undefined;
let outputChannel: vscode.OutputChannel | undefined;

export interface NyanProgressApi {
  withProgress<T>(
    options: WithNyanProgressOptions,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Thenable<T>
  ): Promise<T>;
  beginContext(reason: string, options?: { autoReveal?: boolean }): vscode.Disposable;
  stopAll(reason?: string): void;
}

export function activate(context: vscode.ExtensionContext): NyanProgressApi {
  outputChannel = vscode.window.createOutputChannel('Nyan Progress');
  context.subscriptions.push(outputChannel);

  log('Extension activating...');
  controller = new NyanController(context);
  context.subscriptions.push(controller);
  log('Extension activated successfully');

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
  const ensureTaskContext = (execution: vscode.TaskExecution, reason: string, eventType: string): void => {
    if (!controller) {
      return;
    }
    if (taskContexts.has(execution)) {
      log(`${eventType}: Task context already exists for "${reason}"`);
      return;
    }
    log(`${eventType}: Creating task context for "${reason}"`);
    const autoReveal = getConfigFlag('autoRevealOnTask', true);
    const contextId = controller.beginContext(reason, {
      autoReveal,
      forceReveal: autoReveal,
    });
    taskContexts.set(execution, contextId);
  };
  const endTaskContext = (execution: vscode.TaskExecution, completionMessage: string): void => {
    if (!controller) {
      return;
    }
    const contextId = taskContexts.get(execution);
    if (!contextId) {
      log(`No context found for task "${execution.task.name ?? 'Task'}"`);
      return;
    }
    log(`Ending context "${contextId}" with message: "${completionMessage}"`);
    controller.endContext(contextId, completionMessage);
    taskContexts.delete(execution);
  };
  context.subscriptions.push(
    vscode.tasks.onDidStartTask((event) => {
      if (!controller || !getConfigFlag('trackTasks', true)) {
        return;
      }
      const reason = `Task: ${event.execution.task.name ?? 'Untitled task'}`;
      ensureTaskContext(event.execution, reason, 'onDidStartTask');
    }),
    vscode.tasks.onDidStartTaskProcess((event) => {
      if (!controller || !getConfigFlag('trackTasks', true)) {
        return;
      }
      const reason = `Task: ${event.execution.task.name ?? 'Untitled task'}`;
      ensureTaskContext(event.execution, reason, 'onDidStartTaskProcess');
    }),
    vscode.tasks.onDidEndTask((event) => {
      if (!taskContexts.has(event.execution)) {
        log(`onDidEndTask: "${event.execution.task.name ?? 'Task'}" - context already ended, skipping`);
        return;
      }
      log(`onDidEndTask: "${event.execution.task.name ?? 'Task'}"`);
      endTaskContext(event.execution, `Task finished: ${event.execution.task.name ?? 'Task'}`);
    }),
    vscode.tasks.onDidEndTaskProcess((event) => {
      if (!taskContexts.has(event.execution)) {
        log(`onDidEndTaskProcess: "${event.execution.task.name ?? 'Task'}" - context already ended, skipping`);
        return;
      }
      log(`onDidEndTaskProcess: "${event.execution.task.name ?? 'Task'}", exitCode: ${event.exitCode}`);
      const exitDescription = typeof event.exitCode === 'number' && event.exitCode !== 0 ? `Task exited (${event.exitCode})` : `Task finished: ${event.execution.task.name ?? 'Task'}`;
      endTaskContext(event.execution, exitDescription);
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

function getConfigFlag(
  key: 'trackTasks' | 'trackDebugSessions' | 'autoRevealOnTask',
  defaultValue: boolean
): boolean {
  return vscode.workspace.getConfiguration('nyanProgress').get<boolean>(key, defaultValue);
}

export function log(message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  const fullMessage = `[${timestamp}] ${message}`;
  console.log(`[NyanProgress] ${fullMessage}`, ...args);
  outputChannel?.appendLine(args.length > 0 ? `${fullMessage} ${JSON.stringify(args)}` : fullMessage);
}

export function getOutputChannel(): vscode.OutputChannel | undefined {
  return outputChannel;
}
