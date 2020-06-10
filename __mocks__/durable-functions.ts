// tslint:disable: no-any
import * as df from "durable-functions";
import { Context } from "@azure/functions";

export const mockStartNew = jest.fn();
export const mockGetStatus = jest.fn();

export const mockStatusRunning = {
  runtimeStatus: df.OrchestrationRuntimeStatus.Running
};
export const mockStatusCompleted = {
  runtimeStatus: df.OrchestrationRuntimeStatus.Completed
};

export const OrchestrationRuntimeStatus = df.OrchestrationRuntimeStatus;

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
