module.exports = {
  default: {
    requireModule: ["tsx/cjs"],
    require: ["features/support/**/*.ts", "features/step_definitions/**/*.ts"],
    retry: 0,
    parallel: 0,
  },
};
