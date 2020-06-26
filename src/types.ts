export interface Package {
  name: string;
}

export interface Version {
  version: string;
  timestamp: Date;
  repository?: string;
  fileCount?: number;
  unpackedSize?: number;
}

export interface User {
  username: string;
}

export type DependencyType = "normal" | "dev" | "peer";

export interface Dependency {
  package: string;
  range: string;
  type: DependencyType;
}
