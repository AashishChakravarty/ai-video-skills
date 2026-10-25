/**
 * direction.js: this version's creative direction, read by reel-kit.js and the shared layers (bg, chrome,
 * clip wrappers). Times are seconds — prefer A(scene, token) so beats follow the voice-over if it is re-made;
 * positions are canvas pixels. Scenes own everything else.
 */
(function () {
  /** Spoken time of the n-th @token anchor in a scene (from script.timed.md via reel-data.js). */
  const A = (scene, token, n = 0) => {
    const hit = window.REEL.anchors.filter((a) => a.scene === scene && a.token === token)[n];
    if (!hit) throw new Error(`direction.js: no anchor "${token}" in scene ${scene}`);
    return hit.t;
  };

  window.DIRECTION = {
    name: "{{VERSION}}",
    concept: "",
    camera: {
      hits: [],
      pushes: [],
      punches: [],
    },
    field: { density: 1, drift: 1, events: [] },
    ticker: { from: null, label: "LIVE", speed: 2.5 },
    header: { logoFlashAt: null, wordmark: null },
    cta: { pulseEvery: 2.5, flyAt: null, next: null },
  };
  void A;
})();
