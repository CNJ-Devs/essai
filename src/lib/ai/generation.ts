import { generateText } from "ai";
import {
  PROMPT_TEMPLATE_VERSION,
  buildDraftPrompt,
  buildDraftRevisionPrompt,
} from "@/lib/ai/prompt";
import type { Fragment, SchemeSnapshot } from "@/lib/types";

const DEFAULT_MODEL = "openai/gpt-5.5";

function canUseGateway() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL);
}

export async function generateFragmentTitle(content: string) {
  const fallback = content
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);

  if (!canUseGateway()) {
    return fallback || "未命名碎片";
  }

  try {
    const { text } = await generateText({
      model: process.env.AI_MODEL ?? DEFAULT_MODEL,
      instructions: "你只负责为一条中文创作碎片起一个短标题，不要输出解释。",
      prompt: `请为这条碎片起一个 6 到 16 个中文字符的标题：\n\n${content}`,
    });

    return text.replace(/^["“]|["”]$/g, "").trim() || fallback || "未命名碎片";
  } catch {
    return fallback || "未命名碎片";
  }
}

export async function generateDraftContent(
  fragment: Fragment,
  snapshot: SchemeSnapshot,
) {
  const model = process.env.AI_MODEL ?? DEFAULT_MODEL;

  if (!canUseGateway()) {
    return {
      content: buildFallbackDraft(fragment, snapshot),
      model: "local-fallback",
      promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
    };
  }

  const { text } = await generateText({
    model,
    instructions:
      "你是 EssAI 的成稿引擎。你要把碎片酝酿成可直接使用的中文草稿，保持自然、有判断、可执行。",
    prompt: buildDraftPrompt(fragment, snapshot),
  });

  return {
    content: text,
    model,
    promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
  };
}

export async function reviseDraftContent({
  fragment,
  snapshot,
  currentDraft,
  instruction,
}: {
  fragment: Fragment;
  snapshot: SchemeSnapshot;
  currentDraft: string;
  instruction: string;
}) {
  const model = process.env.AI_MODEL ?? DEFAULT_MODEL;

  if (!canUseGateway()) {
    return {
      content: buildFallbackRevision({
        fragment,
        snapshot,
        currentDraft,
        instruction,
      }),
      model: "local-fallback",
      promptTemplateVersion: `${PROMPT_TEMPLATE_VERSION}-revision`,
    };
  }

  const { text } = await generateText({
    model,
    instructions:
      "你是 EssAI 的成稿改写引擎。你只输出改写后的完整中文稿件，不输出解释、计划或聊天回复。",
    prompt: buildDraftRevisionPrompt({
      fragment,
      snapshot,
      currentDraft,
      instruction,
    }),
  });

  return {
    content: text,
    model,
    promptTemplateVersion: `${PROMPT_TEMPLATE_VERSION}-revision`,
  };
}

function buildFallbackDraft(fragment: Fragment, snapshot: SchemeSnapshot) {
  const lawList =
    snapshot.laws.length > 0
      ? snapshot.laws.map((law) => `- ${law.name}`).join("\n")
      : "- 暂未绑定创作法则";

  return `标题建议
${fragment.title}

内容定位
基于「${snapshot.schemeName}」的出稿方案，把这条碎片先整理成一版可继续编辑的初稿。

核心表达
${fragment.content}

正文成稿
这是一条围绕「${fragment.title}」展开的初稿。

开头先把问题抛出来：为什么这个念头会在当下冒出来？它背后真正想表达的，可能不是一个结论，而是一个还没有被好好安放的观察。

中段可以顺着碎片里的关键词展开，补上具体场景、冲突和判断。这里不要急着把话说满，先让表达保留一点真实的呼吸感。

结尾回到这条内容对观众的意义：如果你也有类似的瞬间，可以先把它收住，等它慢慢长成更完整的表达。

可选改法
- 加一个更锋利的开场
- 补一个真实场景或个人经历
- 调整成更适合平台发布的节奏

可补充信息
- 你希望这条内容更像口播、图文，还是视频脚本
- 是否有必须出现或必须避开的个人经历
- 目标平台和期望时长

已参考法则
${lawList}`;
}

function buildFallbackRevision({
  fragment,
  snapshot,
  instruction,
}: {
  fragment: Fragment;
  snapshot: SchemeSnapshot;
  currentDraft: string;
  instruction: string;
}) {
  return `标题建议
${fragment.title}

内容定位
基于「${snapshot.schemeName}」继续打磨这一版稿件，已吸收你的修改意见。

核心表达
${fragment.content}

正文成稿
这是一版围绕「${fragment.title}」重新打磨后的成稿。

它会保留原始碎片里最重要的判断，同时把表达往这个方向收拢：${instruction.trim()}

开头要更快进入现场，让读者或观众立刻知道这条内容和自己有什么关系。中段围绕一个清晰判断展开，不把话说散，也不把语气做成说教。结尾把观点收回来，留下一个能继续思考或行动的落点。

收束
如果这一版继续打磨，可以再补一个更具体的场景，或者把节奏压得更适合最终发布的平台。`;
}
