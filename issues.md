# Outstanding Issues

## Auto-Reveal Reliability
- **Symptom:** When running the demo task for the first time, the `Nyan Progress` view sometimes fails to auto-open until the user clicks the tab manually.
- **Suspected Cause:** Race between `viewProvider.reveal()` and the webview finishing its initialisation.
- **Next Steps:** Instrument the ready handshake to log when reveal is requested vs. when the `ready` message lands; delay reveal until readiness is confirmed.

## Animation Start Consistency
- **Symptom:** Subsequent runs show the `Nyan Progress` tab but the cat animation remains idle.
- **Suspected Cause:** The controller records the task start, yet the webview never receives or acts on the queued `start` message—likely because the message queue is cleared before `isReady` flips back to `true` after reuse.
- **Next Steps:** Ensure `pendingMessages` persist between runs, log when `start` messages are enqueued/flushed, and verify the webview posts `ready` after every reload.

## Task Event Coverage
- **Symptom:** Some runs only open the terminal without triggering the animation.
- **Suspected Cause:** VS Code fires `onDidStartTaskProcess` without `onDidStartTask` for certain tasks, and our handlers may still miss the sequence.
- **Next Steps:** Add telemetry around both task events, and consider falling back to manual command invocation (`nyanProgress.demo`) when no context is active shortly after task start.

