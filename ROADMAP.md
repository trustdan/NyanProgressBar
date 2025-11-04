## Project Vision

- Build a VS Code extension that delivers a vibrant, unobtrusive Nyan Cat progress experience, blending native status indicators with a rich webview animation.
- Maintain a lightweight footprint and seamless integration with VS Code’s task, debug, and command progress APIs.

## Guiding Principles

- Respect user focus: default to subtle cues, escalate to animation only when context warrants it.
- Keep architecture modular so teams can reuse the progress controller without the cat-themed UI.
- Prioritize accessibility (ARIA labels, reduced motion option) and configuration flexibility.

## Milestone 1 – Extension Scaffolding (Status: ✅ Completed)

- Generate project skeleton with `yo code` (TypeScript, webpack bundling optional).
- Set up linting (`eslint` + `prettier`), testing (`vitest` or `mocha`), and CI scaffold (GitHub Actions).
- Define initial `package.json` contributions: activation events, commands, status bar item.

### Acceptance Criteria

```gherkin
Scenario: Extension activates and registers Nyan commands
  Given VS Code loads the workspace with the extension installed
  When the user runs the "Nyan: Toggle Progress" command
  Then the command executes without errors
  And a status bar placeholder for Nyan Progress appears
```

## Milestone 2 – Animated Webview View (Status: ✅ Completed)

- Contribute a `webviewView` (e.g. `nyan.progress`) in the panel view container.
- Implement `NyanWebviewProvider` that streams HTML/CSS/JS from bundled assets.
- Animate cat + rainbow via CSS sprite sheet or canvas; sync animation tick with extension events.
- Provide configuration: auto-expand view, animation speed, reduced motion fallback.

### Acceptance Criteria

```gherkin
Scenario: Display animated Nyan progress view
  Given the Nyan progress view is installed in the panel
  When the extension starts a tracked task
  Then the webview becomes visible without stealing focus
  And the Nyan Cat animation plays smoothly at 60 FPS on modern hardware
  And users can collapse the view to dismiss the animation
```

```gherkin
Scenario Outline: Automatically show progress for built-in operations
  Given auto-tracking is enabled in extension settings
  When <operation> starts
  Then the Nyan progress animation appears within 200 ms
  And the status bar reflects that <operation> is running

  Examples:
    | operation        |
    | npm task         |
    | VS Code task     |
    | debug session    |
```

## Milestone 3 – Progress Controller & API Surface (Status: ✅ Completed)

- Expose `withProgress` helper wrapping `window.withProgress` while coordinating status bar + webview states.
- Implement task listeners (`tasks.onDidStartTaskProcess`, `debug.onDidStartDebugSession`) and throttling logic.
- Add telemetry hooks (opt-in) to track usage patterns for future tuning.

### Acceptance Criteria

```gherkin
Scenario: Extension API wraps custom progress
  Given an external module imports the Nyan progress helper
  When it executes a long-running promise via the helper
  Then standard VS Code progress notifications appear
  And the Nyan status bar + animation stay in sync with task lifecycle
```

## Milestone 4 – UX Polish & Release Prep

- Accessibility pass: ARIA labels, contrast, reduced motion toggle, keyboard focus management.
- Settings UI (`contributes.configuration`), command palette entries, documentation site.
- Package the extension (vsce), run integration tests on Win/Mac/Linux, prepare marketplace assets.

### Acceptance Criteria

```gherkin
Scenario: User customizes Nyan experience
  Given the user opens VS Code settings
  When they adjust Nyan animation speed to "slow"
  Then the next task animation respects the new timing
  And the reduced motion toggle is discoverable and functional
```

## Open Questions

- Should we cache animation frames locally or generate via `<canvas>` for smoother scaling?
- Do we want sound effects with opt-in consent, or is silent operation preferred?
- Which telemetry metrics (if any) offer value without invading privacy?

## Next Actions

- Capture animation screenshots/GIF for documentation and marketplace listing.
- Explore telemetry strategy (opt-in) and privacy-safe metrics ahead of Milestone 4.
- Audit accessibility behaviour (focus order, ARIA live region) prior to final polish.

