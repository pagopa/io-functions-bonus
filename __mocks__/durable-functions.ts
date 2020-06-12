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

export const mockStartNew = jest.fn(() => Promise.resolve());
export const mockGetStatus = jest
  .fn()
  .mockImplementation(async () => mockStatusCompleted);

export const getClient = jest.fn(() => ({
  getStatus: mockGetStatus,
  startNew: mockStartNew
}));

export const orchestrator = jest.fn();

export const RetryOptions = jest.fn(() => ({}));

export const context = ({
  log: {
    error: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
    warn: jest.fn()
  }
} as any) as Context;
