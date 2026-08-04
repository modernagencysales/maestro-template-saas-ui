module.exports = {
  default: {
    requireModule: ["tsx/cjs"],
    require: [
      "tooling/acceptance/fixtures/messages/passing.support.ts",
      "tooling/acceptance/fixtures/messages/passing.steps.ts",
    ],
    retry: 0,
    parallel: 0,
  },
};
