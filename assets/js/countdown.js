/* ==========================================================================
   The Wedding Plan — Countdown
   Counts down to 7·7·27. Reads the target from a data attribute so future
   edits happen in HTML, not here.
   ========================================================================== */

(function initCountdown() {
  const root = document.querySelector('[data-countdown]');
  if (!root) return;

  const target = new Date(root.dataset.countdown);
  if (Number.isNaN(target.getTime())) {
    console.warn('Countdown target invalid:', root.dataset.countdown);
    return;
  }

  const outputs = {
    days:    root.querySelector('[data-cd-days]'),
    hours:   root.querySelector('[data-cd-hours]'),
    minutes: root.querySelector('[data-cd-minutes]'),
    seconds: root.querySelector('[data-cd-seconds]'),
  };

  function tick() {
    const now = new Date();
    let delta = Math.max(0, target - now);

    const day = 1000 * 60 * 60 * 24;
    const hr  = 1000 * 60 * 60;
    const min = 1000 * 60;

    const days    = Math.floor(delta / day); delta -= days * day;
    const hours   = Math.floor(delta / hr);  delta -= hours * hr;
    const minutes = Math.floor(delta / min); delta -= minutes * min;
    const seconds = Math.floor(delta / 1000);

    if (outputs.days)    outputs.days.textContent    = String(days);
    if (outputs.hours)   outputs.hours.textContent   = String(hours).padStart(2, '0');
    if (outputs.minutes) outputs.minutes.textContent = String(minutes).padStart(2, '0');
    if (outputs.seconds) outputs.seconds.textContent = String(seconds).padStart(2, '0');
  }

  tick();
  setInterval(tick, 1000);
})();
