const totalSteps = 12;
const stepDurationMs = 1000;

let currentStep = 0;

console.log('[nyan-demo] Starting long-running demo task...');

const interval = setInterval(() => {
  currentStep += 1;
  const percent = Math.round((currentStep / totalSteps) * 100);
  console.log(`[nyan-demo] Working... ${currentStep}/${totalSteps} (${percent}%)`);

  if (currentStep >= totalSteps) {
    clearInterval(interval);
    console.log('[nyan-demo] Demo task complete!');
  }
}, stepDurationMs);

