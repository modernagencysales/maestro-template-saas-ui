export const intakeQuestions = [
  {
    id: "ideaSummary",
    eyebrow: "Start simple",
    prompt: "What is the app idea?",
    help: "Describe it like you would to a smart friend. Two or three sentences is enough.",
    placeholder: "An app that helps…",
  },
  {
    id: "customer",
    eyebrow: "The customer",
    prompt: "Who is this specifically for?",
    help: "Name the narrowest group that feels the problem most. “Small businesses” is too broad.",
    placeholder: "Independent dental practices with 2–10 locations…",
  },
  {
    id: "problem",
    eyebrow: "The problem",
    prompt: "What painful thing happens today?",
    help: "Describe the moment, cost, delay, frustration, or risk—not the feature you want to build.",
    placeholder: "When a patient cancels at short notice…",
  },
  {
    id: "currentAlternative",
    eyebrow: "Existing behavior",
    prompt: "How do people handle this now?",
    help: "Spreadsheets, phone calls, another product, an employee, or simply living with it all count.",
    placeholder: "Right now they…",
  },
  {
    id: "solution",
    eyebrow: "The first version",
    prompt: "What would your app do for them?",
    help: "Focus on the valuable outcome. You do not need to know the technology yet.",
    placeholder: "It would help them…",
  },
  {
    id: "differentiation",
    eyebrow: "Why this one",
    prompt: "Why would they choose this instead?",
    help: "Think faster, easier, cheaper, more trusted, more specific, or possible for the first time.",
    placeholder: "Unlike the current options…",
  },
  {
    id: "distributionEvidence",
    eyebrow: "Finding customers",
    prompt: "How could you reach the first ten customers?",
    help: "Use a channel you can actually access: a community, audience, partnership, direct outreach, or existing customers.",
    placeholder: "I can reach them through…",
  },
  {
    id: "founderContext",
    eyebrow: "Your advantage",
    prompt: "Why are you a good person to build this?",
    help: "Include relevant experience, access to customers, insight, credibility, or a reason you care enough to persist.",
    placeholder: "I know this problem because…",
  },
] as const;

export type IntakeQuestionId = (typeof intakeQuestions)[number]["id"];
export type IntakeAnswers = Partial<Record<IntakeQuestionId, string>>;

export type IntakeState = {
  readonly step: number;
  readonly answers: IntakeAnswers;
  readonly error?: string;
  readonly announcement?: string;
  readonly status: "answering" | "complete";
};

export type IntakeView =
  | { readonly _tag: "complete"; readonly answers: IntakeAnswers }
  | {
      readonly _tag: "question";
      readonly question: (typeof intakeQuestions)[number];
      readonly value: string;
      readonly progress: number;
      readonly progressLabel: string;
      readonly error?: string;
      readonly announcement: string;
      readonly canGoBack: boolean;
    };

export const createIntakeState = (): IntakeState => ({
  step: 0,
  answers: {},
  status: "answering",
});

export const answerCurrentQuestion = (
  state: IntakeState,
  rawValue: string,
): IntakeState => {
  const value = rawValue.trim();
  if (!value) {
    return {
      ...state,
      error: "Write a short answer so the evaluation has evidence to use.",
    };
  }
  const question = intakeQuestions[state.step];
  if (!question) return state;
  const answers = { ...state.answers, [question.id]: value };
  const nextStep = state.step + 1;
  return {
    step: nextStep,
    answers,
    status: nextStep >= intakeQuestions.length ? "complete" : "answering",
    announcement: `Question ${String(state.step + 1)} of ${String(intakeQuestions.length)} saved`,
  };
};

export const goBack = (state: IntakeState): IntakeState => {
  const { error: _error, ...rest } = state;
  return {
    ...rest,
    step: Math.max(0, state.step - 1),
    status: "answering",
    announcement: "",
  };
};

export const presentIntake = (state: IntakeState): IntakeView => {
  if (state.status === "complete") {
    return { _tag: "complete", answers: state.answers };
  }
  const question = intakeQuestions[state.step] ?? intakeQuestions[0];
  return {
    _tag: "question",
    question,
    value: state.answers[question.id] ?? "",
    progress: ((state.step + 1) / intakeQuestions.length) * 100,
    progressLabel: `Question ${String(state.step + 1)} of ${String(intakeQuestions.length)}`,
    ...(state.error ? { error: state.error } : {}),
    announcement: state.announcement ?? "",
    canGoBack: state.step > 0,
  };
};
