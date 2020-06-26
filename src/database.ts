import neo4j from "neo4j-driver";
import { Version } from "./types";
import { normalizeRepo } from "./util";

let driver: neo4j.Driver;

export const setupDatabase = async () => {
  const indexQueries = [
    "CREATE CONSTRAINT ON (p:Package) ASSERT p.name IS UNIQUE",
    "CREATE CONSTRAINT ON (u:User) ASSERT u.username IS UNIQUE",
    "CREATE INDEX ON :Package(name)",
    "CREATE INDEX ON :User(username)",
    "CREATE INDEX ON :Version(version)",
    "CREATE INDEX ON :Version(timestamp)",
  ];
  driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "donne"));
  const session = driver.session();
  const promises = indexQueries.map((query) => {
    return session.run(query);
  });

  return Promise.all(promises);
};

export const savePackage = async (name: string) => {
  const session = driver.session();
  return session.run("CREATE (:Package {username: $name})", {
    name: name.trim(),
  });
};

export const saveVersion = async (
  name: string,
  version: Version
) => {
  const query = `
  MERGE (p:Package {name: $name})
  CREATE (v:Version {version: $version, timestamp: $timestamp, repository: $repository, fileCount: $fileCount, unpackedSize: $unpackedSize})
  CREATE (p)<-[:VERSION_OF]-(v)
  `;
  const session = driver.session();
  return session.run(query, {name, ...version})
};
