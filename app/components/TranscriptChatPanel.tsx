"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
  KeyRound,
  Lightbulb,
  ListChecks,
  ListTree,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import {
  trackEvent,
  type AskAiQuestionSource,
  type AskAiTranscriptSource,
} from "@/lib/analytics";
import {
  AI_CHAT_HISTORY_PAGE_SIZE,
  AI_CHAT_QUESTION_CHAR_LIMIT,
  PLANS,
  type Tier,
} from "@/lib/plans";

type ChatMessage = {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

type ChatPayload = {
  messages: ChatMessage[];
  hasOlder: boolean;
  used: number;
  cap: number;
  resetAt: string | null;
};

type ChatResponse = {
  answer: string;
  answerTruncated: boolean;
  used: number;
  cap: number;
  remaining: number;
  resetAt: string | null;
  transcriptTruncated: boolean;
  historyTruncated: boolean;
};

type ErrorPayload = {
  error?: string;
  maxChars?: number;
  requestId?: string;
  cap?: number;
  resetAt?: string | null;
};

export function TranscriptChatPanel({
  id,
  canUpgrade,
  fillHeight = false,
  onUpgrade,
  planTier,
  transcriptSource,
}: {
  id: string;
  canUpgrade: boolean;
  fillHeight?: boolean;
  onUpgrade: () => void;
  planTier: Tier;
  transcriptSource: AskAiTranscriptSource;
}) {
  const t = useTranslations("Dashboard.viewer");
  const format = useFormatter();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [used, setUsed] = useState(0);
  const [cap, setCap] = useState<number>(PLANS.pro.aiQuestionsPerCycle);
  const [resetAt, setResetAt] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answerTruncated, setAnswerTruncated] = useState(false);
  const [transcriptTruncated, setTranscriptTruncated] = useState(false);
  const [historyTruncated, setHistoryTruncated] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadChat() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/transcripts/${id}/chat`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`chat_${response.status}`);
        const payload = (await response.json()) as ChatPayload;
        setMessages(payload.messages);
        setHasOlder(payload.hasOlder);
        setUsed(payload.used);
        setCap(payload.cap);
        setResetAt(payload.resetAt);
      } catch {
        if (controller.signal.aborted) return;
        setError(t("chatError"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadChat();
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, sending]);

  const quotaExhausted = used >= cap;
  const resetDate = resetAt ? parseResetDate(resetAt) : null;
  const resetLabel = resetDate
    ? format.dateTime(resetDate, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;
  const trimmedQuestion = question.trim();
  const questionTooLong = question.length > AI_CHAT_QUESTION_CHAR_LIMIT;
  const canSend =
    !loading &&
    !sending &&
    !clearing &&
    !quotaExhausted &&
    trimmedQuestion.length > 0 &&
    !questionTooLong;
  const starterQuestions = [
    { key: "keyPoints", icon: ListChecks, question: t("chatStarterKeyPoints") },
    { key: "outline", icon: ListTree, question: t("chatStarterOutline") },
    { key: "insights", icon: Lightbulb, question: t("chatStarterInsights") },
    { key: "keywords", icon: KeyRound, question: t("chatStarterKeywords") },
    { key: "summary", icon: Target, question: t("chatStarterSummary") },
  ];

  async function sendQuestion(questionOverride?: string) {
    const submittedQuestion = (questionOverride ?? question).trim();
    const questionSource: AskAiQuestionSource =
      questionOverride === undefined ? "typed" : "starter";
    if (
      loading ||
      sending ||
      clearing ||
      quotaExhausted ||
      !submittedQuestion ||
      submittedQuestion.length > AI_CHAT_QUESTION_CHAR_LIMIT
    ) {
      return;
    }

    setQuestion(submittedQuestion);
    setSending(true);
    setError(null);
    const analyticsContext = {
      plan_tier: planTier,
      question_source: questionSource,
      transcript_source: transcriptSource,
    } as const;
    trackEvent("ask_ai_question_submitted", analyticsContext);
    let failureTracked = false;

    try {
      const response = await fetch(`/api/transcripts/${id}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: submittedQuestion }),
      });
      const payload = (await readJson(response)) as (ChatResponse & ErrorPayload) | null;
      if (!response.ok || !payload?.answer) {
        const errorCode = chatErrorCode(response, payload?.error);
        trackEvent("ask_ai_answer_failed", {
          ...analyticsContext,
          error_code: errorCode,
        });
        failureTracked = true;
        if (payload?.error === "ai_quota_exceeded") {
          trackEvent("ask_ai_quota_reached", analyticsContext);
          setUsed(payload.cap ?? cap);
          setResetAt(payload.resetAt ?? null);
        }
        throw new Error(
          payload?.requestId
            ? `${t("chatError")} · ${payload.requestId}`
            : errorMessage(payload?.error)
        );
      }

      const now = Date.now();
      setMessages((current) => [
        ...current,
        {
          id: `user-${now}`,
          role: "user",
          content: submittedQuestion,
        },
        {
          id: `assistant-${now}`,
          role: "assistant",
          content: payload.answer,
        },
      ]);
      setUsed(payload.used);
      setCap(payload.cap);
      setResetAt(payload.resetAt);
      setAnswerTruncated(payload.answerTruncated);
      setTranscriptTruncated((current) => current || payload.transcriptTruncated);
      setHistoryTruncated((current) => current || payload.historyTruncated);
      setQuestion("");
      trackEvent("ask_ai_answer_succeeded", {
        ...analyticsContext,
        answer_truncated: payload.answerTruncated,
        transcript_truncated: payload.transcriptTruncated,
        history_truncated: payload.historyTruncated,
      });
      if (payload.remaining === 0) {
        trackEvent("ask_ai_quota_reached", analyticsContext);
      }
    } catch (sendError) {
      if (!failureTracked) {
        trackEvent("ask_ai_answer_failed", {
          ...analyticsContext,
          error_code: "network_error",
        });
      }
      setError(sendError instanceof Error ? sendError.message : t("chatError"));
    } finally {
      setSending(false);
    }
  }

  async function clearChat() {
    if (!messages.length || clearing || sending) return;
    if (!window.confirm(t("chatClearConfirm"))) return;

    setClearing(true);
    setError(null);
    try {
      const response = await fetch(`/api/transcripts/${id}/chat`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(t("chatClearError"));
      setMessages([]);
      setHasOlder(false);
      setAnswerTruncated(false);
      setHistoryTruncated(false);
      trackEvent("ask_ai_chat_cleared", {
        plan_tier: planTier,
        transcript_source: transcriptSource,
      });
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : t("chatClearError"));
    } finally {
      setClearing(false);
    }
  }

  function errorMessage(code: string | undefined): string {
    if (code === "message_too_long") {
      return t("chatQuestionTooLong", { max: AI_CHAT_QUESTION_CHAR_LIMIT });
    }
    if (code === "ai_quota_exceeded") return t("chatQuotaReached");
    return t("chatError");
  }

  return (
    <div
      className={`overflow-hidden bg-card ${
        fillHeight
          ? "flex h-full min-h-0 flex-col rounded-none border-0"
          : "rounded-2xl border border-line"
      }`}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-accent" />
            <p className="text-[14px] font-semibold text-ink">{t("chatTitle")}</p>
          </div>
          <p className="mt-1 text-[12px] text-ink/52">{t("chatGroundingNote")}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] tabular-nums text-ink/50">
            {t("chatUsage", { used, cap })}
          </span>
          <button
            type="button"
            onClick={clearChat}
            disabled={!messages.length || clearing || sending}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-ink/55 transition hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Trash2 size={13} />
            {clearing ? t("chatClearing") : t("chatClear")}
          </button>
        </div>
      </div>

      {transcriptTruncated ? (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] leading-5 text-amber-900 sm:px-5">
          {t("chatTranscriptTruncated")}
        </p>
      ) : null}
      {answerTruncated ? (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] leading-5 text-amber-900 sm:px-5">
          {t("chatAnswerTruncated")}
        </p>
      ) : null}
      {historyTruncated || hasOlder ? (
        <p className="border-b border-line bg-paper/60 px-4 py-2 text-[12px] text-ink/52 sm:px-5">
          {historyTruncated
            ? t("chatHistoryTruncated")
            : t("chatOlderHidden", { count: AI_CHAT_HISTORY_PAGE_SIZE })}
        </p>
      ) : null}

      <div
        aria-live="polite"
        className={`overflow-y-auto overscroll-contain px-4 py-5 sm:px-5 ${
          fillHeight ? "min-h-0 flex-1" : "max-h-[520px] min-h-[300px]"
        }`}
      >
        {loading ? (
          <p className="py-16 text-center text-sm text-ink/50">{t("chatLoading")}</p>
        ) : messages.length === 0 && !sending ? (
          <div className="mx-auto max-w-lg py-10 text-center sm:py-14">
            <div className="mx-auto grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
              <Sparkles size={17} />
            </div>
            <p className="mt-4 text-[15px] font-medium text-ink">{t("chatEmptyTitle")}</p>
            <p className="mt-1.5 text-[13px] leading-5 text-ink/52">{t("chatEmptyBody")}</p>
            <div className="mt-7 grid gap-2.5 text-left">
              {starterQuestions.map(({ key, icon: Icon, question: starterQuestion }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => void sendQuestion(starterQuestion)}
                  disabled={quotaExhausted || clearing}
                  className="group flex min-h-12 w-full items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-3 text-left text-[13px] font-medium leading-5 text-ink/70 transition hover:border-ink/20 hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:text-[14px]"
                >
                  <Icon
                    size={16}
                    strokeWidth={1.8}
                    aria-hidden="true"
                    className="shrink-0 text-accent"
                  />
                  <span className="min-w-0 flex-1">{starterQuestion}</span>
                  <ChevronRight
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-ink/35 transition-transform group-hover:translate-x-0.5 group-hover:text-ink/60"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}
            {sending ? (
              <>
                <ChatBubble
                  message={{
                    id: "pending-user",
                    role: "user",
                    content: question.trim(),
                  }}
                />
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-line bg-paper px-4 py-3 text-[13px] text-ink/50">
                    {t("chatThinking")}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-line bg-paper/70 p-3 sm:p-4">
        {quotaExhausted ? (
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[12px] font-medium text-amber-800">
                {t("chatQuotaReached")}
              </p>
              {!canUpgrade && resetLabel ? (
                <p className="mt-1 text-[11px] text-amber-800/75">
                  {t("chatQuotaResets", { date: resetLabel })}
                </p>
              ) : null}
            </div>
            {canUpgrade ? (
              <button
                type="button"
                onClick={() => {
                  trackEvent("ask_ai_upgrade_clicked", {
                    plan_tier: planTier,
                    transcript_source: transcriptSource,
                  });
                  onUpgrade();
                }}
                className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-accent/90"
              >
                {t("chatUpgrade")}
              </button>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p className="mb-2.5 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">
            {error}
          </p>
        ) : null}
        {questionTooLong ? (
          <p className="mb-2.5 text-[12px] font-medium text-red-700">
            {t("chatQuestionTooLong", { max: AI_CHAT_QUESTION_CHAR_LIMIT })}
          </p>
        ) : null}
        <div className="flex items-end gap-2 rounded-xl border border-line bg-card p-2 focus-within:border-ink/30">
          <label htmlFor="transcript-chat-question" className="sr-only">
            {t("chatInputLabel")}
          </label>
          <textarea
            id="transcript-chat-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendQuestion();
              }
            }}
            disabled={loading || sending || clearing || quotaExhausted}
            maxLength={AI_CHAT_QUESTION_CHAR_LIMIT + 1}
            rows={2}
            placeholder={t("chatPlaceholder")}
            className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] leading-5 text-ink outline-none placeholder:text-ink/35 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => void sendQuestion()}
            disabled={!canSend}
            aria-label={t("chatSend")}
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink text-paper transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowUp size={16} strokeWidth={2.2} />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3 px-1">
          <p className="text-[11px] text-ink/40">{t("chatInputHint")}</p>
          <span
            className={`font-mono text-[10px] tabular-nums ${
              questionTooLong ? "text-red-600" : "text-ink/35"
            }`}
          >
            {question.length}/{AI_CHAT_QUESTION_CHAR_LIMIT}
          </span>
        </div>
      </div>
    </div>
  );
}

function chatErrorCode(response: Response, providerCode?: string): string {
  if (providerCode) return providerCode;
  return response.ok ? "invalid_response" : `http_${response.status}`;
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] whitespace-pre-wrap px-4 py-3 text-[14px] leading-6 ${
          isUser
            ? "rounded-2xl rounded-br-md bg-ink text-paper"
            : "rounded-2xl rounded-bl-md border border-line bg-paper text-ink/85"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function parseResetDate(value: string): Date | null {
  const date = new Date(
    value.includes("T") ? value : `${value.replace(" ", "T")}Z`
  );
  return Number.isNaN(date.getTime()) ? null : date;
}
