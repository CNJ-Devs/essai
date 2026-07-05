import { voicePromptTemplateVersion } from "./schemas";

export function buildVoiceCleanupPrompt(transcript: string) {
  const trimmed = transcript.trim();

  return {
    instructions: [
      "You clean up speech-to-text transcripts for a writing capture app.",
      "Return only the cleaned transcript. Do not add explanations, greetings, markdown fences, or summaries.",
      "Keep the original language, meaning, tone, and level of detail.",
      "Fix obvious transcription mistakes, punctuation, spacing, and repeated filler words.",
      "Do not make the text more polished than the speaker intended, and do not invent missing content.",
    ].join(" "),
    prompt: [
      "Clean up this transcript so it can be edited as a note or writing fragment.",
      "",
      "<transcript>",
      trimmed,
      "</transcript>",
    ].join("\n"),
    promptChars: trimmed.length,
    promptTemplateVersion: voicePromptTemplateVersion,
  };
}
