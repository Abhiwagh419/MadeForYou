import { registry, type Content } from "@madeforyou/schema";
import { blockSummary } from "../state/editor";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { BLOCK_INFO } from "./blockInfo";

export function BlockList({
  content, selected, onSelect, onMove, onToggle, onAdd,
}: {
  content: Content; selected: string | null; onSelect: (id: string) => void;
  onMove: (id: string, d: -1 | 1) => void; onToggle: (id: string) => void; onAdd: () => void;
}) {
  return (
    <div className="blocklist">
      <ol>
        {content.blocks.map((b, i) => {
          const def = registry[b.type];
          const summary = blockSummary(b);
          return (
            <li key={b.id} className={`${selected === b.id ? "on" : ""} ${b.visible ? "" : "off"}`}>
              <button type="button" className="bl-main" onClick={() => onSelect(b.id)}>
                <span className="bl-icon"><Icon name={BLOCK_INFO[b.type]?.icon ?? "layers"} size={18} /></span>
                <span className="bl-text">
                  <strong>{def?.label ?? b.type}</strong>
                  <small>{summary || (b.visible ? "Sample text" : "Hidden")}</small>
                </span>
              </button>
              <span className="bl-actions">
                <button type="button" onClick={() => onMove(b.id, -1)} disabled={i === 0} aria-label={`Move ${def?.label} up`}><Icon name="up" size={16} /></button>
                <button type="button" onClick={() => onMove(b.id, 1)} disabled={i === content.blocks.length - 1} aria-label={`Move ${def?.label} down`}><Icon name="down" size={16} /></button>
                <button type="button" onClick={() => onToggle(b.id)} aria-label={b.visible ? "Hide" : "Show"}><Icon name={b.visible ? "eye" : "eyeoff"} size={16} /></button>
              </span>
            </li>
          );
        })}
      </ol>
      <Button variant="soft" icon="plus" onClick={onAdd} className="bl-add">Add a block</Button>
    </div>
  );
}
