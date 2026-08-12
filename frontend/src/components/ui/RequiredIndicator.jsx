export default function RequiredIndicator() {
  return (
    <span
      aria-hidden="true"
      title="Required"
      style={{ color: 'var(--color-orange)', marginLeft: 3 }}
    >
      *
    </span>
  );
}
