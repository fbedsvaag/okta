import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";

/**
 * Én notat-editor overalt (ARBEIDSLISTE 28.4, 29.1): ingen ramme, skriver
 * rett på flaten, lagres som Markdown. TipTap ligger i appen; ingen nettverk.
 *
 * Markdown-snarveier ved mellomrom: `#` overskrift, `##` mindre, `-`/`*`
 * punkt, `1.` nummerert, `[]` sjekkliste. `/` på en tom linje åpner en meny
 * (piltaster + Enter). Enter i et tomt punkt avslutter lista, Backspace
 * først i en overskrift eller et punkt gjør det til tekst. ⌘B / ⌘I.
 */

export const NOTATUTVIDELSER = [
  StarterKit.configure({
    heading: { levels: [1, 2] },
    code: false,
    codeBlock: false,
    blockquote: false,
    horizontalRule: false,
    strike: false,
    link: false,
    underline: false,
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Markdown,
];

type Valg = {
  id: string;
  navn: string;
  hint: string;
  gjor: (e: Editor) => void;
};

const MENY: Valg[] = [
  {
    id: "tekst",
    navn: "Tekst",
    hint: "",
    gjor: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    id: "h1",
    navn: "Overskrift",
    hint: "#",
    gjor: (e) => e.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    navn: "Mindre overskrift",
    hint: "##",
    gjor: (e) => e.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    id: "punkt",
    navn: "Punktliste",
    hint: "-",
    gjor: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: "nr",
    navn: "Nummerert liste",
    hint: "1.",
    gjor: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "sjekk",
    navn: "Sjekkliste",
    hint: "[]",
    gjor: (e) => e.chain().focus().toggleTaskList().run(),
  },
];

/**
 * Editoren. Kontrollert på vei inn: `verdi` leses når den endres utenfra
 * (ikke mens du skriver). `onEndre` får Markdown ved hver endring,
 * `onForlat` når feltet mister fokus.
 */
export function Notat({
  verdi,
  onEndre,
  onForlat,
  plassholder = "Skriv … ( / for meny )",
  autoFocus,
  minHoyde = 72,
  klasse = "",
}: {
  verdi: string;
  onEndre?: (markdown: string) => void;
  onForlat?: (markdown: string) => void;
  plassholder?: string;
  autoFocus?: boolean;
  /** px */
  minHoyde?: number;
  klasse?: string;
}) {
  const sist = useRef(verdi);
  const fersk = useRef({ onEndre, onForlat });
  fersk.current = { onEndre, onForlat };
  const [meny, setMeny] = useState<{ x: number; y: number; i: number } | null>(
    null,
  );
  const menyRef = useRef(meny);
  menyRef.current = meny;

  const editor = useEditor({
    extensions: [
      ...NOTATUTVIDELSER,
      Placeholder.configure({ placeholder: plassholder }),
    ],
    content: verdi,
    contentType: "markdown",
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: { class: "notat-flate outline-none" },
      handleKeyDown: (_v, e) => {
        const m = menyRef.current;
        if (!m || !editor) return false;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          const d = e.key === "ArrowDown" ? 1 : -1;
          setMeny({ ...m, i: (m.i + d + MENY.length) % MENY.length });
          return true;
        }
        if (e.key === "Enter") {
          velg(MENY[m.i]);
          return true;
        }
        if (e.key === "Escape") {
          setMeny(null);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      const md = e.getMarkdown();
      sist.current = md;
      fersk.current.onEndre?.(md);
      // «/» alene på en linje åpner menyen.
      const { $from, empty } = e.state.selection;
      const linje = $from.parent.textContent;
      if (empty && linje === "/" && $from.parent.type.name === "paragraph") {
        const k = e.view.coordsAtPos($from.pos);
        setMeny({ x: k.left, y: k.bottom + 6, i: 0 });
      } else if (menyRef.current) setMeny(null);
    },
    onBlur: ({ editor: e }) => {
      window.setTimeout(() => setMeny(null), 120);
      fersk.current.onForlat?.(e.getMarkdown());
    },
  });

  // Ny verdi utenfra (en annen elev, en angring): skriv den inn.
  useEffect(() => {
    if (!editor || verdi === sist.current) return;
    sist.current = verdi;
    editor.commands.setContent(verdi, {
      contentType: "markdown",
      emitUpdate: false,
    });
  }, [verdi, editor]);

  function velg(v: Valg) {
    if (!editor) return;
    // Ta bort «/» før valget brukes.
    const { $from } = editor.state.selection;
    editor
      .chain()
      .focus()
      .deleteRange({ from: $from.start(), to: $from.end() })
      .run();
    v.gjor(editor);
    setMeny(null);
  }

  return (
    <div className={`notat ${klasse}`} style={{ minHeight: minHoyde }}>
      <EditorContent editor={editor} />
      {meny &&
        createPortal(
          <Menyen
            x={meny.x}
            y={meny.y}
            i={meny.i}
            onVelg={velg}
            onOver={(i) => setMeny({ ...meny, i })}
          />,
          document.body,
        )}
    </div>
  );
}

function Menyen({
  x,
  y,
  i,
  onVelg,
  onOver,
}: {
  x: number;
  y: number;
  i: number;
  onVelg: (v: Valg) => void;
  onOver: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  // Holdes innenfor vinduet.
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({
      x: Math.min(x, window.innerWidth - r.width - 12),
      y: y + r.height > window.innerHeight - 12 ? y - r.height - 30 : y,
    });
  }, [x, y]);
  return (
    <div
      ref={ref}
      role="listbox"
      className="glass-meny fixed z-[80] w-56 rounded-[12px] p-1"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {MENY.map((v, n) => (
        <button
          key={v.id}
          role="option"
          aria-selected={n === i}
          onMouseEnter={() => onOver(n)}
          onClick={() => onVelg(v)}
          className={`flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[13px] ${
            n === i ? "bg-valgt" : ""
          }`}
        >
          {v.navn}
          <span className="ml-auto font-mono text-etikett text-blekk-svak">
            {v.hint}
          </span>
        </button>
      ))}
    </div>
  );
}
