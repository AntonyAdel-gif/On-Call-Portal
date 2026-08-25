// ============================================================================
// ORANGE LOGO
// ----------------------------------------------------------------------------
// A small brand mark inspired by the guideline's "Small logo" rules:
// an orange square containing a solid white bar. i didnt reproduce the official
// trademarked orange logo
//artwork as the brands state to use the original file from brand.orange.com so it is just a demo.
// ============================================================================

export default function OrangeLogo({ size = 32 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: 'var(--color-orange)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: size * 0.12,
        flexShrink: 0,
      }}
      role="img"
      aria-label="On-Call Schedule app logo"
    >
      {/* The solid white bar, sized roughly like the brand's small-logo mark */}
      <div
        style={{
          width: '100%',
          height: size * 0.18,
            backgroundColor: '#ffffff', // always white,
        }}
      />
    </div>
  );
}
