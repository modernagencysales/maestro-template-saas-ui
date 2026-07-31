import { describe, expect, it } from "vitest";

import {
  answerCurrentQuestion,
  createIntakeState,
  goBack,
  intakeQuestions,
  presentIntake,
} from "./intake-state";

describe("guided idea intake", () => {
  it("starts with one plain-English question", () => {
    const view = presentIntake(createIntakeState());

    expect(view._tag).toBe("question");
    if (view._tag === "question") {
      expect(view.question.id).toBe("ideaSummary");
      expect(view.progressLabel).toBe(
        `Question 1 of ${intakeQuestions.length}`,
      );
    }
  });

  it("preserves an answer when moving back to edit", () => {
    const answered = answerCurrentQuestion(
      createIntakeState(),
      "A calmer way for dental practices to fill cancellations.",
    );
    const edited = goBack(answered);
    const view = presentIntake(edited);

    expect(view._tag).toBe("question");
    if (view._tag === "question") {
      expect(view.value).toContain("dental practices");
    }
  });

  it("does not advance on an empty answer", () => {
    const state = answerCurrentQuestion(createIntakeState(), "  ");
    const view = presentIntake(state);

    expect(view).toMatchObject({
      _tag: "question",
      error: "Write a short answer so the evaluation has evidence to use.",
    });
  });

  it("announces progress after a saved answer", () => {
    const state = answerCurrentQuestion(
      createIntakeState(),
      "A useful app idea",
    );
    expect(presentIntake(state)).toMatchObject({
      _tag: "question",
      announcement: "Question 1 of 8 saved",
    });
  });
});
