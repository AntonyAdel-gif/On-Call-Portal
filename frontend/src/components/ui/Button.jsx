// ============================================================================
// BUTTON
// ----------------------------------------------------------------------------
// Every button in the app (submit buttons, "Edit"/"Remove" table actions,
// the header's log in/log out buttons, etc.) used to be a one-off <button>
// with its own hand-copied style object. That meant the same handful of
// looks (orange filled, outlined, underlined text link...) were retyped in
// nearly every file, and tweaking the brand color meant hunting through all
// of them.
//
// Now there's one place that knows what a "primary button" or a "link
// button" looks like. Future developers just pick a `variant` (and
// optionally a `size`) instead of writing a new style object:
//
//   <Button>Save</Button>                              primary, default size
//   <Button variant="secondary" onClick={onCancel}>Cancel</Button>
//   <Button variant="link" onClick={...}>Edit</Button>
//   <Button variant="link" tone="muted" onClick={...}>Remove</Button>
//   <Button size="small" onClick={...}>Send</Button>
//   <Button as={Link} to="/login">Log in</Button>       renders as a react-router Link
//
// Any one-off tweak still works via the normal `style` prop - it's merged
// in last, so it always wins over the variant/size defaults.
// ============================================================================

const VARIANTS = {
  // Solid orange fill. The app's main "do the thing" action.
  primary: {
    backgroundColor: 'var(--color-orange)',
    color: 'var(--color-black)',
    border: 'none',
    fontWeight: 'var(--weight-bold)',
  },
  // Transparent with a grey outline. Secondary/"Cancel"-style actions.
  secondary: {
    backgroundColor: 'transparent',
    color: 'var(--color-white)',
    border: '1px solid var(--color-grey)',
  },
  // Transparent with an orange outline. Used for the header's "Log out".
  outline: {
    backgroundColor: 'transparent',
    color: 'var(--color-orange)',
    border: '1px solid var(--color-orange)',
    fontWeight: 'var(--weight-bold)',
  },
  // No background/border - an underlined text link that behaves like a
  // button. Used for inline table actions ("Edit", team name links, etc.).
  link: {
    background: 'none',
    border: 'none',
    padding: 0,
    color: 'var(--color-orange)',
    fontWeight: 'var(--weight-bold)',
    textDecoration: 'underline',
    fontSize: 'inherit',
  },
};

// `tone="muted"` softens a variant's color - e.g. a "Remove" link that
// should read as less prominent/more destructive than a plain "Edit" link.
const TONES = {
  muted: { color: 'var(--color-grey-light)' },
};

const SIZES = {
  default: { padding: '10px 20px', fontSize: 14 },
  small: { padding: '6px 12px', fontSize: 13 },
};

export default function Button({
  variant = 'primary',
  size = 'default',
  tone,
  as: Component = 'button',
  style,
  ...props
}) {
  // Link-style buttons manage their own padding/size (they should look like
  // inline text, not a boxed button), so the size scale doesn't apply.
  const sizeStyle = variant === 'link' ? null : SIZES[size] ?? SIZES.default;

  return (
    <Component
      style={{
        fontFamily: 'inherit',
        cursor: 'pointer',
        ...VARIANTS[variant],
        ...sizeStyle,
        ...(tone ? TONES[tone] : null),
        ...style,
      }}
      {...props}
    />
  );
}
