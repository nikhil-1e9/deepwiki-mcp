import React, { useMemo, useState } from "react";
import { z } from "zod";
import { useWidget } from "mcp-use/react";

const propSchema = z.object({
  owner: z.string().optional().describe("GitHub owner or organization"),
  repo: z.string().describe("GitHub repository name"),
  question: z.string().describe("The question asked about the repository"),
  answer: z
    .string()
    .optional()
    .describe("The answer text to render. Can also come from structuredContent."),
  sourceUrl: z
    .string()
    .url()
    .optional()
    .describe("Optional DeepWiki or GitHub URL to open"),
});

export const widgetMetadata = {
  description:
    "Render a polished DeepWiki answer card with the repo name, question, answer, and a follow-up button.",
  inputs: propSchema,
};

type DeepWikiAnswerCardProps = z.infer<typeof propSchema>;

type DeepWikiAnswerOutput = {
  answer?: string;
  repo?: string;
  owner?: string;
  question?: string;
  sourceUrl?: string;
};

function splitCodeBlocks(text: string) {
  const parts = text.split(/```/g);
  return parts.map((part, index) => ({
    type: index % 2 === 0 ? "text" : "code",
    value: part.trim(),
  }));
}

function renderTextBlock(text: string, keyPrefix: string, color: string) {
  const paragraphs = text
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);

  return paragraphs.map((paragraph, index) => {
    const lines = paragraph
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const isBulletList =
      lines.length > 1 &&
      lines.every((line) => /^([-*•]|\d+\.)\s+/.test(line));

    if (isBulletList) {
      const isOrdered = lines.every((line) => /^\d+\.\s+/.test(line));
      const ListTag = isOrdered ? "ol" : "ul";

      return (
        <ListTag
          key={`${keyPrefix}-list-${index}`}
          style={{
            margin: "0 0 14px 0",
            paddingLeft: 22,
            color,
            lineHeight: 1.7,
          }}
        >
          {lines.map((line, itemIndex) => (
            <li key={`${keyPrefix}-item-${index}-${itemIndex}`}>
              {line.replace(/^([-*•]|\d+\.)\s+/, "")}
            </li>
          ))}
        </ListTag>
      );
    }

    return (
      <p
        key={`${keyPrefix}-p-${index}`}
        style={{
          margin: "0 0 14px 0",
          color,
          lineHeight: 1.75,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: 14,
        }}
      >
        {paragraph}
      </p>
    );
  });
}

const DeepWikiAnswerCard: React.FC = () => {
  const { props, output, theme, sendFollowUpMessage, openExternal, isAvailable } =
    useWidget<DeepWikiAnswerCardProps, DeepWikiAnswerOutput>();

  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [followUpSent, setFollowUpSent] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const owner = props.owner ?? output?.owner ?? "";
  const repo = props.repo ?? output?.repo ?? "repository";
  const question = props.question ?? output?.question ?? "";
  const answer = props.answer ?? output?.answer ?? "";
  const sourceUrl = props.sourceUrl ?? output?.sourceUrl;

  const repoLabel = owner ? `${owner}/${repo}` : repo;

  const palette = useMemo(() => {
    const dark = theme === "dark";
    return {
      pageBg: dark
        ? "linear-gradient(180deg, #0b1020 0%, #121a33 100%)"
        : "linear-gradient(180deg, #f7faff 0%, #edf4ff 100%)",
      cardBg: dark ? "rgba(11, 17, 32, 0.92)" : "rgba(255, 255, 255, 0.96)",
      border: dark ? "rgba(148, 163, 184, 0.18)" : "rgba(59, 130, 246, 0.14)",
      heading: dark ? "#f8fafc" : "#0f172a",
      muted: dark ? "#94a3b8" : "#475569",
      text: dark ? "#dbe7ff" : "#1e293b",
      accent: dark ? "#7dd3fc" : "#2563eb",
      accentSoft: dark ? "rgba(125, 211, 252, 0.12)" : "rgba(37, 99, 235, 0.08)",
      questionBg: dark ? "rgba(30, 41, 59, 0.72)" : "#f8fbff",
      answerBg: dark ? "rgba(15, 23, 42, 0.72)" : "#ffffff",
      codeBg: dark ? "#09111f" : "#f3f7ff",
      buttonBg: dark ? "#38bdf8" : "#2563eb",
      buttonText: "#ffffff",
      subtleButtonBg: dark ? "rgba(148, 163, 184, 0.12)" : "#eef4ff",
      subtleButtonText: dark ? "#dbeafe" : "#1d4ed8",
      shadow: dark
        ? "0 20px 50px rgba(2, 6, 23, 0.45)"
        : "0 18px 40px rgba(37, 99, 235, 0.12)",
    };
  }, [theme]);

  const renderedAnswer = useMemo(() => {
    if (!answer) {
      return null;
    }

    return splitCodeBlocks(answer).map((block, index) => {
      if (!block.value) {
        return null;
      }

      if (block.type === "code") {
        return (
          <pre
            key={`code-${index}`}
            style={{
              margin: "0 0 16px 0",
              padding: "14px 16px",
              borderRadius: 14,
              background: palette.codeBg,
              color: palette.text,
              overflowX: "auto",
              fontSize: 13,
              lineHeight: 1.6,
              border: `1px solid ${palette.border}`,
            }}
          >
            <code>{block.value}</code>
          </pre>
        );
      }

      return (
        <div key={`text-${index}`}>
          {renderTextBlock(block.value, `block-${index}`, palette.text)}
        </div>
      );
    });
  }, [answer, palette.codeBg, palette.border, palette.text]);

  const handleFollowUp = async () => {
    if (!sendFollowUpMessage || sendingFollowUp) {
      return;
    }

    setSendingFollowUp(true);
    setFollowUpError(null);

    try {
      await sendFollowUpMessage(
        `Ask a follow-up about ${repoLabel}. Original question: "${question}". Build on the previous answer and go one level deeper with more implementation detail.`
      );
      setFollowUpSent(true);
    } catch (error) {
      setFollowUpError(
        error instanceof Error ? error.message : "Unable to send follow-up."
      );
    } finally {
      setSendingFollowUp(false);
    }
  };

  const canAskFollowUp =
    isAvailable && typeof sendFollowUpMessage === "function" && question.length > 0;

  return (
    <div
      style={{
        minHeight: "100%",
        padding: 16,
        background: palette.pageBg,
        fontFamily:
          'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          background: palette.cardBg,
          border: `1px solid ${palette.border}`,
          borderRadius: 24,
          boxShadow: palette.shadow,
          overflow: "hidden",
          backdropFilter: "blur(14px)",
        }}
      >
        <div
          style={{
            padding: 22,
            borderBottom: `1px solid ${palette.border}`,
            background: palette.accentSoft,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 12px",
              borderRadius: 999,
              background: palette.cardBg,
              border: `1px solid ${palette.border}`,
              fontSize: 12,
              color: palette.accent,
              fontWeight: 700,
              letterSpacing: 0.2,
              marginBottom: 14,
            }}
          >
            DeepWiki Answer
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 28,
              lineHeight: 1.15,
              color: palette.heading,
              fontWeight: 800,
              wordBreak: "break-word",
            }}
          >
            {repoLabel}
          </h1>

          <div
            style={{
              marginTop: 10,
              color: palette.muted,
              fontSize: 14,
            }}
          >
            Repository summary card with interactive follow-up support
          </div>
        </div>

        <div style={{ padding: 22 }}>
          <section
            style={{
              marginBottom: 18,
              padding: 18,
              borderRadius: 18,
              background: palette.questionBg,
              border: `1px solid ${palette.border}`,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.3,
                textTransform: "uppercase",
                color: palette.accent,
                marginBottom: 10,
              }}
            >
              Question
            </div>

            <div
              style={{
                color: palette.heading,
                fontSize: 16,
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {question || "No question provided."}
            </div>
          </section>

          <section
            style={{
              padding: 18,
              borderRadius: 18,
              background: palette.answerBg,
              border: `1px solid ${palette.border}`,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.3,
                textTransform: "uppercase",
                color: palette.accent,
                marginBottom: 12,
              }}
            >
              Answer
            </div>

            {answer ? (
              <div>{renderedAnswer}</div>
            ) : (
              <div
                style={{
                  color: palette.muted,
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                No answer content was provided to the widget.
              </div>
            )}
          </section>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 18,
            }}
          >
            <button
              type="button"
              onClick={handleFollowUp}
              disabled={!canAskFollowUp || sendingFollowUp || followUpSent}
              style={{
                appearance: "none",
                border: "none",
                borderRadius: 14,
                padding: "12px 16px",
                background:
                  !canAskFollowUp || followUpSent
                    ? palette.subtleButtonBg
                    : palette.buttonBg,
                color:
                  !canAskFollowUp || followUpSent
                    ? palette.subtleButtonText
                    : palette.buttonText,
                fontSize: 14,
                fontWeight: 700,
                cursor:
                  !canAskFollowUp || sendingFollowUp || followUpSent
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {sendingFollowUp
                ? "Sending..."
                : followUpSent
                  ? "Follow-up queued"
                  : "Ask follow-up"}
            </button>

            {sourceUrl ? (
              <button
                type="button"
                onClick={() => openExternal?.(sourceUrl)}
                style={{
                  appearance: "none",
                  borderRadius: 14,
                  padding: "12px 16px",
                  background: palette.subtleButtonBg,
                  color: palette.subtleButtonText,
                  border: `1px solid ${palette.border}`,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: openExternal ? "pointer" : "default",
                }}
              >
                Open source
              </button>
            ) : null}
          </div>

          {followUpError ? (
            <div
              style={{
                marginTop: 12,
                color: "#dc2626",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {followUpError}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DeepWikiAnswerCard;
