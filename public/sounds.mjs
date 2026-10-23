export async function readWav(file) {
  if (!/\.wav$/i.test(file.name)) throw Error('Choose a .wav file.');
  if (!file.size) throw Error('Choose a non-empty WAV file.');
  const bytes = await file.arrayBuffer();
  const header = new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength));
  const text = String.fromCharCode(...header);
  if (!text.startsWith('RIFF') || text.slice(8, 12) !== 'WAVE') throw Error('This file is not a valid WAV recording.');
  return {name: file.name, bytes};
}

export function createScoreGainTracker() {
  let team = null, previous = null;
  return {
    reset() { team = null; previous = null; },
    observe(rows, teamId) {
      if (team !== teamId) { team = teamId; previous = null; }
      if (!teamId) return false;
      const raw = rows.find(row => String(row.team_number) === teamId)?.ccs_score;
      if (raw == null || String(raw).trim() === '') return false;
      const score = Number(raw);
      if (!Number.isFinite(score)) return false;
      const gained = previous !== null && score > previous;
      previous = score;
      return gained;
    }
  };
}

export function createSoundPlayer(onState = () => {}, Context = globalThis.AudioContext || globalThis.webkitAudioContext) {
  let context, source;
  function getContext() {
    if (!Context) throw Error('This browser does not support sound alerts.');
    if (!context) { context = new Context(); context.onstatechange = onState; }
    return context;
  }
  return {
    get enabled() { return context?.state === 'running'; },
    async decode(bytes) {
      try { return await getContext().decodeAudioData(bytes.slice(0)); }
      catch { throw Error('This WAV could not be played. Try a standard PCM WAV recording.'); }
    },
    async enable() { await getContext().resume(); onState(); },
    stop() { if (source) { source.stop(); source = null; } },
    play(buffer) {
      if (!buffer || context?.state !== 'running') return false;
      this.stop();
      const next = context.createBufferSource();
      next.buffer = buffer; next.connect(context.destination);
      next.onended = () => { if (source === next) source = null; };
      source = next; next.start(); return true;
    }
  };
}
