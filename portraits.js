export function portraitStage(health) {
  return health <= 0 ? 'defeated' : health <= 30 ? 'swimsuit' : health <= 75 ? 'jacketOff' : 'original';
}

// Keep portrait identity explicit rather than assuming a player index or CSS name.
export function createPortraitController({panels, loadImage, flash, clearFlash = () => {}, reducedMotion = () => false}) {
  const records = panels.map(panel => {
    const image = panel.querySelector('img');
    return {panel, image, original: image.getAttribute('src'), originalAlt: image.alt,
      desired: image.getAttribute('src'), revision: 0, stage: 'original', livingStage: 'original'};
  });
  return async function update(healthTotals, {animate = true, reset = false} = {}) {
    await Promise.all(records.map(async record => {
      const {panel, image, original, originalAlt} = record;
      const stages = ['original', 'jacketOff', 'swimsuit'];
      const healthStage = portraitStage(healthTotals[Number(panel.dataset.player)]);
      if (reset) record.livingStage = 'original';
      else if (healthStage !== 'defeated') record.livingStage = stages[Math.max(stages.indexOf(record.livingStage), stages.indexOf(healthStage))];
      const stage = reset ? 'original' : healthStage === 'defeated' ? 'defeated' : record.livingStage;
      record.stage = stage;
      const source = panel.dataset[stage] || original;
      if (source === record.desired) return;
      record.desired = source;
      const revision = ++record.revision;
      clearFlash(panel);
      if (source === image.getAttribute('src')) return;
      try { await loadImage(source); }
      catch { if (revision === record.revision) record.desired = null; return; }
      // A later stage or reset can overtake a slow image decode. Never apply a stale change.
      if (revision !== record.revision) return;
      image.setAttribute('src', source);
      image.alt = source === original ? originalAlt : panel.dataset[`${stage}Alt`] || (stage === 'jacketOff'
        ? 'Calico heroine without her jacket, casting golden fire'
        : 'Calico heroine in a black, cream, and gold sporty bikini, casting golden fire');
      panel.dataset.portraitStage = source === original ? 'original' : stage;
      if (stage !== 'defeated' && animate && !reducedMotion()) flash(panel, stage);
    }));
  };
}
