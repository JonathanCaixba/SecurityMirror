/**
 * ============================================================
 *  ESCUDO CONDUCTUAL — Controlador de Integración
 * ============================================================
 * Este archivo es 100% agnóstico del portal: funciona igual en
 * NovaFin (index.html) y en Prisma Crédito (prisma.html) SIN
 * ninguna modificación. Solo depende de un contrato mínimo:
 * que exista un <form id="escudo-form"> en la página actual.
 *
 * Esto demuestra que el SDK (escudo-sdk.js) es reutilizable
 * entre distintos clientes/portales con estilos radicalmente
 * distintos, sin acoplarse a su diseño visual.
 * ============================================================
 */

import { EscudoBehavioral } from './escudo-sdk.js';

// Inyecta una vez la keyframe de entrada del toast (independiente del host)
_inyectarEstilosBase();

const form = document.getElementById('escudo-form');

if (form) {
  const escudo = new EscudoBehavioral(form, { minFillTimeMs: 1500 });

  form.addEventListener('submit', (e) => {
    e.preventDefault(); // MVP de demo: nunca navega ni recarga la página

    const resultado = escudo.evaluarRiesgo();

    // Log de depuración / punto de integración con el backend real de riesgo
    console.log('[EscudoBehavioral] Resultado de evaluación:', JSON.stringify(resultado, null, 2));

    if (resultado.action === 'PASS') {
      mostrarAlerta({
        tipo: 'success',
        titulo: 'Verificación exitosa',
        mensaje: 'Tu comportamiento de llenado fue validado correctamente. Continuando con tu solicitud.',
      });
    } else {
      mostrarAlerta({
        tipo: 'warning',
        titulo: 'Verificación adicional requerida',
        mensaje: 'Detectamos un patrón de llenado inusual. Por seguridad, ingresa el código OTP enviado a tu teléfono.',
      });
    }
  });
} else {
  console.warn('[EscudoBehavioral] No se encontró ningún <form id="escudo-form"> en esta página.');
}

/**
 * Renderiza un toast flotante con Tailwind, con variante success/warning.
 * @param {{ tipo: 'success'|'warning', titulo: string, mensaje: string }} opts
 */
function mostrarAlerta({ tipo, titulo, mensaje }) {
  // Evita apilar múltiples toasts si el usuario reenvía el formulario
  document.querySelectorAll('[data-escudo-toast]').forEach((el) => el.remove());

  const esExito = tipo === 'success';

  const toast = document.createElement('div');
  toast.setAttribute('data-escudo-toast', 'true');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.className = [
    'fixed top-6 right-6 left-6 sm:left-auto z-50 sm:w-full sm:max-w-sm',
    'rounded-xl shadow-2xl border p-4',
    'flex items-start gap-3',
    'animate-[escudo-fade-in_0.25s_ease-out]',
    esExito
      ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-50'
      : 'bg-amber-950/95 border-amber-500/40 text-amber-50',
  ].join(' ');

  toast.innerHTML = `
    <div class="flex-shrink-0 mt-0.5">
      ${
        esExito
          ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
               <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75l2.25 2.25 4.5-4.5m6 2.25a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
               <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>`
      }
    </div>

    <div class="flex-1 min-w-0">
      <p class="font-semibold text-sm">${titulo}</p>
      <p class="text-sm opacity-90 mt-1">${mensaje}</p>

      ${
        !esExito
          ? `<div class="mt-3 flex gap-2">
               <label class="sr-only" for="escudo-otp-input">Código OTP</label>
               <input
                 id="escudo-otp-input"
                 type="text"
                 inputmode="numeric"
                 maxlength="6"
                 placeholder="Código OTP"
                 class="w-28 rounded-md bg-black/30 border border-amber-400/40 px-2 py-1 text-sm text-white placeholder-amber-200/50 focus:outline-none focus:ring-2 focus:ring-amber-400"
               />
               <button
                 type="button"
                 data-escudo-otp-submit
                 class="rounded-md bg-amber-400 px-3 py-1 text-sm font-semibold text-amber-950 hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-amber-950 focus:ring-amber-300 transition"
               >
                 Validar
               </button>
             </div>`
          : ''
      }
    </div>

    <button
      type="button"
      data-escudo-toast-close
      class="flex-shrink-0 text-current opacity-60 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current rounded transition"
      aria-label="Cerrar notificación"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  `;

  document.body.appendChild(toast);

  toast.querySelector('[data-escudo-toast-close]')?.addEventListener('click', () => toast.remove());

  const botonOtp = toast.querySelector('[data-escudo-otp-submit]');
  if (botonOtp) {
    botonOtp.addEventListener('click', () => {
      toast.remove();
      mostrarAlerta({
        tipo: 'success',
        titulo: 'Identidad verificada',
        mensaje: 'El código OTP fue validado. Tu solicitud continuará normalmente.',
      });
    });
  }

  // Auto-cierre solo para el mensaje de éxito; el warning espera acción del usuario
  if (esExito) {
    setTimeout(() => toast.remove(), 6000);
  }
}

/**
 * Inyecta una sola vez la keyframe CSS que usa el toast.
 * Vive en JS (no en el HTML del host) para que el SDK sea
 * verdaderamente portable entre portales distintos.
 */
function _inyectarEstilosBase() {
  if (document.getElementById('escudo-base-styles')) return;

  const style = document.createElement('style');
  style.id = 'escudo-base-styles';
  style.textContent = `
    @keyframes escudo-fade-in {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      [data-escudo-toast] { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}
