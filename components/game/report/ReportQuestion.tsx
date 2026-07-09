"use client";

interface Question {
  id: string;
  questionText: string;
  options: string[];
}

interface Props {
  question: Question;
  questionNumber: number;
  selectedOption: number | null;
  onChange: (index: number) => void;
}

export function ReportQuestion({
  question,
  questionNumber,
  selectedOption,
  onChange,
}: Props): React.ReactElement {
  return (
    <div className="rounded-game-lg border border-white/80 bg-[rgba(255,255,255,0.1)] p-4 backdrop-blur-sm">
      {/* Question header */}
      <div className="mb-0 flex items-center gap-3 border-b border-white/80 pb-3">
        <span className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center select-none">
          <span className="pointer-events-none absolute left-0 top-0 h-3.5 w-3.5 border-l-[2px] border-t-[2px] border-[#44DFD7]" />
          <span className="pointer-events-none absolute right-0 top-0 h-3.5 w-3.5 border-r-[2px] border-t-[2px] border-[#44DFD7]" />
          <span className="pointer-events-none absolute bottom-0 left-0 h-3.5 w-3.5 border-b-[2px] border-l-[2px] border-[#44DFD7]" />
          <span className="pointer-events-none absolute bottom-0 right-0 h-3.5 w-3.5 border-b-[2px] border-r-[2px] border-[#44DFD7]" />
          <span
            className="font-mono font-normal"
            style={{ fontSize: 16, color: "#44DFD7", lineHeight: 1 }}
            aria-hidden="true"
          >
            {questionNumber}
          </span>
        </span>
        <p
          className="font-mono font-normal tracking-wide"
          style={{ fontSize: 20, color: "#44DFD7", lineHeight: 1.25 }}
        >
          {question.questionText}
        </p>
      </div>

      {/* Options grid */}
      <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-4">
        {question.options.map((option, index) => {
          const selected = selectedOption === index;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onChange(index)}
              className="flex items-center gap-2 rounded p-2 text-left font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              style={{ fontSize: 16, color: "#ffffff" }}
            >
              <span className="relative flex size-6 shrink-0 items-center justify-center select-none">
                <span className="pointer-events-none absolute left-0 top-0 bottom-0 border-l-[2px] border-[#44DFD7]" />
                <span className="pointer-events-none absolute right-0 top-0 bottom-0 border-r-[2px] border-[#44DFD7]" />
                <span className="pointer-events-none absolute left-0 top-0 h-0 w-[7px] border-t-[2px] border-[#44DFD7]" />
                <span className="pointer-events-none absolute right-0 top-0 h-0 w-[7px] border-t-[2px] border-[#44DFD7]" />
                <span className="pointer-events-none absolute bottom-0 left-0 h-0 w-[7px] border-b-[2px] border-[#44DFD7]" />
                <span className="pointer-events-none absolute bottom-0 right-0 h-0 w-[7px] border-b-[2px] border-[#44DFD7]" />
                {selected ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 7.5l3 3L12 3.5"
                      stroke="#44DFD7"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </span>
              <span style={{ letterSpacing: "1.15px" }}>{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
