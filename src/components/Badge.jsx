const VARIANTS = {
  // ── FUS (estatusParticular) ──────────────────────────────────────────────
  Registrado:     { tint: 'rgba(200,205,215,', text: '#dde1ea', glow: 'rgba(200,205,215,' },
  Turnado:        { tint: 'rgba(96,165,250,',  text: '#bfdbfe', glow: 'rgba(96,165,250,' },
  Atendido:       { tint: 'rgba(251,191,36,',  text: '#fde68a', glow: 'rgba(251,191,36,' },
  Concluido:      { tint: 'rgba(52,211,153,',  text: '#a7f3d0', glow: 'rgba(52,211,153,' },
  // ── Turnado / pivot (estatusTitular) ────────────────────────────────────
  Recibido:       { tint: 'rgba(200,205,215,', text: '#dde1ea', glow: 'rgba(200,205,215,' },
  En_seguimiento: { tint: 'rgba(251,191,36,',  text: '#fde68a', glow: 'rgba(251,191,36,' },
}

const ETIQUETAS = {
  En_seguimiento: 'En seguimiento',
}

const FALLBACK = { tint: 'rgba(200,205,215,', text: '#dde1ea', glow: 'rgba(200,205,215,' }

export default function Badge({ estatus }) {
  const v = VARIANTS[estatus] ?? FALLBACK
  return (
    <span style={{
      background:      `${v.tint}0.13)`,
      color:           v.text,
      border:          `1px solid ${v.tint}0.45)`,
      borderRadius:    '9999px',
      padding:         '2px 10px',
      fontSize:        '0.70rem',
      fontWeight:      700,
      whiteSpace:      'nowrap',
      display:         'inline-block',
      letterSpacing:   '0.25px',
      backdropFilter:  'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      boxShadow:       `0 0 0 1px ${v.tint}0.20), inset 0 1px 0 rgba(255,255,255,0.15)`,
      textShadow:      `0 1px 3px rgba(0,0,0,0.30)`,
    }}>
      {ETIQUETAS[estatus] ?? estatus}
    </span>
  )
}
