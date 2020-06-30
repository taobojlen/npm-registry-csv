export interface StringMap {
  [key: string]: string;
}

export interface Dependent {
  name: string;
  version: string;
}

export interface VersionRequirement {
  id: number;
  package: string;
  range: string;
  dependents: Dependent[];
}

export type DependencyType = "normal" | "peer" | "dev"
export interface Dependency {
  name: string;
  type: DependencyType;
}

export type Maintainer = string | {name: string, email: string}