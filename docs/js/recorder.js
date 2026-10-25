// Real microphone recorder (replaces the prototype's simulation). Usage:
//   const r = await Recorder.start();   // asks permission; throws if denied
//   ... later ...  const { blob, durasi } = await r.stop();   // blob: audio/webm;codecs=opus (Safari: audio/mp4)
window.Recorder = {
  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    const chunks = []; const t0 = Date.now();
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.start(1000);
    return {
      stop: () => new Promise(res => { rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); res({ blob: new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' }), durasi: Math.round((Date.now() - t0) / 1000) }); }; rec.stop(); }),
      cancel: () => { try { rec.stop(); } catch (e) {} stream.getTracks().forEach(t => t.stop()); },
    };
  },
};
