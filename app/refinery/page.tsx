"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCompletion } from "@ai-sdk/react";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ArrowLeft, CheckCircle2, FileEdit, Minimize2, Save, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CyberButton } from "@/src/components/ui/CyberButton";
import { GlassPanel } from "@/src/components/ui/GlassPanel";

type RefineryPhase = "A" | "B" | "C" | "D";

type PhaseSelections = Record<RefineryPhase, string[]>;

/** Full [选项开始]…[选项结束] inner text per option key, e.g. "A:0" -> "标题：…\n…" */
type SelectedItemsByPhase = Record<"A" | "B" | "C", Record<string, string>>;

const phaseOrder: RefineryPhase[] = ["A", "B", "C", "D"];

const phaseMeta: Record<
  RefineryPhase,
  { title: string; kicker: string; action: string }
> = {
  A: {
    title: "Briefing List",
    kicker: "查 Briefing",
    action: "GENERATE BRIEFING",
  },
  B: {
    title: "Atomic Events",
    kicker: "选原子事件",
    action: "BUILD EVENT CHAIN",
  },
  C: {
    title: "Keywords",
    kicker: "选关键词",
    action: "DISTILL KEYWORDS",
  },
  D: {
    title: "Final Draft",
    kicker: "生成正文",
    action: "WRITE DRAFT",
  },
};

const emptySelections: PhaseSelections = {
  A: [],
  B: [],
  C: [],
  D: [],
};

const emptyArchives: Record<"A" | "B" | "C", string> = {
  A: "",
  B: "",
  C: "",
};

const emptySelectedItems: SelectedItemsByPhase = {
  A: {},
  B: {},
  C: {},
};

const initialPrompt =
  "输入一个公共事件、政策争议、市场现象或社会议题，启动认知炼油。";

function getNextPhase(phase: RefineryPhase): RefineryPhase | null {
  const currentIndex = phaseOrder.indexOf(phase);
  return phaseOrder[currentIndex + 1] ?? null;
}

function optionKey(phase: Exclude<RefineryPhase, "D">, index: number): string {
  return `${phase}:${index}`;
}

function extractOptionBlocks(text: string): string[] {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let currentBlockLines: string[] = [];
  const listItemRegex = /^(\s*)([-*]|\d+\.)\s+/;

  for (const line of lines) {
    const isListItem = listItemRegex.test(line);

    if (isListItem) {
      if (currentBlockLines.length > 0) {
        const blockContent = currentBlockLines.join("\n").trim();
        if (blockContent.length > 0) {
          blocks.push(blockContent);
        }
      }
      const match = line.match(listItemRegex);
      if (match) {
        const prefixLength = match[0].length;
        currentBlockLines = [line.slice(prefixLength)];
      } else {
        currentBlockLines = [line];
      }
    } else if (currentBlockLines.length > 0) {
      currentBlockLines.push(line);
    }
  }

  if (currentBlockLines.length > 0) {
    const blockContent = currentBlockLines.join("\n").trim();
    if (blockContent.length > 0) {
      blocks.push(blockContent);
    }
  }

  return blocks;
}

function parseLabeledLines(block: string): { label: string; value: string }[] {
  return block.split(/\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return [];
    }
    const sep = "：";
    const idx = trimmed.indexOf(sep);
    if (idx === -1) {
      return [{ label: "", value: trimmed }];
    }
    return [
      {
        label: trimmed.slice(0, idx).trim(),
        value: trimmed.slice(idx + sep.length).trim(),
      },
    ];
  });
}

/** Join stored option bodies in stable key order (A:0, A:1, …). */
function joinSelectedItems(items: Record<string, string>): string {
  return Object.entries(items)
    .sort(([ka], [kb]) => {
      const ia = Number.parseInt(ka.split(":")[1] ?? "0", 10);
      const ib = Number.parseInt(kb.split(":")[1] ?? "0", 10);
      return ia - ib;
    })
    .map(([, text]) => text)
    .filter(Boolean)
    .join("\n\n---\n\n");
}

function buildPhasePrompt({
  phase,
  sourceText,
  archives,
  selectedItems,
}: {
  phase: RefineryPhase;
  sourceText: string;
  archives: Record<"A" | "B" | "C", string>;
  selectedItems: SelectedItemsByPhase;
}) {
  const selectedBriefings = joinSelectedItems(selectedItems.A);
  const selectedEvents = joinSelectedItems(selectedItems.B);
  const selectedKeywords = joinSelectedItems(selectedItems.C);

  if (phase === "A") {
    return `原始议题：\n${sourceText}`;
  }

  if (phase === "B") {
    return `原始议题：\n${sourceText}\n\nPhase A 完整输出：\n${archives.A}\n\n用户选中的 Briefing（选项原文）：\n${selectedBriefings}`;
  }

  if (phase === "C") {
    return `原始议题：\n${sourceText}\n\n用户选中的 Briefing（选项原文）：\n${selectedBriefings}\n\nPhase B 完整输出：\n${archives.B}\n\n用户选中的原子事件（选项原文）：\n${selectedEvents}`;
  }

  return `原始议题：\n${sourceText}\n\n用户选中的 Briefing（选项原文）：\n${selectedBriefings}\n\n用户选中的原子事件（选项原文）：\n${selectedEvents}\n\nPhase C 完整输出：\n${archives.C}\n\n用户选中的关键词（选项原文）：\n${selectedKeywords}`;
}

interface RefineryTipTapDraftProps {
  initialContent: string;
  onSave: (html: string) => void;
  onCancel: () => void;
}

function RefineryTipTapDraft({ initialContent, onSave, onCancel }: RefineryTipTapDraftProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start editing your draft...",
      }),
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "focus:outline-none",
      },
    },
  });

  const handleSave = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    onSave(html);
  }, [editor, onSave]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end gap-2 border-b border-white/10 bg-zinc-950/90 px-4 py-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60 transition hover:border-white/25 hover:text-white/80"
        >
          <Minimize2 size={14} aria-hidden="true" />
          <span>Cancel</span>
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-2 rounded border border-[#deff9a]/30 bg-[#deff9a]/10 px-3 py-2 text-xs text-[#deff9a] transition hover:border-[#deff9a]/50 hover:bg-[#deff9a]/20"
        >
          <Save size={14} aria-hidden="true" />
          <span>Save & Exit</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <EditorContent
          editor={editor}
          className="refinery-editor prose prose-invert prose-zinc min-h-full max-w-none p-6 focus:outline-none prose-headings:text-[#deff9a] prose-a:text-[#deff9a]"
        />
      </div>
    </div>
  );
}

interface RefineryMarkdownPreviewProps {
  text: string;
}

function RefineryMarkdownPreview({ text }: RefineryMarkdownPreviewProps) {
  return (
    <div className="prose prose-invert prose-zinc min-h-full max-w-none p-6 prose-headings:text-[#deff9a] prose-a:text-[#deff9a]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text || ""}</ReactMarkdown>
    </div>
  );
}

export default function RefineryPage() {
  const router = useRouter();
  const [sourceText, setSourceText] = useState("");
  const [phase, setPhase] = useState<RefineryPhase>("A");
  const [archives, setArchives] = useState(emptyArchives);
  const [draftD, setDraftD] = useState("");
  const [selections, setSelections] = useState<PhaseSelections>(emptySelections);
  const [selectedItems, setSelectedItems] =
    useState<SelectedItemsByPhase>(emptySelectedItems);
  const [pendingPhase, setPendingPhase] = useState<RefineryPhase | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleEnterEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleSaveDraft = useCallback((html: string) => {
    setDraftD(html);
    setIsEditing(false);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const {
    complete,
    completion,
    isLoading,
    error: completionError,
    setCompletion,
  } = useCompletion({
    api: "/api/refinery",
    streamProtocol: "text",
  });

  const leftArchiveText =
    phase === "D"
      ? ""
      : pendingPhase === phase && isLoading
        ? completion
        : archives[phase];

  const optionBlocks = useMemo(
    () => (phase === "D" ? [] : extractOptionBlocks(leftArchiveText)),
    [phase, leftArchiveText],
  );

  const selectedKeys = selections[phase];

  /** Keys + full block text for the phase we are about to *run* (prior phase picks). */
  const priorSelectedKeysForRun =
    phase === "B"
      ? selections.A
      : phase === "C"
        ? selections.B
        : phase === "D"
          ? selections.C
          : [];

  const nextPhase = getNextPhase(phase);
  const canRequest =
    phase === "A"
      ? sourceText.trim().length > 0
      : phase === "D"
        ? priorSelectedKeysForRun.length > 0 && archives.C.length > 0
        : priorSelectedKeysForRun.length > 0 &&
          (phase === "B"
            ? archives.A.length > 0
            : phase === "C"
              ? archives.B.length > 0
              : false);

  const toggleSelection = useCallback(
    (key: string, blockFullText: string) => {
      if (phase === "D") {
        return;
      }
      const p = phase;
      setSelections((currentSelections) => {
        const phaseSelections = currentSelections[p];
        const adding = !phaseSelections.includes(key);
        const nextSelections = adding
          ? [...phaseSelections, key]
          : phaseSelections.filter((item) => item !== key);

        setSelectedItems((currentItems) => {
          const nextMap = { ...currentItems[p] };
          if (adding) {
            nextMap[key] = blockFullText;
          } else {
            delete nextMap[key];
          }
          return { ...currentItems, [p]: nextMap };
        });

        return {
          ...currentSelections,
          [p]: nextSelections,
        };
      });
    },
    [phase],
  );

  const runPhase = async (targetPhase: RefineryPhase) => {
    if (isLoading || !canRequest) {
      return;
    }

    const prompt = buildPhasePrompt({
      phase: targetPhase,
      sourceText: sourceText.trim(),
      archives,
      selectedItems,
    });

    setPendingPhase(targetPhase);
    setCompletion("");

    const result = await complete(prompt, {
      body: {
        phase: targetPhase,
      },
    });

    const finalText = result ?? "";

    if (targetPhase === "D") {
      setDraftD(finalText);
    } else {
      setArchives((current) => ({
        ...current,
        [targetPhase]: finalText,
      }));
    }

    setPendingPhase(null);
  };

  const advancePhase = () => {
    if (!nextPhase) {
      return;
    }
    setPhase(nextPhase);
    setCompletion("");
  };

  const resetFlow = () => {
    setPhase("A");
    setArchives(emptyArchives);
    setDraftD("");
    setSelections(emptySelections);
    setSelectedItems(emptySelectedItems);
    setPendingPhase(null);
    setCompletion("");
  };

  const showAdvance =
    nextPhase !== null &&
    phase !== "D" &&
    !isLoading &&
    optionBlocks.length > 0;

  const streamingD = phase === "D" && pendingPhase === "D" && isLoading;

  return (
    <main className="min-h-screen overflow-y-auto bg-zinc-950 text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(222,255,154,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_28%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-5 py-5 sm:px-8 sm:py-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.35em] text-[#deff9a]/70">
              EXOCORTEX REFINERY
            </p>
            <h1 className="mt-2 font-serif text-3xl tracking-widest text-white sm:text-4xl">
              Cognitive Refinery
            </h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <CyberButton
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={resetFlow}
            >
              RESET FLOW
            </CyberButton>
            <CyberButton
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => router.push("/")}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              BACK TO GALAXY
            </CyberButton>
          </div>
        </header>

        <section className="relative flex flex-1 gap-5 transition-all duration-300 ease-in-out">
          <div
            className={`flex flex-col gap-5 transition-all duration-300 ease-in-out ${
              isEditing
                ? "pointer-events-none absolute -translate-x-full opacity-0"
                : "relative w-full lg:w-[45%]"
            }`}
          >
            <GlassPanel className="rounded p-4 sm:p-5">
              <div className="mb-5 grid grid-cols-4 gap-2">
                {phaseOrder.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPhase(p);
                      if (p !== "D") {
                        setCompletion("");
                      }
                    }}
                    className={`rounded border px-3 py-2 text-left transition ${
                      phase === p
                        ? "border-[#deff9a]/60 bg-[#deff9a]/10 text-[#deff9a]"
                        : "border-white/10 bg-white/[0.03] text-white/45 hover:border-white/25 hover:text-white/80"
                    }`}
                  >
                    <span className="block text-xs font-bold">Phase {p}</span>
                    <span className="mt-1 block text-[11px]">
                      {phaseMeta[p].kicker}
                    </span>
                  </button>
                ))}
              </div>

              <div>
                <p className="text-xs font-bold tracking-[0.3em] text-white/35">
                  {phaseMeta[phase].title}
                </p>
                {phase === "A" && (
                  <textarea
                    value={sourceText}
                    onChange={(event) => setSourceText(event.target.value)}
                    placeholder={initialPrompt}
                    className="mt-3 min-h-32 w-full resize-none rounded border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/30 focus:border-[#deff9a]/50 focus:bg-white/[0.06]"
                  />
                )}

                {phase !== "A" && (
                  <div className="mt-3 space-y-2">
                    {selectedKeys.length > 0 ? (
                      <p className="rounded border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white/60">
                        已选择 {selectedKeys.length} 项，继续炼制下一阶段。
                      </p>
                    ) : (
                      <div className="rounded border border-white/10 bg-white/[0.03] px-4 py-3">
                        <p className="mb-2 text-xs font-semibold tracking-wide text-[#deff9a]/70">
                          上一步选中的内容
                        </p>
                        <div className="space-y-2">
                          {priorSelectedKeysForRun.map((key) => {
                            const priorPhase = phase === "B" ? "A" : phase === "C" ? "B" : phase === "D" ? "C" : null;
                            const itemText = priorPhase ? selectedItems[priorPhase][key] : "";
                            return (
                              <div key={key} className="text-sm leading-relaxed text-white/70">
                                {itemText ? (
                                  <div className="space-y-1">
                                    {itemText.split("\n").map((line, idx) => {
                                      const trimmed = line.trim();
                                      if (!trimmed) return null;
                                      const sep = "：";
                                      const idxSep = trimmed.indexOf(sep);
                                      if (idxSep === -1) {
                                        return <p key={idx} className="text-white/60">{trimmed}</p>;
                                      }
                                      return (
                                        <div key={idx}>
                                          <span className="text-xs font-medium text-[#deff9a]/80">{trimmed.slice(0, idxSep)}</span>
                                          <span className="text-white/70">：{trimmed.slice(idxSep + 1)}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-white/40">{key}</span>
                                )}
                              </div>
                            );
                          })}
                          {priorSelectedKeysForRun.length === 0 && (
                            <p className="text-sm text-white/40">暂无选中内容</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <CyberButton
                  className="min-h-12 flex-1"
                  disabled={!canRequest || isLoading}
                  onClick={() => void runPhase(phase)}
                >
                  <Sparkles size={16} aria-hidden="true" />
                  {isLoading ? "REFINING..." : phaseMeta[phase].action}
                </CyberButton>
                {showAdvance && (
                  <CyberButton
                    variant="secondary"
                    className="min-h-12 flex-1"
                    disabled={selectedKeys.length === 0 || isLoading}
                    onClick={advancePhase}
                  >
                    <CheckCircle2 size={16} aria-hidden="true" />
                    ENTER PHASE {nextPhase}
                  </CyberButton>
                )}
              </div>
              {completionError && (
                <p className="mt-3 text-xs tracking-wide text-red-300">
                  {completionError.message}
                </p>
              )}
            </GlassPanel>

            <GlassPanel className="flex flex-col rounded p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-[0.3em] text-white/35">
                    SELECTABLE OUTPUT
                  </p>
                  <p className="mt-1 text-sm text-white/45">
                    流式解析 Markdown 列表项，勾选带入下一阶段。
                  </p>
                </div>
                <div className="hidden h-2 w-2 rounded-full bg-[#deff9a] shadow-[0_0_18px_rgba(222,255,154,0.75)] sm:block" />
              </div>

              <div className="flex flex-col gap-3">
                {phase === "D" && (
                  <p className="rounded border border-dashed border-white/15 bg-zinc-900/35 px-4 py-6 text-center text-sm text-white/45">
                    本阶段正文仅在右侧编辑器输出；此处不展示选项卡。
                  </p>
                )}

                {phase !== "D" &&
                  optionBlocks.map((block, index) => {
                    const key = optionKey(phase, index);
                    const checked = selectedKeys.includes(key);
                    const rows = parseLabeledLines(block);

                    return (
                      <label
                        key={key}
                        className={`flex cursor-pointer gap-3 rounded-xl border p-4 text-left transition ${
                          checked
                            ? "border-[#deff9a]/55 bg-[#deff9a]/10 shadow-[0_0_0_1px_rgba(222,255,154,0.12)]"
                            : "border-white/10 bg-zinc-950/50 hover:border-white/25"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelection(key, block)}
                          className="mt-1 size-4 shrink-0 rounded border border-white/30 bg-zinc-900 text-[#deff9a] accent-[#deff9a]"
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                          {rows.map((row, rowIndex) =>
                            row.label ? (
                              <div key={`${key}-line-${rowIndex}`}>
                                <p className="text-xs font-semibold tracking-wide text-[#deff9a]/90">
                                  {row.label}
                                </p>
                                <p className="text-sm leading-relaxed text-white/85">
                                  {row.value || "—"}
                                </p>
                              </div>
                            ) : (
                              <p
                                key={`${key}-line-${rowIndex}`}
                                className="text-sm leading-relaxed text-white/75"
                              >
                                {row.value}
                              </p>
                            ),
                          )}
                        </div>
                      </label>
                    );
                  })}
              </div>
            </GlassPanel>
          </div>

          <GlassPanel
            className={`relative min-h-[70vh] overflow-hidden rounded p-4 sm:p-5 transition-all duration-300 ease-in-out ${
              isEditing ? "w-full" : "w-full lg:w-[55%]"
            }`}
          >
            <header className="absolute left-0 right-0 top-0 z-10 border-b border-white/10 bg-zinc-950/90 px-4 pb-4 pt-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-[0.3em] text-white/35">
                    DEEP SPACE DRAFT
                  </p>
                  <p className="mt-1 text-sm text-white/45">
                    {isEditing
                      ? "沉浸式编辑模式"
                      : phase === "D"
                        ? "Markdown 阅读视图"
                        : "TipTap 仅在 Phase D 挂载；A–C 阶段此处休眠。"}
                  </p>
                </div>
                {phase === "D" && !isEditing && !streamingD && (
                  <button
                    type="button"
                    onClick={handleEnterEdit}
                    className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60 transition hover:border-[#deff9a]/40 hover:text-[#deff9a]"
                    title="进入编辑模式"
                  >
                    <FileEdit size={14} aria-hidden="true" />
                    <span className="hidden sm:inline">编辑文档</span>
                  </button>
                )}
              </div>
            </header>

            <div className="absolute inset-x-0 bottom-0 top-[5.75rem] overflow-y-auto rounded-lg border border-white/5 bg-zinc-900/50">
              {phase === "D" ? (
                isEditing ? (
                  <RefineryTipTapDraft
                    initialContent={draftD || completion}
                    onSave={handleSaveDraft}
                    onCancel={handleCancelEdit}
                  />
                ) : (
                  <RefineryMarkdownPreview text={streamingD ? completion : draftD} />
                )
              ) : (
                <div className="flex min-h-[48vh] items-center justify-center p-6 text-center text-sm leading-6 text-white/35">
                  非 Phase D：编辑器未挂载，流式内容只在左侧解析。
                </div>
              )}
            </div>
          </GlassPanel>
        </section>
      </div>
    </main>
  );
}
