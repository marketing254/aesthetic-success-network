export default function Brand({ showPill = true }: { showPill?: boolean }) {
  return (
    <span className="brandmark">
      Aesthetics Success Network
      {showPill && <span className="mono">ASN</span>}
    </span>
  );
}
