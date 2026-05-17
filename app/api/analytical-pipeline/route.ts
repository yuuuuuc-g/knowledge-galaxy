import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

interface RefineryRequestBody {
  prompt?: unknown;
  phase?: unknown;
}

type RefineryPhase = "A" | "B" | "C" | "D";

const BASE_ROLE_PROMPT = `你是一个政经社领域的硬核学者，兼具政治学、经济学、社会学训练。
你的任务是对用户输入的事件、材料或问题进行“认知炼油”。
必须遵守：
1. 强制区分“实然 (Is)”与“应然 (Ought)”。
2. 语言要冷静、锋利、结构化，避免空泛鸡汤。
3. 严格遵循当前阶段的输出格式要求。`;

const PHASE_PROMPTS: Record<RefineryPhase, string> = {
  A: `${BASE_ROLE_PROMPT}
当前：Phase A / Briefing List。
输出 3-5 条 Briefing 候选。每条必须使用标准 Markdown 列表格式，以 "- " 开头：
- 标题：一句话标题
  问题：回答的核心问题
  链路：核心事件链路
  切口：建议切口`,

  B: `${BASE_ROLE_PROMPT}
当前：Phase B / 原子事件链。
输出具体的原子事件链。每条必须使用标准 Markdown 列表格式，以 "- " 开头：
- 事件：事件名
  类型：事实/推断/应然
  内容：具体内容
  依据：推断链或证据`,

  C: `${BASE_ROLE_PROMPT}
当前：Phase C / 关键词。
输出政经社维度的关键词。每条必须使用标准 Markdown 列表格式，以 "- " 开头：
- 领域：政治学/经济学/社会学
  词汇：关键词
  解释：概念解释
  扣题：与事件的联系`,

  D: `${BASE_ROLE_PROMPT}
当前：Phase D / Final Draft。
综合上下文生成最终可编辑的长文草稿。请直接输出 Markdown 正文。`,
};

function isRefineryPhase(value: unknown): value is RefineryPhase {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

const deepseek = createOpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const kimi = createOpenAI({
  baseURL: 'https://api.moonshot.cn/v1',
  apiKey: process.env.KIMI_API_KEY,
});

export async function POST(request: Request) {
  const body = (await request.json()) as RefineryRequestBody;
  const prompt = body.prompt;
  const phase = isRefineryPhase(body.phase) ? body.phase : "A";
  const model = process.env.REFINERY_MODEL === "kimi"
      ? kimi.chat("moonshot-v1-8k")
      : deepseek.chat("deepseek-v4-pro");

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return Response.json({ error: "A non-empty prompt string is required." }, { status: 400 });
  }

  // ✨ 全部退回使用最稳定的 streamText
  const result = streamText({
    model,
    system: PHASE_PROMPTS[phase],
    prompt: prompt.trim(),
    temperature: 0.35,
  });

  return result.toTextStreamResponse();
}