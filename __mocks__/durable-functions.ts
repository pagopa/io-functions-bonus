// tslint:disable: no-any
import { Context } from "@azure/functions";
import * as df from "durable-functions";

export const mockStatusRunning = {
  runtimeStatus: df.OrchestrationRuntimeStatus.Running
};
export const mockStatusCompleted = {
  runtimeStatus: df.OrchestrationRuntimeStatus.Completed
};

export const OrchestrationRuntimeStatus = df.OrchestrationRuntimeStatus;

export const mockStartNew = jest.fn((_, __, ___) => Promise.resolve());
export const mockGetStatus = jest
  .fn()
  .mockImplementation(async () => mockStatusCompleted);
export const mockTerminate = jest.fn(async (_, __) => {
  return;
});

export const getClient = jest.fn(() => ({
  getStatus: mockGetStatus,
  startNew: mockStartNew,
  terminate: mockTerminate
}));

export const orchestrator = jest.fn();

export const RetryOptions = jest.fn(() => ({}));

export const context = ({
  log: {
    // tslint:disable-next-line: no-console
    error: jest.fn().mockImplementation(console.log),
    // tslint:disable-next-line: no-console
    info: jest.fn().mockImplementation(console.log),
    // tslint:disable-next-line: no-console
    verbose: jest.fn().mockImplementation(console.log),
    // tslint:disable-next-line: no-console
    warn: jest.fn().mockImplementation(console.log)
  }
} as any) as Context;
