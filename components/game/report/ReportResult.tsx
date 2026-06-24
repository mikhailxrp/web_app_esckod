"use client";

import Image from "next/image";

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

interface LinkImage {
  url: string;
  key: string;
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

interface Props {
  score: Score;
  answers: AnswerItem[];
  finalContent: FinalContent;
  linkBlocks: LinkBlock[];
  onReplay: () => Promise<void>;
  isRestarting: boolean;
}

function parseLinkImages(images: unknown): LinkImage[] {
  if (!Array.isArray(images)) return [];
  return images.filter(
    (item): item is LinkImage =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).url === "string" &&
      typeof (item as Record<string, unknown>).key === "string",
  );
}

export function ReportResult({
  score,
  answers,
  finalContent,
  linkBlocks,
  onReplay,
  isRestarting,
}: Props): React.ReactElement {
  const controlAnswers = answers.filter((a) => !a.isFinalQuestion);
  const finalAnswer = answers.find((a) => a.isFinalQuestion);

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Score heading */}
      <p className="font-mono text-2xl font-normal leading-tight text-content-base">
        Вы ответили верно на{" "}
        <span className="text-accent">{score.correctCount} вопросов</span> из{" "}
        <span className="text-accent">{score.totalCount}</span>
      </p>

      {/* Two-column grid: answers left, link blocks right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: answer list */}
        <div className="flex flex-col gap-3 lg:col-span-2">
          {controlAnswers.map((answer, i) => (
            <div
              key={i}
              className="rounded-game-lg border border-white/80 bg-[rgba(255,255,255,0.1)] p-4 backdrop-blur-sm"
            >
              <div className="flex items-start gap-2 border-b border-white/80 pb-3">
                <span className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center select-none">
                  <span className="pointer-events-none absolute left-0 top-0 h-3.5 w-3.5 border-l-[2px] border-t-[2px] border-[#44DFD7]" />
                  <span className="pointer-events-none absolute right-0 top-0 h-3.5 w-3.5 border-r-[2px] border-t-[2px] border-[#44DFD7]" />
                  <span className="pointer-events-none absolute bottom-0 left-0 h-3.5 w-3.5 border-b-[2px] border-l-[2px] border-[#44DFD7]" />
                  <span className="pointer-events-none absolute bottom-0 right-0 h-3.5 w-3.5 border-b-[2px] border-r-[2px] border-[#44DFD7]" />
                  <span
                    className="font-mono font-normal"
                    style={{ fontSize: 18, color: "#44DFD7", lineHeight: 1 }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                </span>
                <p
                  className="font-mono font-normal tracking-wide"
                  style={{ fontSize: 18, color: "#44DFD7", lineHeight: 1.25 }}
                >
                  {answer.questionText}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-3">
                <span
                  className="shrink-0 select-none font-mono font-normal"
                  style={{
                    fontSize: 16,
                    color: answer.isCorrect
                      ? "var(--color-semantic-success, #4ade80)"
                      : "var(--color-semantic-error, #f87171)",
                  }}
                >
                  {answer.isCorrect ? "[✓]" : "[✗]"}
                </span>
                <span
                  className="font-mono font-normal"
                  style={{
                    fontSize: 16,
                    color: answer.isCorrect
                      ? "var(--color-semantic-success, #4ade80)"
                      : "var(--color-semantic-error, #f87171)",
                  }}
                >
                  {answer.selectedLabel}
                </span>
              </div>
            </div>
          ))}

          {/* Final question */}
          {finalAnswer && (
            <div className="rounded-game-lg border border-white/80 bg-[rgba(255,255,255,0.1)] p-4 backdrop-blur-sm">
              <div className="flex items-start gap-2 border-b border-white/80 pb-3">
                <span className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center select-none">
                  <span className="pointer-events-none absolute left-0 top-0 h-3.5 w-3.5 border-l-[2px] border-t-[2px] border-[#44DFD7]" />
                  <span className="pointer-events-none absolute right-0 top-0 h-3.5 w-3.5 border-r-[2px] border-t-[2px] border-[#44DFD7]" />
                  <span className="pointer-events-none absolute bottom-0 left-0 h-3.5 w-3.5 border-b-[2px] border-l-[2px] border-[#44DFD7]" />
                  <span className="pointer-events-none absolute bottom-0 right-0 h-3.5 w-3.5 border-b-[2px] border-r-[2px] border-[#44DFD7]" />
                  <span
                    className="font-mono font-normal"
                    style={{ fontSize: 18, color: "#44DFD7", lineHeight: 1 }}
                    aria-hidden="true"
                  >
                    →
                  </span>
                </span>
                <p
                  className="font-mono font-normal tracking-wide"
                  style={{ fontSize: 18, color: "#44DFD7", lineHeight: 1.25 }}
                >
                  {finalAnswer.questionText}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-3">
                <span
                  className="shrink-0 select-none font-mono font-normal"
                  style={{ fontSize: 16, color: "#44DFD7" }}
                >
                  [✓]
                </span>
                <span
                  className="font-mono font-normal"
                  style={{ fontSize: 16, color: "#44DFD7" }}
                >
                  {finalAnswer.selectedLabel}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: link blocks */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          {linkBlocks.map((block) => {
            const blockImages = parseLinkImages(block.images);
            return (
              <div
                key={block.blockIndex}
                className="rounded-game-lg border border-white/80 bg-[rgba(255,255,255,0.1)] p-4 backdrop-blur-sm"
              >
                {block.text && (
                  <p
                    className="mb-3 font-mono font-normal tracking-wide"
                    style={{ fontSize: 16, color: "#44DFD7", lineHeight: 1.25 }}
                  >
                    {block.text}
                  </p>
                )}
                <div className="flex flex-wrap items-start gap-3">
                  {blockImages.map((img) => (
                    <div key={img.key}>
                      <Image
                        src={img.url}
                        alt=""
                        width={150}
                        height={150}
                        className="object-contain"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ending block */}
      <div className="rounded-game-lg border border-white/80 bg-[rgba(255,255,255,0.1)] p-6 backdrop-blur-sm">
        <div className="border-b border-white/80 pb-3">
          <p
            className="font-mono font-normal tracking-wide"
            style={{ fontSize: 20, color: "#44DFD7", lineHeight: 1.25 }}
          >
            {finalContent.title}
          </p>
        </div>
        <p
          className="pt-3 font-mono font-normal leading-relaxed text-white whitespace-pre-wrap"
          style={{ fontSize: 16 }}
        >
          {finalContent.bodyText}
        </p>
      </div>

      {/* Replay button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => {
            void onReplay();
          }}
          disabled={isRestarting}
          aria-busy={isRestarting}
          className="inline-flex items-center gap-2 rounded-game-lg bg-accent px-12 py-3 font-mono text-[20px] font-bold uppercase tracking-widest text-black transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRestarting && (
            <span
              className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
          )}
          {isRestarting ? "Перезапуск..." : "Переиграть"}
        </button>
      </div>
    </div>
  );
}
