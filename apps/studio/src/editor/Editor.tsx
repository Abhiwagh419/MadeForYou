import { useEffect, useReducer, useRef, useState } from "react";
import { PageRenderer } from "@madeforyou/renderer";
import { registry, type Content } from "@madeforyou/schema";
import { useAssets } from "../lib/assets";
import { useSession } from "../lib/auth";
import { isRemote } from "../lib/config";
import { handleAuthError, pushPage } from "../lib/sync";
import { go, useRoute } from "../lib/router";
import { scrollToBlock } from "../lib/util";
import {
  addBlock, duplicateBlock, editorReducer, initEditor, moveBlock, removeBlock, toggleVisible,
} from "../state/editor";
import { deletePage, getState, savePage, useStore, type PageRecord } from "../state/store";
import { Button } from "../ui/Button";
import { Segmented, Sheet, toast, useMedia } from "../ui/Controls";
import { Icon } from "../ui/Icon";
import { Mark } from "../ui/Logo";
import { PhonePreview } from "../ui/PhonePreview";
import { NotFound } from "../ui/Shell";
import { BlockList } from "./BlockList";
import { BLOCK_INFO } from "./blockInfo";
import { BlockInspector, DesignPanel, SettingsPanel } from "./Inspector";

type Tab = "blocks" | "edit" | "design" | "settings";

export function Editor() {
  const { id = "" } = useRoute().params;
  const page = useStore((s) => s.pages[id]);
  return page ? <EditorInner key={id} page={page} /> : <NotFound />;
}

function Fullscreen({ content, lang, onClose }: { content: Content; lang: string; onClose: () => void }) {
  const resolve = useAssets(content);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fullview">
      <PageRenderer content={content} lang={lang} resolveAsset={resolve} />
      <button type="button" className="fullview-close" onClick={onClose}><Icon name="x" size={18} />Close preview</button>
    </div>
  );
}

function EditorInner({ page }: { page: PageRecord }) {
  const route = useRoute();
  const [state, dispatch] = useReducer(editorReducer, page.content, initEditor);
  const { content } = state;
  const [selected, setSelected] = useState<string | null>(route.query.get("block") ?? content.blocks[0]?.id ?? null);
  const [tab, setTab] = useState<Tab>("edit");
  const [adding, setAdding] = useState(false);
  const [lang, setLang] = useState(content.settings.languages.default);
  const [device, setDevice] = useState<"phone" | "tablet">("phone");
  const [replay, setReplay] = useState(0);
  const [full, setFull] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [sync, setSync] = useState<"idle" | "syncing" | "ok" | "error">("idle");
  const session = useSession();
  const pushed = useRef<Content | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const mobile = useMedia("(max-width: 960px)");

  const defaultLang = content.settings.languages.default;
  const langs = content.settings.languages.available;
  const block = content.blocks.find((b) => b.id === selected) ?? null;
  const apply = (fn: (c: Content) => Content) => dispatch({ type: "apply", fn });

  // autosave
  useEffect(() => {
    if (content === page.content) return;
    setSaving(true);
    const t = setTimeout(() => {
      savePage(page.id, { content });
      setSaving(false);
    }, 400);
    return () => clearTimeout(t);
  }, [content, page.content, page.id]);

  // While signed in, changes also go to the server (a little after you pause), so a published page updates for visitors.
  useEffect(() => {
    if (!isRemote() || !session.userId || content === pushed.current) return;
    const t = setTimeout(async () => {
      const rec = getState().pages[page.id];
      if (!rec) return;
      setSync("syncing");
      try {
        await pushPage({ ...rec, content });
        pushed.current = content;
        setSync("ok");
      } catch (e) {
        setSync("error");
        if (!(await handleAuthError(e)) && sync !== "error") toast((e as Error).message);
      }
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, session.userId, page.id]);

  // keep the language valid if one is switched off
  useEffect(() => {
    if (!langs.includes(lang)) setLang(defaultLang);
  }, [langs, lang, defaultLang]);

  // keep the preview on the block being edited
  useEffect(() => {
    if (selected) scrollToBlock(scroller.current, selected);
  }, [selected]);

  // undo / redo from the keyboard, unless the user is typing
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const select = (id: string, toEdit = true) => {
    setSelected(id);
    if (mobile && toEdit) setTab("edit");
  };

  const insert = (type: string) => {
    const r = addBlock(content, type, selected);
    apply(() => r.content);
    setSelected(r.id);
    setAdding(false);
    if (mobile) setTab("edit");
  };
  const duplicate = () => {
    if (!block) return;
    const r = duplicateBlock(content, block.id);
    apply(() => r.content);
    setSelected(r.id);
  };
  const remove = () => {
    if (!block) return;
    const i = content.blocks.findIndex((b) => b.id === block.id);
    apply((c) => removeBlock(c, block.id));
    setSelected(content.blocks[i + 1]?.id ?? content.blocks[i - 1]?.id ?? null);
    toast("Block removed. Undo brings it back");
  };
  const saveTitle = () => savePage(page.id, { title: title.trim() || "Untitled page" });

  const panelBlocks = (
    <BlockList content={content} selected={selected} onSelect={(id) => select(id)}
      onMove={(bid, d) => apply((c) => moveBlock(c, bid, d))} onToggle={(bid) => apply((c) => toggleVisible(c, bid))} onAdd={() => setAdding(true)} />
  );
  const panelEdit = block ? (
    <BlockInspector block={block} lang={lang} defaultLang={defaultLang} dispatch={dispatch} onDuplicate={duplicate} onDelete={remove} />
  ) : (
    <div className="inspector"><p className="field-note">Tap a block in the preview, or choose one from the list, to edit it.</p></div>
  );
  const panelDesign = <DesignPanel content={content} dispatch={dispatch} />;
  const panelSettings = (
    <SettingsPanel content={content} dispatch={dispatch}
      onDeletePage={() => { if (confirm("Delete this page for good?")) { deletePage(page.id); go("/me"); } }} />
  );

  const preview = (
    <div className="stage-col">
      <div className="stage-bar">
        <Segmented value={device} onChange={setDevice} label="Device"
          options={[{ value: "phone", label: "Phone", icon: "phone" }, { value: "tablet", label: "Tablet", icon: "desktop" }]} />
        {langs.length > 1 && (
          <Segmented value={lang} onChange={setLang} label="Language" options={langs.map((l) => ({ value: l, label: l === "hi" ? "हिन्दी" : l.toUpperCase() }))} />
        )}
        <Button variant="ghost" size="sm" icon="play" onClick={() => setReplay((n) => n + 1)}>Replay</Button>
        <Button variant="secondary" size="sm" icon="eye" onClick={() => setFull(true)}>Preview as visitor</Button>
      </div>
      <PhonePreview ref={scroller} content={content} lang={lang} device={device} skipOpening replayKey={replay}
        selectedId={selected} onSelectBlock={(bid) => select(bid)} />
    </div>
  );

  const tabs: { key: Tab; label: string; icon: "layers" | "pencil" | "palette" | "sliders" }[] = [
    { key: "blocks", label: "Blocks", icon: "layers" },
    { key: "edit", label: "Edit", icon: "pencil" },
    { key: "design", label: "Design", icon: "palette" },
    { key: "settings", label: "Settings", icon: "sliders" },
  ];

  return (
    <div className="editor">
      <header className="ed-top">
        <a className="guided-brand" href="#/me" aria-label="Back to my pages"><Mark size={24} /></a>
        <input className="ed-title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} maxLength={60} aria-label="Page name" />
        <span className={`saved ${saving || sync === "error" ? "saving" : ""}`}>
          {saving ? "Saving…" : sync === "error" ? "Saved here, not synced yet" : <><Icon name="check" size={14} />{sync === "ok" ? "Saved and synced" : "Saved"}</>}
        </span>
        <span className="grow" />
        <Button variant="ghost" size="sm" icon="undo" aria-label="Undo" disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })} />
        <Button variant="ghost" size="sm" icon="redo" aria-label="Redo" disabled={!state.future.length} onClick={() => dispatch({ type: "redo" })} />
        <Button size="sm" iconRight="right" href={`#/publish/${page.id}`} onClick={saveTitle}>Publish</Button>
      </header>

      {mobile ? (
        <div className="ed-body ed-mobile">
          <div className="ed-stage">{preview}</div>
          <section className="dock" aria-label="Editor panels">
            <nav className="dock-tabs" role="tablist">
              {tabs.map((t) => (
                <button key={t.key} role="tab" type="button" aria-selected={tab === t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>
                  <Icon name={t.icon} size={18} /><span>{t.label}</span>
                </button>
              ))}
            </nav>
            <div className="dock-body">
              {tab === "blocks" && panelBlocks}
              {tab === "edit" && panelEdit}
              {tab === "design" && panelDesign}
              {tab === "settings" && panelSettings}
            </div>
          </section>
        </div>
      ) : (
        <div className="ed-body ed-desktop">
          <aside className="ed-left"><h2 className="panel-h">Blocks</h2>{panelBlocks}</aside>
          <div className="ed-stage">{preview}</div>
          <aside className="ed-right">
            <nav className="panel-tabs" role="tablist">
              {tabs.filter((t) => t.key !== "blocks").map((t) => (
                <button key={t.key} role="tab" type="button" aria-selected={tab === t.key || (tab === "blocks" && t.key === "edit")} className={tab === t.key || (tab === "blocks" && t.key === "edit") ? "on" : ""} onClick={() => setTab(t.key)}>
                  <Icon name={t.icon} size={16} />{t.label}
                </button>
              ))}
            </nav>
            <div className="panel-body">
              {(tab === "edit" || tab === "blocks") && panelEdit}
              {tab === "design" && panelDesign}
              {tab === "settings" && panelSettings}
            </div>
          </aside>
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a block" wide>
        <div className="addgrid">
          {Object.values(registry).map((d) => (
            <button key={d.type} type="button" className="addcard" onClick={() => insert(d.type)}>
              <span className="bl-icon"><Icon name={BLOCK_INFO[d.type]?.icon ?? "layers"} size={20} /></span>
              <strong>{d.label}</strong>
              <small>{BLOCK_INFO[d.type]?.desc}</small>
            </button>
          ))}
        </div>
        <p className="muted add-more">More blocks (quiz, timeline, voice note, RSVP and others) are on the way.</p>
      </Sheet>

      {full && <Fullscreen content={content} lang={lang} onClose={() => setFull(false)} />}
    </div>
  );
}
