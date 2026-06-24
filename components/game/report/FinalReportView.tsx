"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchWithVersion } from "@/lib/api/fetchWithVersion";
import GameLoader from "@/components/ui/GameLoader";
import { toast } from "@/components/ui/Toast";
import { REPORT_FINAL_CHOICES } from "@/constants/reportFinalChoices";
import { ReportQuestion } from "./ReportQuestion";
import { ReportResult } from "./ReportResult";

// =============================================================
// Types
// =============================================================

interface Question {
  id: string;
  orderIndex: number;
  questionText: string;
  options: string[];
}

interface QuestionsResponse {
  questions: Question[];
  finalReportQuestionId: string | null;
  version: number;
}

interface AnswerItem {
  questionText: string;
  selectedLabel: string;
  isCorrect: boolean;
  isFinalQuestion: boolean;
}

interface FinalContent {
  title: string;
  bodyText: string;
  finalChoiceValue: string;
}

interface LinkBlock {
  blockIndex: number;
  text: string;
  images: unknown;
}

interface Score {
  correctCount: number;
  totalCount: number;
  percent: number | null;
}

interface ResultData {
  score: Score;
  answers: AnswerItem[];
  finalContent: FinalContent;
  linkBlocks: LinkBlock[];
}

type Stage = "loading" | "questions" | "result";

interface Props {
  alreadySubmitted: boolean;
}

// =============================================================
// Component
// =============================================================

export function FinalReportView({
  alreadySubmitted,
}: Props): React.ReactElement {
  const [stage, setStage] = useState<Stage>("loading");
  const [version, setVersion] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [finalReportQuestionId, setFinalReportQuestionId] = useState<
    string | null
  >(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  const choiceLabels = REPORT_FINAL_CHOICES.map((c) =>
    c.label.trim().toLowerCase(),
  );

  // If finalReportQuestionId is configured — use it.
  // Otherwise fall back to scanning all questions for one whose options match REPORT_FINAL_CHOICES.
  const finalQuestion =
    questions.find((q) => q.id === finalReportQuestionId) ??
    questions.find((q) => {
      const opts = q.options.map((o) => o.trim().toLowerCase());
      return choiceLabels.every((l) => opts.includes(l));
    }) ??
    null;

  const controlQuestions = questions.filter((q) => q.id !== finalQuestion?.id);

  const allAnswered =
    questions.length > 0 && Object.keys(answers).length === questions.length;

  // =============================================================
  // Data fetching
  // =============================================================

  const fetchResult = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/final-report/result");
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Ошибка загрузки результата");
        return;
      }
      const data = (await res.json()) as ResultData;
      setResultData(data);
      setStage("result");
    } catch (err) {
      console.error("[FinalReportView] fetchResult", err);
      toast.error("Ошибка соединения");
    }
  }, []);

  useEffect(() => {
    if (alreadySubmitted) {
      void fetchResult();
      return;
    }

    async function fetchQuestions(): Promise<void> {
      try {
        const res = await fetch("/api/final-report/questions");
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          toast.error(data.error ?? "Ошибка загрузки вопросов");
          return;
        }
        const data = (await res.json()) as QuestionsResponse;
        setQuestions(data.questions);
        setFinalReportQuestionId(data.finalReportQuestionId);
        setVersion(data.version);
        setStage("questions");
      } catch (err) {
        console.error("[FinalReportView] fetchQuestions", err);
        toast.error("Ошибка соединения");
      }
    }

    void fetchQuestions();
  }, [alreadySubmitted, fetchResult]);

  // =============================================================
  // Handlers
  // =============================================================

  const handleAnswer = (questionId: string, optionIndex: number): void => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const getFinalChoice = (): string | null => {
    if (!finalQuestion) return null;
    const selectedIndex = answers[finalQuestion.id];
    if (selectedIndex === undefined) return null;
    const selectedLabel = finalQuestion.options[selectedIndex]?.trim();
    if (!selectedLabel) return null;
    const match = REPORT_FINAL_CHOICES.find(
      (c) => c.label.trim().toLowerCase() === selectedLabel.toLowerCase(),
    );
    return match?.value ?? null;
  };

  const refetchVersion = async (): Promise<void> => {
    try {
      const res = await fetch("/api/final-report/questions");
      if (res.ok) {
        const data = (await res.json()) as QuestionsResponse;
        setVersion(data.version);
      }
    } catch {
      // version stays stale — user will see 409 again and can retry
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!allAnswered || isSubmitting) return;

    const finalChoice = getFinalChoice();
    if (!finalChoice) {
      toast.error("Необходимо выбрать «Обвинить» или «Защитить»");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetchWithVersion("/api/final-report/submit", {
        body: {
          finalChoice,
          answers: Object.entries(answers).map(
            ([questionId, selectedOption]) => ({
              questionId,
              selectedOption,
            }),
          ),
          expectedVersion: version,
        },
        onConflict: refetchVersion,
      });

      if (response.status === 409) {
        return;
      }

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        toast.error(data.error ?? "Ошибка при отправке отчета");
        return;
      }

      await fetchResult();
    } catch (err) {
      console.error("[FinalReportView] handleSubmit", err);
      toast.error("Ошибка соединения");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplay = async (): Promise<void> => {
    setIsRestarting(true);
    try {
      const res = await fetch("/api/game/restart", { method: "POST" });
      if (res.ok) {
        window.location.reload();
        return;
      }
      if (res.status === 429) {
        toast.warning("Слишком частые попытки, подождите немного");
      } else {
        toast.error("Ошибка перезапуска. Попробуйте позже");
      }
    } catch (err) {
      console.error("[FinalReportView] handleReplay", err);
      toast.error("Ошибка перезапуска. Попробуйте позже");
    } finally {
      setIsRestarting(false);
    }
  };

  // =============================================================
  // Render
  // =============================================================

  if (stage === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <GameLoader />
      </div>
    );
  }

  if (stage === "result" && resultData) {
    return (
      <ReportResult
        score={resultData.score}
        answers={resultData.answers}
        finalContent={resultData.finalContent}
        linkBlocks={resultData.linkBlocks}
        onReplay={handleReplay}
        isRestarting={isRestarting}
      />
    );
  }

  // stage === 'questions'
  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Control questions */}
      {controlQuestions.length > 0 && (
        <div className="flex flex-col gap-4">
          {controlQuestions.map((q, i) => (
            <ReportQuestion
              key={q.id}
              question={q}
              questionNumber={i + 1}
              selectedOption={answers[q.id] ?? null}
              onChange={(index) => handleAnswer(q.id, index)}
            />
          ))}
        </div>
      )}

      {/* Final choice block — same card style as control questions */}
      {finalQuestion && (
        <div className="rounded-game-lg border border-white/80 bg-[rgba(255,255,255,0.1)] p-4 backdrop-blur-sm">
          <div className="mb-0 flex items-start gap-3 border-b border-white/80 pb-3">
            <span className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center select-none">
              <span className="pointer-events-none absolute left-0 top-0 h-3.5 w-3.5 border-l-[2px] border-t-[2px] border-[#44DFD7]" />
              <span className="pointer-events-none absolute right-0 top-0 h-3.5 w-3.5 border-r-[2px] border-t-[2px] border-[#44DFD7]" />
              <span className="pointer-events-none absolute bottom-0 left-0 h-3.5 w-3.5 border-b-[2px] border-l-[2px] border-[#44DFD7]" />
              <span className="pointer-events-none absolute bottom-0 right-0 h-3.5 w-3.5 border-b-[2px] border-r-[2px] border-[#44DFD7]" />
              <span
                className="font-mono font-normal"
                style={{ fontSize: 20, color: "#44DFD7", lineHeight: 1 }}
                aria-hidden="true"
              >
                →
              </span>
            </span>
            <p
              className="font-mono font-normal tracking-wide"
              style={{ fontSize: 20, color: "#44DFD7", lineHeight: 1.25 }}
            >
              {finalQuestion.questionText}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-4">
            {finalQuestion.options.map((option, index) => {
              const selected = answers[finalQuestion.id] === index;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleAnswer(finalQuestion.id, index)}
                  className="flex items-center gap-2 rounded p-2 text-left font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  style={{ fontSize: 16, color: "#ffffff" }}
                >
                  <span
                    className="shrink-0 select-none whitespace-nowrap leading-none"
                    style={{ color: selected ? "#44DFD7" : "#ffffff" }}
                  >
                    {selected ? "[✓]" : "[  ]"}
                  </span>
                  <span>{option}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Submit button */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          disabled={!allAnswered || isSubmitting}
          onClick={() => void handleSubmit()}
          className={[
            "rounded-game-lg px-12 py-3 font-mono text-[20px] font-bold uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            allAnswered && !isSubmitting
              ? "bg-accent text-black hover:opacity-80"
              : "cursor-not-allowed bg-accent/20 text-content-muted opacity-50",
          ].join(" ")}
        >
          {isSubmitting ? "Отправка..." : "Отправить отчет"}
        </button>
      </div>
    </div>
  );
}
