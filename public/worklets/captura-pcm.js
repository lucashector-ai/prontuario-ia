/**
 * Captura de áudio para transcrição (AudioWorklet).
 *
 * 1. Ganho automático: leva a fala para um volume constante (~-20 dBFS).
 *    Voz baixa/distante é amplificada até 30x; voz alta não estoura (limitador suave).
 *    O ganho só sobe quando há sinal acima do piso de ruído — silêncio não vira chiado.
 * 2. Saída processada vai para o gravador (revisão final do áudio inteiro).
 * 3. Reamostra para 16 kHz, converte para PCM 16-bit e envia em blocos de ~100 ms
 *    para a transcrição ao vivo, junto com o nível do microfone (para o medidor).
 */
class CapturaPCM extends AudioWorkletProcessor {
  constructor() {
    super()
    this.alvoRms = 0.1          // ~ -20 dBFS
    this.ganhoMax = 30
    this.pisoRuido = 0.0015     // abaixo disso não aumentamos o ganho
    this.ganho = 3
    this.envelope = 0
    this.razao = sampleRate / 16000
    this.falta = 0      // distância (em amostras de entrada) até a próxima amostra de 16 kHz
    this.anterior = 0
    this.saida = new Int16Array(1600)   // 100 ms a 16 kHz
    this.n = 0
    this.nivelPico = 0
    this.blocos = 0
    this.ativo = true
    this.port.onmessage = (e) => { if (e.data && typeof e.data.ativo === 'boolean') this.ativo = e.data.ativo }
  }

  process(inputs, outputs) {
    const entrada = inputs[0] && inputs[0][0]
    const saidaAudio = outputs[0] && outputs[0][0]
    if (!entrada) return true

    // Nível do bloco (RMS) e envelope com subida rápida / descida lenta
    let soma = 0
    for (let i = 0; i < entrada.length; i++) soma += entrada[i] * entrada[i]
    const rms = Math.sqrt(soma / entrada.length)
    this.envelope = rms > this.envelope ? this.envelope * 0.6 + rms * 0.4 : this.envelope * 0.995 + rms * 0.005

    if (this.envelope > this.pisoRuido) {
      const desejado = Math.min(this.ganhoMax, Math.max(1, this.alvoRms / this.envelope))
      // Baixa rápido (evita estouro), sobe devagar (evita "bombear" ruído)
      this.ganho += (desejado - this.ganho) * (desejado < this.ganho ? 0.3 : 0.02)
    }

    const g = this.ganho
    for (let i = 0; i < entrada.length; i++) {
      // limitador suave
      const v = Math.tanh(entrada[i] * g * 1.2) / 1.2
      if (saidaAudio) saidaAudio[i] = v

      if (!this.ativo) continue
      // Reamostragem linear para 16 kHz
      while (this.falta <= 1) {
        const amostra = this.anterior + (v - this.anterior) * this.falta
        const s = Math.max(-1, Math.min(1, amostra))
        this.saida[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff
        if (this.n === this.saida.length) {
          const buf = this.saida.slice(0).buffer
          this.port.postMessage({ pcm: buf }, [buf])
          this.n = 0
        }
        this.falta += this.razao
      }
      this.falta -= 1
      this.anterior = v
    }

    // Nível para o medidor (~10x por segundo): bruto (antes do ganho) e processado
    this.nivelPico = Math.max(this.nivelPico, rms)
    if (++this.blocos >= Math.round(sampleRate / 128 / 10)) {
      this.port.postMessage({ nivel: this.nivelPico, ganho: this.ganho })
      this.nivelPico = 0
      this.blocos = 0
    }
    return true
  }
}

registerProcessor('captura-pcm', CapturaPCM)
