"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCompletion } from "@ai-sdk/react";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ArrowLeft, CheckCircle2, FileEdit, Minimize2, Save, Sparkles, Database, Sun, RotateCcw, X, Plus, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CyberButton } from "@/src/components/ui/CyberButton";
import { GlassPanel } from "@/src/components/ui/GlassPanel";
import { createClient } from "@/src/lib/supabase/client";

type RefineryPhase = "A" | "B" | "C" | "D";
type WorkbenchView = "cards" | "tags" | "editor";

type PhaseSelections = Record<RefineryPhase, string[]>;

/** Full [选项开始]…[选项结束] inner text per option key, e.g. "A:0" -> "标题：…\n…" */
type SelectedItemsByPhase = Record<"A" | "B" | "C", Record<string, string>>;

interface Topic {
  id: string;
  title: string;
  description: string | null;
}

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
  "输入一个公共事件、政策争议、市场现象或社会议题，启动推演。";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (!isRecord(value)) {
    return "";
  }

  const title = typeof value.title === "string" ? value.title.trim() : "";
  const summary = typeof value.summary === "string" ? value.summary.trim() : "";

  return [
    title ? `标题：${title}` : "",
    summary ? `摘要：${summary}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Join stored option bodies in stable key order (A:0, A:1, …). */
function joinSelectedItems(items: Record<string, unknown>): string {
  return Object.entries(items)
    .sort(([ka], [kb]) => {
      const ia = Number.parseInt(ka.split(":")[1] ?? "0", 10);
      const ib = Number.parseInt(kb.split(":")[1] ?? "0", 10);
      return ia - ib;
    })
    .map(([, text]) => normalizeOptionText(text))
    .filter(Boolean)
    .join("\n\n---\n\n");
}

function buildPhasePrompt({
  phase,
  sourceText,
  archives,
  selectedItems,
  customTags,
}: {
  phase: RefineryPhase;
  sourceText: string;
  archives: Record<"A" | "B" | "C", string>;
  selectedItems: SelectedItemsByPhase;
  customTags: string[];
}) {
  const selectedBriefings = joinSelectedItems(selectedItems.A);
  const selectedEvents = joinSelectedItems(selectedItems.B);
  const selectedKeywords = joinSelectedItems(selectedItems.C);
  const allKeywords = [selectedKeywords, ...customTags].filter(Boolean).join("\n");

  if (phase === "A") {
    return `原始议题：\n${sourceText}`;
  }

  if (phase === "B") {
    return `原始议题：\n${sourceText}\n\nPhase A 完整输出：\n${archives.A}\n\n用户选中的 Briefing（选项原文）：\n${selectedBriefings}`;
  }

  if (phase === "C") {
    return `原始议题：\n${sourceText}\n\n用户选中的 Briefing（选项原文）：\n${selectedBriefings}\n\nPhase B 完整输出：\n${archives.B}\n\n用户选中的原子事件（选项原文）：\n${selectedEvents}`;
  }

  return `原始议题：\n${sourceText}\n\n用户选中的 Briefing（选项原文）：\n${selectedBriefings}\n\n用户选中的原子事件（选项原文）：\n${selectedEvents}\n\nPhase C 完整输出：\n${archives.C}\n\n用户选中的关键词（选项原文）：\n${allKeywords}`;
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
  const {
    complete,
    completion,
    isLoading,
    error: completionError,
    setCompletion,
  } = useCompletion({
    api: "/api/analytical-pipeline",
    streamProtocol: "text",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editInitialContent, setEditInitialContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [topicsLoading, setTopicsLoading] = useState(true);

  const handleEnterEdit = useCallback(() => {
    setEditInitialContent(draftD || completion);
    setIsEditing(true);
  }, [draftD, completion]);

  useEffect(() => {
    async function fetchTopics() {
      console.log("[Topics] Starting to load topics...");
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("topics")
          .select("id, title, description")
          .order("updated_at", { ascending: false });

        if (error) {
          console.error("[Topics] Failed to load topics:", error);
          console.error("[Topics] 加载议题失败详情:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });
          return;
        }

        if (data) {
          console.log("[Topics] Successfully loaded topics:", data.length, data);
          setTopics(data);
        } else {
          console.warn("[Topics] No data returned from topics query");
          setTopics([]);
        }
      } catch (error) {
        console.error("[Topics] Unexpected error while loading topics:", error);
      } finally {
        setTopicsLoading(false);
      }
    }

    fetchTopics();
  }, []);

  const phaseHasVisibleWorkbenchOutput =
    phase !== "D" &&
    ((pendingPhase === phase && isLoading) || archives[phase].length > 0);

  const isWorkbenchOpen = phase !== "A" || phaseHasVisibleWorkbenchOutput;
  const workbenchView: WorkbenchView =
    phase === "D" ? "editor" : phase === "C" ? "tags" : "cards";

  const handleSaveDraft = useCallback((html: string) => {
    setDraftD(html);
    setIsEditing(false);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const [, setSaveError] = useState<string | null>(null);

  const handlePersistToDatabase = useCallback(async () => {
    const content = (draftD || completion).trim();
    if (!content) {
      console.warn("[Persist] Content is empty, aborting save.");
      return;
    }

    console.log("[Persist] Starting save. selectedTopicId:", selectedTopicId);
    setSaveStatus("saving");
    setSaveError(null);

    const supabase = createClient();
    const failPersist = (message: string, error?: { message?: string; code?: string; details?: string; hint?: string }) => {
      if (error) {
        console.error("写入失败详情:", error);
        console.error("[Persist] Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
      } else {
        console.error("[Persist]", message);
      }

      setSaveStatus("error");
      setSaveError(error?.message ? `${message}: ${error.message}` : message);
    };

    try {
      if (selectedTopicId) {
        console.log("[Persist] APPEND MODE — selectedTopicId:", selectedTopicId);
        const { data: existingDoc, error: fetchError } = await supabase
          .from("documents")
          .select("id, content_markdown")
          .eq("topic_id", selectedTopicId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          failPersist("Fetch document failed", fetchError);
          return;
        }

        if (!existingDoc) {
          failPersist(`No existing document found for topic_id ${selectedTopicId}.`);
          return;
        }

        console.log("[Persist] Existing document found:", existingDoc.id);
        console.log("[Persist] Existing content length:", existingDoc.content_markdown?.length ?? 0);
        console.log("[Persist] New content length:", content.length);

        const updatedContent = `${existingDoc.content_markdown}\n\n---\n\n${content}`;
        console.log("[Persist] Combined content length:", updatedContent.length);

        const { error: updateError } = await supabase
          .from("documents")
          .update({ content_markdown: updatedContent })
          .eq("id", existingDoc.id)
          .eq("topic_id", selectedTopicId)
          .select("id")
          .single();

        if (updateError) {
          failPersist("Update document failed", updateError);
          return;
        }

        console.log("[Persist] Document updated successfully. Inserting analytical_session...");

        const { error: sessionError } = await supabase
          .from("analytical_sessions")
          .insert({
            document_id: existingDoc.id,
            source_issue: sourceText,
            phases: {
              a: { archive: archives.A, selected_items: selectedItems.A },
              b: { archive: archives.B, selected_items: selectedItems.B },
              c: { archive: archives.C, selected_items: selectedItems.C, custom_tags: customTags },
            },
          });

        if (sessionError) {
          failPersist("Insert session failed", sessionError);
          return;
        }

        console.log("[Persist] APPEND MODE complete.");
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 3000);
        return;
      }

      console.log("[Persist] NEW TOPIC MODE");
      let topicId: string | null = selectedTopicId;

      if (!topicId) {
        const topicTitle = sourceText.trim().slice(0, 100) || "Untitled Topic";
        console.log("[Persist] Inserting new topic...");
        const { data: newTopic, error: topicError } = await supabase
          .from("topics")
          .insert({
            title: topicTitle,
            description: null,
          })
          .select()
          .single();

        if (topicError) {
          failPersist("Insert topic failed", topicError);
          return;
        }

        if (!newTopic) {
          failPersist("No topic returned after insert.");
          return;
        }

        console.log("[Persist] New topic created:", newTopic.id);
        topicId = newTopic.id;
        setTopics((prev) => [newTopic, ...prev]);
      }

      console.log("[Persist] Inserting new document with topic_id:", topicId);
      const { data: document, error: docError } = await supabase
        .from("documents")
        .insert({
          title: sourceText.slice(0, 50) || "Untitled Analysis",
          content_markdown: content,
          source_module: "analytical-pipeline",
          topic_id: topicId,
        })
        .select()
        .single();

      if (docError) {
        failPersist("Insert document failed", docError);
        return;
      }

      if (!document) {
        failPersist("No document returned after insert.");
        return;
      }

      console.log("[Persist] New document created:", document.id);
      console.log("[Persist] Inserting analytical_session...");

      const { error: sessionError } = await supabase
        .from("analytical_sessions")
        .insert({
          document_id: document.id,
          source_issue: sourceText,
          phases: {
            a: { archive: archives.A, selected_items: selectedItems.A },
            b: { archive: archives.B, selected_items: selectedItems.B },
            c: { archive: archives.C, selected_items: selectedItems.C, custom_tags: customTags },
          },
        });

      if (sessionError) {
        failPersist("Insert session failed", sessionError);
        return;
      }

      console.log("[Persist] NEW TOPIC MODE complete.");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      console.error("[Persist] Unexpected error:", err);
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : "Unknown error occurred");
    }
  }, [draftD, completion, sourceText, archives, selectedItems, customTags, selectedTopicId]);

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
        ? (priorSelectedKeysForRun.length > 0 || customTags.length > 0) && archives.C.length > 0
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
      customTags,
    });

    setPendingPhase(targetPhase);
    setCompletion("");

    const requestBody: Record<string, unknown> = {
      phase: targetPhase,
    };

    if (targetPhase === "D" && selectedTopicId) {
      const existingTopic = topics.find((t) => t.id === selectedTopicId);
      if (existingTopic) {
        requestBody.selectedTopicId = selectedTopicId;
        requestBody.topicTitle = existingTopic.title;
      }
    }

    const result = await complete(prompt, {
      body: requestBody,
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
    setIsEditing(false);
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
    setIsEditing(false);
    setCustomTags([]);
    setTagInput("");
    setSelectedTopicId(null);
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
              EXOCORTEX CRUCIBLE
            </p>
            <h1 className="mt-2 font-serif text-3xl tracking-widest text-white sm:text-4xl">
              The Crucible
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
              BACK TO MARS
            </CyberButton>
          </div>
        </header>

        <section className="relative flex flex-1 items-start gap-5 overflow-x-hidden">
          <div
            className={`sticky top-5 flex flex-col gap-5 self-start transition-all duration-500 ease-in-out ${
              isWorkbenchOpen
                ? "w-full lg:w-[38%]"
                : "w-full max-w-3xl mx-auto"
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
                      setIsEditing(false);
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
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-3 py-2">
                      <BookOpen size={14} className="text-[#deff9a]/70" />
                      <select
                        value={selectedTopicId ?? "CREATE_NEW_TOPIC"}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedTopicId(value === "CREATE_NEW_TOPIC" ? null : value);
                        }}
                        disabled={topicsLoading}
                        className="flex-1 bg-transparent text-sm text-white outline-none"
                      >
                        <option value="CREATE_NEW_TOPIC" className="bg-zinc-900 text-white">
                          + Create New Topic
                        </option>
                        {topics.map((topic) => (
                          <option key={topic.id} value={topic.id} className="bg-zinc-900 text-white">
                            {topic.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={sourceText}
                      onChange={(event) => setSourceText(event.target.value)}
                      placeholder={initialPrompt}
                      className="min-h-32 w-full resize-none rounded border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/30 focus:border-[#deff9a]/50 focus:bg-white/[0.06]"
                    />
                  </div>
                )}

                {phase !== "A" && (
                  <div className="mt-3 space-y-2">
                    {selectedKeys.length > 0 ? (
                      <p className="rounded border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white/60">
                        已选择 {selectedKeys.length} 项，继续推演下一阶段。
                      </p>
                    ) : (
                      <div className="rounded border border-white/10 bg-white/[0.03] px-4 py-3">
                        <p className="mb-2 text-xs font-semibold tracking-wide text-[#deff9a]/70">
                          上一步选中的内容
                        </p>
                        <div className="space-y-2">
                          {priorSelectedKeysForRun.map((key) => {
                            const priorPhase = phase === "B" ? "A" : phase === "C" ? "B" : phase === "D" ? "C" : null;
                            const itemText = priorPhase
                              ? normalizeOptionText(selectedItems[priorPhase][key])
                              : "";
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
                    disabled={
                      (phase === "C" ? selections.C.length === 0 && customTags.length === 0 : selectedKeys.length === 0) || isLoading
                    }
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

            {phase !== "A" && (
              <GlassPanel className="rounded p-4 sm:p-5">
                <p className="text-xs font-bold tracking-[0.3em] text-white/35">
                  SELECTION SUMMARY
                </p>
                <div className="mt-3 space-y-2">
                  {selectedKeys.length > 0 ? (
                    <p className="text-sm text-white/60">
                      已选择 {selectedKeys.length} 项，继续推演下一阶段。
                    </p>
                  ) : (
                    <p className="text-sm text-white/40">暂无选中内容</p>
                  )}
                </div>
              </GlassPanel>
            )}
          </div>

          <div
            className={`flex flex-col gap-5 transition-all duration-500 ease-in-out overflow-hidden ${
              isWorkbenchOpen
                ? "w-full lg:w-[62%] opacity-100"
                : "w-0 opacity-0"
            }`}
          >
            {isWorkbenchOpen && (
              <GlassPanel className="relative flex flex-1 flex-col rounded p-4 sm:p-5 h-auto">
                <header className="absolute left-0 right-0 top-0 z-10 border-b border-white/10 bg-zinc-950/90 px-4 pb-4 pt-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold tracking-[0.3em] text-white/35">
                        {phase === "A" && "BRIEFING CANDIDATES"}
                        {phase === "B" && "DIMENSIONAL ANALYSIS"}
                        {phase === "C" && "CONCEPT REFINERY"}
                        {phase === "D" && "DEEP SPACE DRAFT"}
                      </p>
                      <p className="mt-1 text-sm text-white/45">
                        {phase === "A" && "Select briefings to continue"}
                        {phase === "B" && "Select atomic events to build your chain"}
                        {phase === "C" && "Curate and refine core concepts"}
                        {phase === "D" && (isEditing ? "沉浸式编辑模式" : "Markdown 阅读视图")}
                      </p>
                    </div>
                    {phase === "D" && !isEditing && !streamingD && (
                      <div className="flex items-center gap-2">
                        {saveStatus === "saved" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => router.push("/")}
                              className="flex items-center gap-2 rounded border border-[#deff9a]/30 bg-[#deff9a]/10 px-3 py-2 text-xs text-[#deff9a] transition hover:border-[#deff9a]/50 hover:bg-[#deff9a]/20"
                              title="返回太阳主控台"
                            >
                              <Sun size={14} aria-hidden="true" />
                              <span className="hidden sm:inline">Back to Sun</span>
                            </button>
                            <button
                              type="button"
                              onClick={resetFlow}
                              className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60 transition hover:border-[#deff9a]/40 hover:text-[#deff9a]"
                              title="开启新分析"
                            >
                              <RotateCcw size={14} aria-hidden="true" />
                              <span className="hidden sm:inline">New Session</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={handlePersistToDatabase}
                              disabled={saveStatus === "saving"}
                              className={`flex items-center gap-2 rounded border px-3 py-2 text-xs transition ${
                                saveStatus === "error"
                                  ? "border-red-500/30 bg-red-500/10 text-red-400"
                                  : "border-white/10 bg-white/[0.04] text-white/60 hover:border-[#deff9a]/40 hover:text-[#deff9a]"
                              }`}
                              title="保存到数据库"
                            >
                              <Database size={14} aria-hidden="true" />
                              <span className="hidden sm:inline">
                                {saveStatus === "saving" ? "Saving..." : saveStatus === "error" ? "Retry" : "Save to Archive"}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={handleEnterEdit}
                              className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60 transition hover:border-[#deff9a]/40 hover:text-[#deff9a]"
                              title="进入编辑模式"
                            >
                              <FileEdit size={14} aria-hidden="true" />
                              <span className="hidden sm:inline">Edit Document</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </header>

                <div className="mt-[4.5rem] rounded-lg border border-white/5 bg-zinc-900/50">
                  {(phase === "A" || phase === "B") && workbenchView === "cards" && (
                    <div className="flex flex-col gap-3 p-4">
                      {optionBlocks.map((block, index) => {
                        const key = optionKey(phase, index);
                        const checked = selectedKeys.includes(key);
                        const optionText = normalizeOptionText(block);
                        const rows = parseLabeledLines(optionText);

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
                              onChange={() => toggleSelection(key, optionText)}
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
                  )}

                  {phase === "C" && workbenchView === "tags" && (
                    <div className="flex flex-col gap-6 p-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {optionBlocks.map((block, index) => {
                          const key = optionKey(phase, index);
                          const checked = selectedKeys.includes(key);
                          const optionText = normalizeOptionText(block);
                          const rows = parseLabeledLines(optionText);

                          return (
                            <label
                              key={key}
                              className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-4 text-left transition ${
                                checked
                                  ? "border-[#deff9a]/55 bg-[#deff9a]/10 shadow-[0_0_0_1px_rgba(222,255,154,0.12)]"
                                  : "border-white/10 bg-zinc-950/50 hover:border-white/25"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelection(key, optionText)}
                                className="hidden"
                              />
                              <div className="space-y-1">
                                {rows.map((row, rowIndex) => (
                                  <div key={rowIndex}>
                                    {row.label && (
                                      <span className="mr-2 text-xs font-semibold text-[#deff9a]/80">
                                        {row.label}:
                                      </span>
                                    )}
                                    <span className="text-sm text-white/80">{row.value}</span>
                                  </div>
                                ))}
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      <div className="border-t border-white/10 pt-4">
                        <div className="mb-3 flex flex-wrap gap-2">
                          {customTags.map((tag) => (
                            <span
                              key={`custom-${tag}`}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#deff9a]/30 bg-[#deff9a]/5 px-3 py-1.5 text-sm text-[#deff9a]/90"
                            >
                              {tag}
                              <button
                                type="button"
                                onClick={() => setCustomTags((prev) => prev.filter((t) => t !== tag))}
                                className="ml-0.5 rounded-full p-0.5 text-[#deff9a]/60 transition hover:bg-[#deff9a]/15 hover:text-[#deff9a]"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && tagInput.trim()) {
                                e.preventDefault();
                                const newTag = tagInput.trim();
                                if (!customTags.includes(newTag) && !Object.values(selectedItems.C).includes(newTag)) {
                                  setCustomTags((prev) => [...prev, newTag]);
                                }
                                setTagInput("");
                              }
                            }}
                            placeholder="添加 AI 遗漏的核心概念..."
                            className="flex-1 rounded border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#deff9a]/50 focus:bg-white/[0.06]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (tagInput.trim()) {
                                const newTag = tagInput.trim();
                                if (!customTags.includes(newTag) && !Object.values(selectedItems.C).includes(newTag)) {
                                  setCustomTags((prev) => [...prev, newTag]);
                                }
                                setTagInput("");
                              }
                            }}
                            disabled={!tagInput.trim()}
                            className="inline-flex items-center gap-1.5 rounded border border-[#deff9a]/30 bg-[#deff9a]/10 px-3 py-2 text-sm text-[#deff9a] transition hover:border-[#deff9a]/50 hover:bg-[#deff9a]/20 disabled:opacity-40"
                          >
                            <Plus size={14} />
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {workbenchView === "editor" && (
                    isEditing ? (
                      <RefineryTipTapDraft
                        initialContent={editInitialContent}
                        onSave={handleSaveDraft}
                        onCancel={handleCancelEdit}
                      />
                    ) : (
                      <RefineryMarkdownPreview text={streamingD ? completion : draftD} />
                    )
                  )}
                </div>
              </GlassPanel>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
