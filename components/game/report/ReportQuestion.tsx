'use client';

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
    <div className="rounded-game-lg border border-white/80 p-4">
      {/* Question header */}
      <div className="mb-0 flex items-start gap-2 border-b border-white/80 pb-3">
        <span
          className="shrink-0 select-none font-mono font-normal"
          style={{ fontSize: 20, color: '#44DFD7', lineHeight: 1.25 }}
          aria-hidden="true"
        >
          [{questionNumber}]
        </span>
        <p
          className="font-mono font-normal tracking-wide"
          style={{ fontSize: 20, color: '#44DFD7', lineHeight: 1.25 }}
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
              style={{ fontSize: 16, color: '#ffffff' }}
            >
              <span
                className="shrink-0 select-none whitespace-nowrap leading-none"
                style={{ color: selected ? '#44DFD7' : '#ffffff' }}
              >
                {selected ? '[✓]' : '[  ]'}
              </span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
