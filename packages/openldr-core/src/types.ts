export interface SystemInfo {
  isSetup: boolean;
  machineName: string;
  macAddress: string;
  ipAddresses: string[];
  ipDescriptions: string[];
  hostEnvironment: string;
}

export interface EnvConfig {
  [key: string]: string;
}

export type RepositoryAction = "setup" | "start" | "stop" | "reset";

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly repositoryName: string,
    public readonly action: RepositoryAction,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

export class SetupError extends RepositoryError {
  constructor(message: string, repositoryName: string) {
    super(message, repositoryName, "setup");
    this.name = "SetupError";
  }
}

export interface MinioService {
  name: string;
  policies: string[];
  key: string;
}

export interface MinioPlugin {
  file: string;
  id: string;
  name: string;
}

export interface MinioBucket {
  id: string;
  name: string;
}

export interface MinioEvent {
  prefix: string;
  arn: string;
}

export interface KafkaNotification {
  id: string;
  topic: string;
}
