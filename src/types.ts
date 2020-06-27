export interface Package {
  name: string;
  versions: Version[];
}

export interface Version {
  version: string;
  timestamp: string;
  maintainers: User[];
  dependencies: Dependency[];
  repository?: string;
  fileCount?: number;
  unpackedSize?: number;
  tag?: string;
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

export interface NextVersion {
  name: string;
  previousVersion: string;
  nextVersion: string;
  intervalSeconds?: number;
}

export interface StringMap {
  [key: string]: string;
}
