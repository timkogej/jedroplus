// Asistent+: mikrofon → 16 kHz, 16-bitni PCM v kosih po ~100 ms (za Soniox STT).
// Ista pretvorba kot v16kPcm v lib/glas/odjemalec/besede.ts (povprečje okna).
// Datoteka je statična (public/), ker CSP ne dovoli worklet-a iz blob: URL-ja.

class GlasMikrofon extends AudioWorkletProcessor {
  constructor() {
    super();
    this.razmerje = sampleRate / 16000;
    this.kos = new Int16Array(1600); // 100 ms
    this.n = 0;
    this.faza = 0; // položaj naslednjega izhodnega vzorca v vhodnem bloku
    this.vsota = 0;
    this.stevec = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.vsota += ch[i];
      this.stevec++;
      // razmerje ≥ 1 (44,1/48 kHz → 16 kHz), zato največ en izhodni vzorec na vhodnega
      if (i + 1 >= this.faza + this.razmerje) {
        const v = Math.max(-1, Math.min(1, this.vsota / Math.max(1, this.stevec)));
        this.kos[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
        this.vsota = 0;
        this.stevec = 0;
        this.faza += this.razmerje;
        if (this.n === this.kos.length) {
          this.port.postMessage(this.kos.buffer, [this.kos.buffer]);
          this.kos = new Int16Array(1600);
          this.n = 0;
        }
      }
    }
    this.faza -= ch.length;
    return true;
  }
}

registerProcessor('glas-mikrofon', GlasMikrofon);
