import { describe, it, expect } from "bun:test";
import { Logger } from "./logger";

describe("Logger", () => {
  it("should create logger instance", () => {
    const logger = new Logger("info", "test");
    expect(logger).toBeDefined();
  });

  it("should have log methods", () => {
    const logger = new Logger("info", "test");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("should log messages without throwing errors", () => {
    const logger = new Logger("info", "test");
    expect(() => {
      logger.info("test message");
      logger.warn("test warning");
      logger.error("test error");
      logger.debug("test debug");
    }).not.toThrow();
  });
});
