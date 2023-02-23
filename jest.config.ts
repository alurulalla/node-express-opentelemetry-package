import type { Config } from "@jest/types";

export default async (): Promise<Config.InitialOptions> => {
  return {
    collectCoverage: true,
    collectCoverageFrom: [
      "src/**",
      "!src/index.ts",
      "!src/models/*",
      "!src/enums/*",
      "!src/config/*",
    ],
    coverageDirectory: ".coverage",
    preset: "ts-jest",
    setupFiles: ["<rootDir>/tests/jest-config.ts"],
    testMatch: ["<rootDir>/tests/**/*.test.ts"],
    verbose: true,
    coverageThreshold: {
      global: {
        branches: 50,
        functions: 50,
        lines: 50,
        statements: 50,
      },
    },
  };
};
