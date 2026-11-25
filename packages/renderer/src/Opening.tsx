import { useState } from "react";

export function Opening({ text, onOpen }: { text: string; onOpen: () => void }) {
  const [opening, setOpening] = useState(false);

  const tap = () => {
    if (opening) return;
    setOpening(true);
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(onOpen, reduce ? 0 : 750);
  };

  return (
    <div className="mfy-opening">
      <button type="button" className="mfy-env" data-opening={opening} onClick={tap} aria-label={text}>
        <span className="mfy-seal" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path
              fill="currentColor"
              d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 5 6 5c2 0 3.4 1.1 4.2 2.4h3.6C14.6 6.1 16 5 18 5c3.3 0 5.1 3.4 3.6 6.8C19.5 16.4 12 21 12 21z"
            />
          </svg>
        </span>
      </button>
      <p className="mfy-opening-text">{text}</p>
    </div>
  );
}
