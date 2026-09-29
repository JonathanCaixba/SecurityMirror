/**
 * ============================================================
 *  ESCUDO CONDUCTUAL — SDK de Biometría Conductual
 * ============================================================
 * SDK ligero, agnóstico de UI, para detección de fraude mediante
 * análisis de patrones de interacción humana en formularios web.
 *
 * PRINCIPIO DE PRIVACIDAD POR DISEÑO (regla estricta del proyecto):
 * Este SDK NUNCA lee, almacena ni transmite el valor real de los
 * campos (e.target.value). Únicamente observa METADATOS de la
 * interacción: timestamps, conteo de eventos y presencia de
 * "paste". Ningún dato personal ni sensible pasa por este archivo.
 *
 * Funciona igual sin importar el formulario o el portal donde se
 * use: basta con pasarle una referencia a un <form>.
 * ============================================================
 */

export class EscudoBehavioral {
  /**
   * @param {HTMLFormElement} formElement - Formulario a instrumentar.
   * @param {Object} [config] - Configuración opcional del motor de riesgo.
   * @param {number} [config.minFillTimeMs=1500] - Umbral (ms) por debajo
   *        del cual el llenado se considera sospechosamente rápido
   *        (posible bot / script / relleno automático).
   */
  constructor(formElement, config = {}) {
    if (!(formElement instanceof HTMLFormElement)) {
      throw new Error('[EscudoBehavioral] Se requiere un elemento <form> válido.');
    }

    this.form = formElement;
    this.config = {
      minFillTimeMs: config.minFillTimeMs ?? 1500,
      ...config,
    };

    // --- Estado interno de telemetría (NO contiene datos sensibles) ---
    this.telemetry = this._telemetryInicial();

    // Bind único de los handlers para poder removerlos luego en destroy()
    this._onKeydown = this._handleKeydown.bind(this);
    this._onPaste = this._handlePaste.bind(this);

    this._init();
  }

  /**
   * Estructura base del estado de telemetría.
   */
  _telemetryInicial() {
    return {
      startTime: null,          // performance.now() del primer evento
      endTime: null,            // performance.now() del último evento
      keyPressCount: 0,         // total de teclas presionadas (solo conteo)
      pasteCount: 0,            // total de eventos "paste" detectados
      fieldsTouched: new Set(), // identificadores de campos tocados (no valores)
    };
  }

  /**
   * Inyecta los listeners en todos los inputs/textareas del formulario.
   */
  _init() {
    const campos = this.form.querySelectorAll('input, textarea');

    campos.forEach((campo) => {
      campo.addEventListener('keydown', this._onKeydown);
      campo.addEventListener('paste', this._onPaste);
    });

    this._fieldCount = campos.length;
    console.info(`[EscudoBehavioral] SDK inicializado. Monitoreando ${campos.length} campo(s).`);
  }

  /**
   * Handler de keydown. SOLO cuenta el evento; jamás lee e.target.value.
   * @param {KeyboardEvent} e
   */
  _handleKeydown(e) {
    const ahora = performance.now();

    if (this.telemetry.startTime === null) {
      this.telemetry.startTime = ahora;
    }

    this.telemetry.keyPressCount += 1;
    this.telemetry.endTime = ahora;

    // Registramos QUÉ campo se tocó (su identificador), nunca su valor
    const identificador = e.target?.name || e.target?.id;
    if (identificador) {
      this.telemetry.fieldsTouched.add(identificador);
    }
  }

  /**
   * Handler de paste. Detectar pegado es una señal fuerte de
   * autocompletado por script, gestor de credenciales robotizado
   * o llenado masivo no humano.
   * @param {ClipboardEvent} e
   */
  _handlePaste(e) {
    const ahora = performance.now();

    if (this.telemetry.startTime === null) {
      this.telemetry.startTime = ahora;
    }

    this.telemetry.pasteCount += 1;
    this.telemetry.endTime = ahora;
  }

  /**
   * Duración total del llenado, en milisegundos.
   * @returns {number}
   */
  _getFillDuration() {
    const { startTime, endTime } = this.telemetry;
    if (startTime === null || endTime === null) return 0;
    return Math.round(endTime - startTime);
  }

  /**
   * Motor de reglas de riesgo. Evalúa la telemetría capturada hasta
   * el momento y devuelve un veredicto accionable para el flujo de negocio.
   *
   * Reglas (MVP):
   *  - Si el llenado total fue menor a `minFillTimeMs` → alto riesgo.
   *  - Si hubo al menos un evento de "paste"           → alto riesgo.
   *  - En cualquier otro caso                           → riesgo bajo.
   *
   * @returns {{
   *   score: number,
   *   action: 'PASS'|'STEP_UP',
   *   reasons: string[],
   *   meta: {
   *     fillDurationMs: number,
   *     keyPressCount: number,
   *     pasteCount: number,
   *     fieldsTouched: string[],
   *     evaluatedAt: string
   *   }
   * }}
   */
  evaluarRiesgo() {
    const fillDuration = this._getFillDuration();
    const huboPaste = this.telemetry.pasteCount > 0;
    const fueMuyRapido = fillDuration > 0 && fillDuration < this.config.minFillTimeMs;

    const reasons = [];
    if (fueMuyRapido) reasons.push(`Llenado sospechosamente rápido (${fillDuration}ms)`);
    if (huboPaste) reasons.push(`Se detectaron ${this.telemetry.pasteCount} evento(s) de pegado`);

    const esAltoRiesgo = fueMuyRapido || huboPaste;

    return {
      // Contrato exigido por el motor de negocio:
      score: esAltoRiesgo ? 92 : 12,
      action: esAltoRiesgo ? 'STEP_UP' : 'PASS',
      // Contexto adicional útil para logging / backend (no rompe el contrato):
      reasons: reasons.length ? reasons : ['Patrón de interacción consistente con comportamiento humano'],
      meta: {
        fillDurationMs: fillDuration,
        keyPressCount: this.telemetry.keyPressCount,
        pasteCount: this.telemetry.pasteCount,
        fieldsTouched: Array.from(this.telemetry.fieldsTouched),
        evaluatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Reinicia la telemetría sin desconectar los listeners.
   * Útil si el mismo formulario se reutiliza tras un STEP_UP.
   */
  reset() {
    this.telemetry = this._telemetryInicial();
  }

  /**
   * Remueve todos los listeners inyectados (cleanup).
   * Recomendado si el formulario se desmonta dinámicamente.
   */
  destroy() {
    const campos = this.form.querySelectorAll('input, textarea');
    campos.forEach((campo) => {
      campo.removeEventListener('keydown', this._onKeydown);
      campo.removeEventListener('paste', this._onPaste);
    });
  }
}

export default EscudoBehavioral;
