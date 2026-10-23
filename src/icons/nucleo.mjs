// Núcleo (core): the 50 icons the set started with, used by flouvia.com. Paths are precomputed
// with engine/geometry.mjs; new icons are drawn with the engine, never by hand. See DESIGN.md.
const icons = {
  'alert': {
    tags: ["aviso", "advertencia", "warning"],
    d: [
      'M9.74 7.05A2.6 2.6 0 0 1 14.26 7.05L19.72 16.61A2.2 2.2 0 0 1 17.81 19.9L6.19 19.9A2.2 2.2 0 0 1 4.28 16.61Z',
      'M12 9.15v3.9',
      'M11.3 16.75A0.7 0.7 0 1 0 12.7 16.75A0.7 0.7 0 1 0 11.3 16.75Z',
    ],
  },
  'important': {
    tags: ["importante", "exclamación", "alert"],
    d: [
      'M3 12A9 9 0 1 0 21 12A9 9 0 1 0 3 12Z',
      'M12 7.25v5.35',
      'M11.3 16.3A0.7 0.7 0 1 0 12.7 16.3A0.7 0.7 0 1 0 11.3 16.3Z',
    ],
  },
  'chevron-right': {
    tags: ["avanzar", "siguiente", "next"],
    d: [
      'M9.25 5.25 16 12l-6.75 6.75',
    ],
  },
  'chevron-left': {
    tags: ["volver", "anterior", "previous"],
    d: [
      'M14.75 5.25 8 12l6.75 6.75',
    ],
  },
  'arrow-right': {
    tags: ["flecha", "derecha", "arrow"],
    d: [
      'M3.75 12h16',
      'M13.75 6l6 6-6 6',
    ],
  },
  'check': {
    tags: ["listo", "hecho", "done"],
    d: [
      'M4.75 12.6l4.6 4.65L19.25 6.9',
    ],
  },
  'check-large': {
    tags: ["listo", "confirmar", "confirm"],
    d: [
      'M3.5 12.25l5.75 5.75L20.5 6.25',
    ],
  },
  'close': {
    tags: ["cerrar", "quitar", "close"],
    d: [
      'M6.5 6.5l11 11',
      'M17.5 6.5l-11 11',
    ],
  },
  'close-large': {
    tags: ["cerrar", "cancelar", "cancel"],
    d: [
      'M5 5l14 14',
      'M19 5 5 19',
    ],
  },
  'plus': {
    tags: ["agregar", "nuevo", "add"],
    d: [
      'M12 4.25v15.5',
      'M4.25 12h15.5',
    ],
  },
  'more': {
    tags: ["más", "opciones", "more"],
    d: [
      'M4.2 12A0.8 0.8 0 1 0 5.8 12A0.8 0.8 0 1 0 4.2 12Z',
      'M11.2 12A0.8 0.8 0 1 0 12.8 12A0.8 0.8 0 1 0 11.2 12Z',
      'M18.2 12A0.8 0.8 0 1 0 19.8 12A0.8 0.8 0 1 0 18.2 12Z',
    ],
  },
  'search': {
    tags: ["buscar", "lupa", "search"],
    d: [
      'M3.75 10.6A6.85 6.85 0 1 0 17.45 10.6A6.85 6.85 0 1 0 3.75 10.6Z',
      'M15.6 15.6l4.9 4.9',
    ],
  },
  'refresh': {
    tags: ["actualizar", "recargar", "reload"],
    d: [
      'M18.38 7.41A8.1 8.1 0 1 1 10.87 4.38',
      'M8.05 2.48L11.17 4.34L8.69 6.98',
    ],
  },
  'edit': {
    tags: ["editar", "lápiz", "pencil"],
    d: [
      // The end is a half circle: its radius is exactly half the body's width (2.1 bulged it flat)
      'M5.58 15.45L17.12 3.92A2.093 2.093 0 0 1 20.08 6.88L8.55 18.42L4.1 19.9Z',
      'M14.71 6.32L17.68 9.29',
      'M5.58 15.45L8.55 18.42',
    ],
  },
  'link': {
    tags: ["enlace", "vínculo", "link"],
    d: [
      'M13.06 15.53 10.59 18.01A3.25 3.25 0 0 1 5.99 13.41L8.47 10.94',
      'M10.94 8.47 13.41 5.99A3.25 3.25 0 0 1 18.01 10.59L15.53 13.06',
      'M10.23 13.77 13.77 10.23',
    ],
  },
  'send': {
    tags: ["enviar", "avión de papel", "send"],
    d: [
      'M18.7 3.88A1.1 1.1 0 0 1 20.12 5.3L15.28 17.92A1.3 1.3 0 0 1 12.86 17.94L11 13.34A0.6 0.6 0 0 0 10.66 13L6.06 11.14A1.3 1.3 0 0 1 6.08 8.72Z',
      'M10.9 13.1L20.6 3.4',
    ],
  },
  'pin': {
    tags: ["fijar", "chincheta", "pin"],
    d: [
      'M8.75 3.25h6.5',
      'M9.9 3.25 9.4 8.3c-.06.6-.33 1.15-.76 1.57L6.6 11.9V12.75h10.8V11.9l-2.04-2.03a2.6 2.6 0 0 1-.76-1.57l-.5-5.05',
      'M12 12.75v8',
    ],
  },
  'person': {
    tags: ["persona", "usuario", "user"],
    d: [
      // Head and shoulders 2.45 apart (centerlines): apart at every weight up to 2.1
      'M8.3 7.45A3.7 3.7 0 1 0 15.7 7.45A3.7 3.7 0 1 0 8.3 7.45Z',
      'M6.35 20.6h11.3a1.6 1.6 0 0 0 1.57-1.92C18.5 15.45 15.6 13.6 12 13.6s-6.5 1.85-7.22 5.08A1.6 1.6 0 0 0 6.35 20.6Z',
    ],
  },
  'clients': {
    tags: ["clientes", "equipo", "users"],
    d: [
      'M5.75 8.3A3.35 3.35 0 1 0 12.45 8.3A3.35 3.35 0 1 0 5.75 8.3Z',
      'M4.45 20.6h9.3a1.45 1.45 0 0 0 1.43-1.72C14.6 16 12.2 14.3 9.1 14.3s-5.5 1.7-6.08 4.58A1.45 1.45 0 0 0 4.45 20.6Z',
      'M14.44 4.23A3.1 3.1 0 1 1 15.33 10.19',
      'M17.2 13.15c2.35.5 3.9 2.15 4.32 4.43a1.45 1.45 0 0 1-1.43 1.72h-1.6',
    ],
  },
  'comment': {
    tags: ["comentario", "gota", "chat"],
    d: [
      'M20.75 11.75V20.5H12A8.75 8.75 0 0 1 3.25 11.75A8.75 8.75 0 0 1 12 3A8.75 8.75 0 0 1 20.75 11.75Z',
    ],
  },
  'message': {
    tags: ["mensaje", "conversación", "chat"],
    d: [
      'M20.75 11.75V20.5H12A8.75 8.75 0 0 1 3.25 11.75A8.75 8.75 0 0 1 12 3A8.75 8.75 0 0 1 20.75 11.75Z',
      'M8 10.25h7.5',
      'M8 13.75h4.25',
    ],
  },
  'mail': {
    tags: ["correo", "sobre", "email"],
    d: [
      'M15.1 5c2.24 0 3.36 0 4.22 0.44a4 4 0 0 1 1.75 1.75c0.44 0.86 0.44 1.98 0.44 4.22L21.5 19L8.9 19c-2.24 0 -3.36 0 -4.22 -0.44a4 4 0 0 1 -1.75 -1.75c-0.44 -0.86 -0.44 -1.98 -0.44 -4.22L2.5 11.4c0 -2.24 0 -3.36 0.44 -4.22a4 4 0 0 1 1.75 -1.75c0.86 -0.44 1.98 -0.44 4.22 -0.44Z',
      'M6.6 9.2l4.53 3.17a1.5 1.5 0 0 0 1.74 0L17.4 9.2',
    ],
  },
  'phone': {
    tags: ["teléfono", "llamada", "call"],
    d: [
      'M8.55 3.3c.6.08 1.1.47 1.33 1.03l1.1 2.75c.27.68.08 1.45-.47 1.92l-1.3 1.12a11.8 11.8 0 0 0 4.97 4.97l1.12-1.3a1.7 1.7 0 0 1 1.92-.47l2.75 1.1c.56.23.95.73 1.03 1.33.25 1.83-.6 3.5-2.35 3.95-1.3.33-2.8.17-4.45-.45A17.2 17.2 0 0 1 4.4 10.55C3.78 8.9 3.62 7.4 3.95 6.1 4.4 4.35 6.07 3.05 8.55 3.3Z',
    ],
  },
  'inbox': {
    tags: ["bandeja", "entrada", "inbox"],
    d: [
      'M14.6 3.75c2.24 0 3.36 0 4.22 0.44a4 4 0 0 1 1.75 1.75c0.44 0.86 0.44 1.98 0.44 4.22L21 20.25L9.4 20.25c-2.24 0 -3.36 0 -4.22 -0.44a4 4 0 0 1 -1.75 -1.75c-0.44 -0.86 -0.44 -1.98 -0.44 -4.22L3 10.15c0 -2.24 0 -3.36 0.44 -4.22a4 4 0 0 1 1.75 -1.75c0.86 -0.44 1.98 -0.44 4.22 -0.44Z',
      'M3 13.25h3.9c.47 0 .9.27 1.1.69l.55 1.12c.2.42.63.69 1.1.69h2.7c.47 0 .9-.27 1.1-.69l.55-1.12c.2-.42.63-.69 1.1-.69H21',
    ],
  },
  'briefcase': {
    tags: ["maletín", "trabajo", "work"],
    d: [
      'M14.85 7.25c2.24 0 3.36 0 4.22 0.44a4 4 0 0 1 1.75 1.75c0.44 0.86 0.44 1.98 0.44 4.22L21.25 20.25L9.15 20.25c-2.24 0 -3.36 0 -4.22 -0.44a4 4 0 0 1 -1.75 -1.75c-0.44 -0.86 -0.44 -1.98 -0.44 -4.22L2.75 13.65c0 -2.24 0 -3.36 0.44 -4.22a4 4 0 0 1 1.75 -1.75c0.86 -0.44 1.98 -0.44 4.22 -0.44Z',
      'M8.6 7.25V5.6a1.85 1.85 0 0 1 1.85-1.85h3.1a1.85 1.85 0 0 1 1.85 1.85v1.65',
      'M2.75 13h18.5',
    ],
  },
  'briefcase-clasp': {
    tags: ["maletín", "negocio", "business"],
    d: [
      'M14.85 7.25c2.24 0 3.36 0 4.22 0.44a4 4 0 0 1 1.75 1.75c0.44 0.86 0.44 1.98 0.44 4.22L21.25 20.25L9.15 20.25c-2.24 0 -3.36 0 -4.22 -0.44a4 4 0 0 1 -1.75 -1.75c-0.44 -0.86 -0.44 -1.98 -0.44 -4.22L2.75 13.65c0 -2.24 0 -3.36 0.44 -4.22a4 4 0 0 1 1.75 -1.75c0.86 -0.44 1.98 -0.44 4.22 -0.44Z',
      'M8.6 7.25V5.6a1.85 1.85 0 0 1 1.85-1.85h3.1a1.85 1.85 0 0 1 1.85 1.85v1.65',
      'M2.75 13h7.5',
      'M13.75 13h7.5',
      'M12.31 11.75c0.5 0 0.76 0 0.95 0.1a0.9 0.9 0 0 1 0.39 0.39c0.1 0.19 0.1 0.44 0.1 0.95L13.75 13.06c0 0.5 0 0.76 -0.1 0.95a0.9 0.9 0 0 1 -0.39 0.39c-0.19 0.1 -0.44 0.1 -0.95 0.1L11.69 14.5c-0.5 0 -0.76 0 -0.95 -0.1a0.9 0.9 0 0 1 -0.39 -0.39c-0.1 -0.19 -0.1 -0.44 -0.1 -0.95L10.25 13.19c0 -0.5 0 -0.76 0.1 -0.95a0.9 0.9 0 0 1 0.39 -0.39c0.19 -0.1 0.44 -0.1 0.95 -0.1Z',
    ],
  },
  'calendar': {
    tags: ["calendario", "fecha", "date"],
    d: [
      'M14.6 4.75c2.24 0 3.36 0 4.22 0.44a4 4 0 0 1 1.75 1.75c0.44 0.86 0.44 1.98 0.44 4.22L21 21L9.4 21c-2.24 0 -3.36 0 -4.22 -0.44a4 4 0 0 1 -1.75 -1.75c-0.44 -0.86 -0.44 -1.98 -0.44 -4.22L3 11.15c0 -2.24 0 -3.36 0.44 -4.22a4 4 0 0 1 1.75 -1.75c0.86 -0.44 1.98 -0.44 4.22 -0.44Z',
      'M8 2.9v3.6',
      'M16 2.9v3.6',
      'M3 9.75h18',
      'M7.7 13.75A0.3 0.3 0 1 0 8.3 13.75A0.3 0.3 0 1 0 7.7 13.75Z',
      'M11.7 13.75A0.3 0.3 0 1 0 12.3 13.75A0.3 0.3 0 1 0 11.7 13.75Z',
      'M15.7 13.75A0.3 0.3 0 1 0 16.3 13.75A0.3 0.3 0 1 0 15.7 13.75Z',
      'M7.7 17.1A0.3 0.3 0 1 0 8.3 17.1A0.3 0.3 0 1 0 7.7 17.1Z',
      'M11.7 17.1A0.3 0.3 0 1 0 12.3 17.1A0.3 0.3 0 1 0 11.7 17.1Z',
    ],
  },
  'card': {
    tags: ["tarjeta", "pago", "card"],
    d: [
      'M15.5 5c2.1 0 3.15 0 3.95 0.41a3.75 3.75 0 0 1 1.64 1.64c0.41 0.8 0.41 1.85 0.41 3.95L21.5 19L8.5 19c-2.1 0 -3.15 0 -3.95 -0.41a3.75 3.75 0 0 1 -1.64 -1.64c-0.41 -0.8 -0.41 -1.85 -0.41 -3.95L2.5 11c0 -2.1 0 -3.15 0.41 -3.95a3.75 3.75 0 0 1 1.64 -1.64c0.8 -0.41 1.85 -0.41 3.95 -0.41Z',
      'M2.5 9.6h19',
      'M6.25 15h3.5',
    ],
  },
  'clock': {
    tags: ["reloj", "hora", "time"],
    d: [
      'M3 12A9 9 0 1 0 21 12A9 9 0 1 0 3 12Z',
      'M12 7.1v5.15l3.3 2.05',
    ],
  },
  'document': {
    tags: ["documento", "archivo", "file"],
    d: [
      'M13.25 2.75c2.1 0 3.15 0 3.95 0.41a3.75 3.75 0 0 1 1.64 1.64c0.41 0.8 0.41 1.85 0.41 3.95L19.25 21.25L10.75 21.25c-2.1 0 -3.15 0 -3.95 -0.41a3.75 3.75 0 0 1 -1.64 -1.64c-0.41 -0.8 -0.41 -1.85 -0.41 -3.95L4.75 8.75c0 -2.1 0 -3.15 0.41 -3.95a3.75 3.75 0 0 1 1.64 -1.64c0.8 -0.41 1.85 -0.41 3.95 -0.41Z',
      'M8.75 8.25h6.5',
      'M8.75 12h6.5',
      'M8.75 15.75h3.75',
    ],
  },
  'folder': {
    tags: ["carpeta", "archivos", "folder"],
    d: [
      'M2.75 7.35a2.85 2.85 0 0 1 2.85-2.85h2.83c.66 0 1.3.27 1.77.74l.93.93c.47.47 1.1.73 1.77.73h5.5a2.85 2.85 0 0 1 2.85 2.85v9.75H5.6a2.85 2.85 0 0 1-2.85-2.85Z',
      'M2.75 10.25h18.5',
    ],
  },
  'project': {
    tags: ["proyecto", "lista", "project"],
    d: [
      'M13.95 3.25c2.38 0 3.57 0 4.48 0.46a4.25 4.25 0 0 1 1.86 1.86c0.46 0.91 0.46 2.1 0.46 4.48L20.75 20.75L10.05 20.75c-2.38 0 -3.57 0 -4.48 -0.46a4.25 4.25 0 0 1 -1.86 -1.86c-0.46 -0.91 -0.46 -2.1 -0.46 -4.48L3.25 10.05c0 -2.38 0 -3.57 0.46 -4.48a4.25 4.25 0 0 1 1.86 -1.86c0.91 -0.46 2.1 -0.46 4.48 -0.46Z',
      'M7.6 8.6h8.8',
      'M7.6 12h5.6',
      'M7.6 15.4h7.2',
    ],
  },
  'roadmap': {
    tags: ["ruta", "plan", "roadmap"],
    d: [
      'M3.4 18.25A2.35 2.35 0 1 0 8.1 18.25A2.35 2.35 0 1 0 3.4 18.25Z',
      'M15.9 5.75A2.35 2.35 0 1 0 20.6 5.75A2.35 2.35 0 1 0 15.9 5.75Z',
      'M8.1 18.25H14a4.25 4.25 0 0 0 4.25-4.25V8.1',
    ],
  },
  'ticket': {
    tags: ["boleto", "cupón", "ticket"],
    d: [
      'M2.75 7.6A2.85 2.85 0 0 1 5.6 4.75h12.8a2.85 2.85 0 0 1 2.85 2.85v2.15a2.25 2.25 0 0 0 0 4.5v2.15a2.85 2.85 0 0 1-2.85 2.85H5.6a2.85 2.85 0 0 1-2.85-2.85v-2.15a2.25 2.25 0 0 0 0-4.5Z',
      'M15 7.75v2.75',
      'M15 13.5v2.75',
    ],
  },
  'globe': {
    tags: ["globo", "mundo", "web"],
    d: [
      'M3 12A9 9 0 1 0 21 12A9 9 0 1 0 3 12Z',
      'M3 12h18',
      'M12 3c2.45 2.5 3.7 5.5 3.7 9s-1.25 6.5-3.7 9c-2.45-2.5-3.7-5.5-3.7-9s1.25-6.5 3.7-9Z',
    ],
  },
  'lock': {
    tags: ["candado", "seguro", "lock"],
    d: [
      'M13.65 10.25c1.96 0 2.94 0 3.69 0.38a3.5 3.5 0 0 1 1.53 1.53c0.38 0.75 0.38 1.73 0.38 3.69L19.25 21.25L10.35 21.25c-1.96 0 -2.94 0 -3.69 -0.38a3.5 3.5 0 0 1 -1.53 -1.53c-0.38 -0.75 -0.38 -1.73 -0.38 -3.69L4.75 15.85c0 -1.96 0 -2.94 0.38 -3.69a3.5 3.5 0 0 1 1.53 -1.53c0.75 -0.38 1.73 -0.38 3.69 -0.38Z',
      'M8.1 10.25V7.4a3.9 3.9 0 0 1 7.8 0v2.85',
      'M12 14.4v2.5',
    ],
  },
  'key': {
    tags: ["llave", "acceso", "key"],
    d: [
      'M3.5 15.9A4.6 4.6 0 1 0 12.7 15.9A4.6 4.6 0 1 0 3.5 15.9Z',
      'M6.05 17.4A0.55 0.55 0 1 0 7.15 17.4A0.55 0.55 0 1 0 6.05 17.4Z',
      'M11.35 12.65 20.25 3.75',
      'M17.3 6.7l2.3 2.3',
      'M14.8 9.2l1.85 1.85',
    ],
  },
  'shield': {
    tags: ["escudo", "protección", "security"],
    d: [
      'M11.3 3.15a2 2 0 0 1 1.4 0l5.65 2.12c.6.23 1 .8 1 1.44v4.92c0 4.6-2.95 8.1-7.35 9.82-4.4-1.72-7.35-5.22-7.35-9.82V6.71c0-.64.4-1.21 1-1.44Z',
      'M8.85 12.05l2.2 2.2 4.15-4.6',
    ],
  },
  'speaker': {
    tags: ["bocina", "sonido", "speaker"],
    d: [
      'M3.6 9.85A1.85 1.85 0 0 1 5.45 8H7.3l3.86-3.22a.8.8 0 0 1 1.31.62v13.2a.8.8 0 0 1-1.31.62L7.3 16H5.45a1.85 1.85 0 0 1-1.85-1.85Z',
    ],
  },
  'waves': {
    tags: ["ondas", "sonido", "sound"],
    d: [
      'M15.5 9.39A3.9 3.9 0 0 1 15.5 14.61',
      'M17.97 6.63A7.6 7.6 0 0 1 17.97 17.37',
    ],
  },
  'mute': {
    tags: ["silencio", "sin sonido", "mute"],
    d: [
      'M16.4 9.6l4.8 4.8',
      'M21.2 9.6l-4.8 4.8',
    ],
  },
  'columns': {
    tags: ["tabla", "columnas", "table"],
    d: [
      'M13.95 3.25c2.38 0 3.57 0 4.48 0.46a4.25 4.25 0 0 1 1.86 1.86c0.46 0.91 0.46 2.1 0.46 4.48L20.75 20.75L10.05 20.75c-2.38 0 -3.57 0 -4.48 -0.46a4.25 4.25 0 0 1 -1.86 -1.86c-0.46 -0.91 -0.46 -2.1 -0.46 -4.48L3.25 10.05c0 -2.38 0 -3.57 0.46 -4.48a4.25 4.25 0 0 1 1.86 -1.86c0.91 -0.46 2.1 -0.46 4.48 -0.46Z',
      'M3.25 9.1h17.5',
      'M9.1 9.1v11.65',
      'M14.9 9.1v11.65',
    ],
  },
  'layers': {
    tags: ["capas", "pila", "layers"],
    d: [
      'M2.75 12.3 12 16.95l9.25-4.65',
      'M2.75 16.6 12 21.25l9.25-4.65',
      'M11.41 3.4A1.3 1.3 0 0 1 12.59 3.4L19.1 6.69A1.3 1.3 0 0 1 19.1 9.01L12.59 12.3A1.3 1.3 0 0 1 11.41 12.3L4.9 9.01A1.3 1.3 0 0 1 4.9 6.69Z',
    ],
  },
  'code': {
    tags: ["código", "desarrollo", "code"],
    d: [
      'M8.15 7.1 3.25 12l4.9 4.9',
      'M13.1 5.25 10.9 18.75',
      'M15.85 7.1l4.9 4.9-4.9 4.9',
    ],
  },
  'sliders': {
    tags: ["ajustes", "controles", "sliders"],
    d: [
      'M5.5 3.25v8.1',
      'M5.5 15.65v5.1',
      'M12 3.25v3.1',
      'M12 10.65v10.1',
      'M18.5 3.25v9.6',
      'M18.5 17.15v3.6',
      'M3.35 13.5A2.15 2.15 0 1 0 7.65 13.5A2.15 2.15 0 1 0 3.35 13.5Z',
      'M9.85 8.5A2.15 2.15 0 1 0 14.15 8.5A2.15 2.15 0 1 0 9.85 8.5Z',
      'M16.35 15A2.15 2.15 0 1 0 20.65 15A2.15 2.15 0 1 0 16.35 15Z',
    ],
  },
  'bolt': {
    tags: ["rayo", "rápido", "flash"],
    d: [
      'M13.05 5.31A0.8 0.8 0 0 0 11.64 4.7L5.85 11.63A1.2 1.2 0 0 0 6.77 13.6L11.03 13.6A0.5 0.5 0 0 1 11.53 14.16L10.95 18.69A0.8 0.8 0 0 0 12.36 19.3L18.15 12.37A1.2 1.2 0 0 0 17.23 10.4L12.97 10.4A0.5 0.5 0 0 1 12.47 9.84Z',
    ],
  },
  'box': {
    tags: ["caja", "paquete", "package"],
    d: [
      'M3.75 7.6 12 12.05l8.25-4.45',
      'M12 12.05v8.9',
      'M11.24 3.16A1.6 1.6 0 0 1 12.76 3.16L19.76 6.95A1.6 1.6 0 0 1 20.6 8.35L20.6 15.65A1.6 1.6 0 0 1 19.76 17.05L12.76 20.84A1.6 1.6 0 0 1 11.24 20.84L4.24 17.05A1.6 1.6 0 0 1 3.4 15.65L3.4 8.35A1.6 1.6 0 0 1 4.24 6.95Z',
    ],
  },
  'database': {
    tags: ["base de datos", "datos", "database"],
    d: [
      'M20.4 12c0 1.66-3.76 3-8.4 3s-8.4-1.34-8.4-3',
      'M3.6 6.1v11.8c0 1.66 3.76 3 8.4 3s8.4-1.34 8.4-3V6.1',
      'M3.6 6.1c0-1.66 3.76-3 8.4-3s8.4 1.34 8.4 3-3.76 3-8.4 3-8.4-1.34-8.4-3Z',
    ],
  },
  'apps': {
    tags: ["apps", "módulos", "grid"],
    d: [
      'M17.23 3.25c1.23 0 1.85 0 2.32 0.24a2.2 2.2 0 0 1 0.96 0.96c0.24 0.47 0.24 1.09 0.24 2.32L20.75 7.23c0 1.23 0 1.85 -0.24 2.32a2.2 2.2 0 0 1 -0.96 0.96c-0.47 0.24 -1.09 0.24 -2.32 0.24L16.77 10.75c-1.23 0 -1.85 0 -2.32 -0.24a2.2 2.2 0 0 1 -0.96 -0.96c-0.24 -0.47 -0.24 -1.09 -0.24 -2.32L13.25 6.77c0 -1.23 0 -1.85 0.24 -2.32a2.2 2.2 0 0 1 0.96 -0.96c0.47 -0.24 1.09 -0.24 2.32 -0.24Z',
      'M7.23 13.25c1.23 0 1.85 0 2.32 0.24a2.2 2.2 0 0 1 0.96 0.96c0.24 0.47 0.24 1.09 0.24 2.32L10.75 17.23c0 1.23 0 1.85 -0.24 2.32a2.2 2.2 0 0 1 -0.96 0.96c-0.47 0.24 -1.09 0.24 -2.32 0.24L6.77 20.75c-1.23 0 -1.85 0 -2.32 -0.24a2.2 2.2 0 0 1 -0.96 -0.96c-0.24 -0.47 -0.24 -1.09 -0.24 -2.32L3.25 16.77c0 -1.23 0 -1.85 0.24 -2.32a2.2 2.2 0 0 1 0.96 -0.96c0.47 -0.24 1.09 -0.24 2.32 -0.24Z',
      'M7.23 3.25c1.23 0 1.85 0 2.32 0.24a2.2 2.2 0 0 1 0.96 0.96c0.24 0.47 0.24 1.09 0.24 2.32L10.75 7.23c0 1.23 0 1.85 -0.24 2.32a2.2 2.2 0 0 1 -0.96 0.96c-0.47 0.24 -1.09 0.24 -2.32 0.24L6.77 10.75c-1.23 0 -1.85 0 -2.32 -0.24a2.2 2.2 0 0 1 -0.96 -0.96c-0.24 -0.47 -0.24 -1.09 -0.24 -2.32L3.25 6.77c0 -1.23 0 -1.85 0.24 -2.32a2.2 2.2 0 0 1 0.96 -0.96c0.47 -0.24 1.09 -0.24 2.32 -0.24Z',
      'M17.23 13.25c1.23 0 1.85 0 2.32 0.24a2.2 2.2 0 0 1 0.96 0.96c0.24 0.47 0.24 1.09 0.24 2.32L20.75 20.75L16.77 20.75c-1.23 0 -1.85 0 -2.32 -0.24a2.2 2.2 0 0 1 -0.96 -0.96c-0.24 -0.47 -0.24 -1.09 -0.24 -2.32L13.25 16.77c0 -1.23 0 -1.85 0.24 -2.32a2.2 2.2 0 0 1 0.96 -0.96c0.47 -0.24 1.09 -0.24 2.32 -0.24Z',
    ],
  },
  'bell': {
    tags: ["campana", "avisos", "notifications"],
    d: [
      'M9.85 20.35a2.35 2.35 0 0 0 4.3 0',
      'M12 2.95A6.1 6.1 0 0 0 5.9 9.05V12.95C5.9 13.45 5.75 13.95 5.47 14.37L4.4 15.95C4 16.55 4.43 17.35 5.15 17.35H18.85C19.57 17.35 20 16.55 19.6 15.95L18.53 14.37A2.6 2.6 0 0 1 18.1 12.95V9.05A6.1 6.1 0 0 0 12 2.95Z',
    ],
  },
};

// Each icon's fill, by path index: `solid` is filled (and keeps its stroke, so the silhouette stays
// identical; closed shapes only), `cut` is knocked out at stroke width, `lines` sits on top with a
// 1.5 gap, and `wire` sits on top flush, with no gap (a lock's shackle, a needle).
// Icons made only of open lines (arrows, check, plus…) get no fill. See DESIGN.md › Fill.
const FILL = {
  alert: { solid: [0], cut: [1, 2] },
  important: { solid: [0], cut: [1, 2] },
  more: { solid: [0, 1, 2] },
  edit: { solid: [0], cut: [1, 2] },
  send: { solid: [0], cut: [1] },
  person: { solid: [0, 1] },
  clients: { solid: [0, 1], lines: [2, 3] },
  comment: { solid: [0] },
  message: { solid: [0], cut: [1, 2] },
  mail: { solid: [0], cut: [1] },
  phone: { solid: [0] },
  inbox: { solid: [0], cut: [1] },
  briefcase: { solid: [0], lines: [1], cut: [2] },
  'briefcase-clasp': { solid: [0], lines: [1], cut: [2, 3, 4] },
  calendar: { solid: [0], lines: [1, 2], cut: [3, 4, 5, 6, 7, 8] },
  card: { solid: [0], cut: [1, 2] },
  clock: { solid: [0], cut: [1] },
  document: { solid: [0], cut: [1, 2, 3] },
  folder: { solid: [0], cut: [1] },
  project: { solid: [0], cut: [1, 2, 3] },
  roadmap: { solid: [0, 1], wire: [2] },
  ticket: { solid: [0], cut: [1, 2] },
  globe: { solid: [0], cut: [1, 2] },
  lock: { solid: [0], wire: [1], cut: [2] },
  key: { solid: [0], wire: [2, 3, 4], cut: [1] },
  shield: { solid: [0], cut: [1] },
  speaker: { solid: [0] },
  columns: { solid: [0], cut: [1, 2, 3] },
  layers: { solid: [2], lines: [0, 1] },
  sliders: { solid: [6, 7, 8], wire: [0, 1, 2, 3, 4, 5] },
  bolt: { solid: [0] },
  box: { solid: [2], cut: [0, 1] },
  apps: { solid: [0, 1, 2, 3] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
// Anything filled must be closed: the pin's head (it closes along the top bar),
// the bell's clapper (a half-moon) and the database body
icons.pin.fill = { solid: [`${icons.pin.d[1]}Z`], wire: [icons.pin.d[0], icons.pin.d[2]] };
icons.bell.fill = { solid: [`${icons.bell.d[0]}Z`, icons.bell.d[1]] };
// Open lines only: their filled version is the outline itself
for (const name of ['chevron-right', 'chevron-left', 'arrow-right', 'check', 'check-large', 'close', 'close-large', 'plus', 'search', 'refresh', 'link', 'waves', 'mute', 'code'])
  icons[name].fill = false;
// Database: body and lid filled; the middle curve and the lid's edge are knocked out
icons.database.fill = { solid: [`${icons.database.d[1]}Z`, icons.database.d[2]], cut: [icons.database.d[0], 'M20.4 6.1c0 1.66-3.76 3-8.4 3s-8.4-1.34-8.4-3'] };

// Already enclosed: they don't get enclosed again
icons.important.variants = { circle: false };
icons.clock.variants = { circle: false };
icons.globe.variants = { circle: false };
icons.project.variants = { square: false };
icons.columns.variants = { square: false };
icons.mute.variants = { slash: false };

// A slash through a lone line says nothing: no slashed variant
for (const name of ['chevron-right', 'chevron-left', 'arrow-right', 'check', 'check-large', 'close', 'close-large', 'plus', 'more', 'refresh', 'waves', 'code'])
  icons[name].variants = { ...icons[name].variants, slash: false };

// Mirror: anything that points to one side flips in right-to-left languages
for (const name of ['chevron-right', 'chevron-left', 'arrow-right', 'send', 'speaker', 'waves', 'mute', 'edit']) icons[name].mirror = true;

// Levels: the waves light up from the inside out (value 0–1)
icons.waves.levels = [[0], [1]];

// Motion: each icon's own effect (the generic ones — draw, bounce, replace — need no data).
// parts = indices into d that move; origin = pivot; vector = offset.
// Named parts: what animates or changes on its own (emitted as data-part in the SVG)
icons.bell.parts = { body: [0], clapper: [1] };
icons.clock.parts = { face: [0], hands: [1] };
icons.alert.parts = { shape: [0], mark: [1, 2] };
icons.important.parts = { shape: [0], mark: [1, 2] };
icons.waves.parts = { near: [0], far: [1] };
icons.lock.parts = { body: [0], shackle: [1], keyhole: [2] };
icons.key.parts = { bow: [0, 1], shaft: [2, 3, 4] };
icons.send.parts = { plane: [0], crease: [1] };
icons.bell.motion = { effect: 'ring', origin: [12, 2.95] };
icons.phone.motion = { effect: 'ring', origin: [12, 12] };
icons.refresh.motion = { effect: 'spin', origin: [12, 12.4] };
icons.clock.motion = { effect: 'spin', parts: ['hands'], origin: [12, 12] };
icons.alert.motion = { effect: 'wiggle', origin: [12, 20] };
icons.important.motion = { effect: 'wiggle', origin: [12, 21] };
icons.key.motion = { effect: 'wiggle', origin: [8.1, 15.9] };
icons.send.motion = { effect: 'slide', vector: [2.5, -2.5] };
icons['arrow-right'].motion = { effect: 'slide', vector: [2.5, 0] };
icons['chevron-right'].motion = { effect: 'slide', vector: [2, 0] };
icons['chevron-left'].motion = { effect: 'slide', vector: [-2, 0] };
icons.pin.motion = { effect: 'bounce', vector: [0, -2.5] };
icons.bolt.motion = { effect: 'beat', origin: [12, 12] };
icons.edit.motion = { effect: 'wiggle', origin: [4.1, 19.9] };

export default { category: 'nucleo', label: 'Núcleo', icons };
