/* ==========================================================================
   The Wedding Plan — Wedding Party page
   For now: renders the timeline strip. Content per-timeframe will follow.
   ========================================================================== */

(async function hydrateParty() {
  if (!window.TWP || !window.TWP.api) return;

  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const timeframes = await window.TWP.api.get('timeframes');
  if (!timeframes) return;

  const NOW_TF = timeframes.find(t => t.isNow) || timeframes[0];
  const NOW_ORDER = NOW_TF.order;
  let activeTf = NOW_TF.code;

  function renderTimeline() {
    const mount = q('[data-timeline]');
    if (!mount) return;

    const dots = timeframes.map(tf => {
      const isActive = tf.code === activeTf;
      const isNow = tf.isNow;
      let stateClass = '';
      if (tf.order < NOW_ORDER) stateClass = 'timeline__dot--past';
      else if (tf.order > NOW_ORDER) stateClass = 'timeline__dot--future';
      if (isActive) stateClass += ' timeline__dot--active';
      if (isNow) stateClass += ' timeline__dot--now';

      return `
        <button class="timeline__stop" data-tf="${tf.code}">
          <span class="timeline__dot ${stateClass}"></span>
          <span class="timeline__label ${isActive ? 'is-active' : ''}">${tf.label}${isNow ? '<em>NOW</em>' : ''}</span>
        </button>
      `;
    }).join('');

    mount.innerHTML = `<div class="timeline__line"></div>${dots}`;
    qa('.timeline__stop', mount).forEach(btn => {
      btn.addEventListener('click', () => {
        activeTf = btn.dataset.tf;
        renderTimeline();
      });
    });
  }

  renderTimeline();
})();
