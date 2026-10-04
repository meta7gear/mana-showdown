import gsap from 'gsap';
const effects = new WeakMap();
const speechEffects = new WeakMap();
export function clearPortraitFlash(panel) {
  const effect = effects.get(panel);
  if (!effect) return;
  effect.timeline.kill();
  effect.layer.remove();
  effects.delete(panel);
}
export function clearPortraitSpeech(panel) {
  const effect = speechEffects.get(panel);
  if (!effect) return;
  effect.timeline.kill();effect.layer.remove();speechEffects.delete(panel);
}
export function portraitSpeech(panel) {
  if (speechEffects.has(panel) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  portraitFlash(panel, undefined, {speech: true});
}
export function portraitFlash(panel, _stage, {speech = false} = {}) {
  const registry = speech ? speechEffects : effects;
  if (speech) clearPortraitSpeech(panel);
  else clearPortraitFlash(panel);
  const layer = document.createElement('div');
  layer.className = `portrait-transition${speech ? ' portrait-speech' : ''}`;
  layer.setAttribute('aria-hidden', 'true');
  const stage = panel.dataset.portraitStage || 'jacketOff';
  layer.dataset.stage = stage;
  layer.dataset.player = panel.dataset.player;
  const rect = panel.getBoundingClientRect();
  const originX = rect.left + rect.width * .54;
  const originY = rect.top + rect.height * .45;
  layer.style.setProperty('--origin-x', `${originX}px`);
  layer.style.setProperty('--origin-y', `${originY}px`);
  const glow = document.createElement('div');
  glow.className = 'portrait-transition-glow';
  const wash = document.createElement('div');
  wash.className = 'portrait-transition-wash';
  const beam = document.createElement('div');
  beam.className = 'portrait-transition-beam';
  const rings = Array.from({length: stage === 'swimsuit' ? 3 : 2}, () => {
    const ring = document.createElement('div');
    ring.className = 'portrait-transition-ring';
    return ring;
  });
  layer.append(wash, glow, beam, ...rings);
  document.body.append(layer);
  const timeline = gsap.timeline({onComplete: () => {
    layer.remove();
    // Keep the speech marker until playback stops to ignore repeated playing events.
    if (!speech) registry.delete(panel);
  }});
  timeline.fromTo(wash, {opacity: .46}, {opacity: 0, duration: .72, ease: 'power2.out'}, 0);
  timeline.fromTo(glow, {scale: .25, opacity: 1}, {scale: stage === 'swimsuit' ? 2.8 : 2.25, opacity: 0, duration: .82, ease: 'power3.out'}, 0);
  timeline.fromTo(beam, {scaleX: 0, opacity: 1}, {scaleX: 1, opacity: 0, duration: .8, ease: 'power3.out'}, .04);
  rings.forEach((ring, index) => timeline.fromTo(ring,
    {scale: .15, opacity: .95 - index * .14, rotation: index * 18},
    {scale: (stage === 'swimsuit' ? 4.6 : 3.7) + index * .7, opacity: 0, rotation: index * 18 + 22,
      duration: .72 + index * .13, ease: 'power2.out'}, index * .07));
  const particleCount = stage === 'swimsuit' ? 92 : 68;
  const distance = Math.max(innerWidth * (stage === 'swimsuit' ? .42 : .34), rect.height * .85);
  for (let i = 0; i < particleCount; i++) {
    const spark = document.createElement('i');
    spark.className = 'portrait-transition-spark';
    if (i % 4 === 0) spark.classList.add('portrait-transition-ember');
    const angle = Math.PI * 2 * i / particleCount + (Math.random() - .5) * .16;
    const rightwardBoost = Math.max(0, Math.cos(angle)) * innerWidth * .18;
    const radius = distance * (.34 + Math.random() * .66) + rightwardBoost;
    layer.append(spark);
    timeline.fromTo(spark,
      {x: 0, y: 0, rotation: angle * 180 / Math.PI, opacity: 1, scale: .65 + Math.random() * .75},
      {x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, rotation: angle * 180 / Math.PI + 70,
        opacity: 0, scale: .08, duration: .62 + Math.random() * .52, ease: 'power3.out'}, Math.random() * .13);
  }
  registry.set(panel, {layer, timeline});
}
