import neo4j, { Driver } from "neo4j-driver";
import { Package, Version } from "./types";
import { chain, zip } from "lodash";
import semver from "semver";

let driver: Driver;

export const setupDatabase = async () => {
  const indexQueries = [
    "CREATE CONSTRAINT ON (p:Package) ASSERT p.name IS UNIQUE",
    "CREATE CONSTRAINT ON (u:User) ASSERT u.username IS UNIQUE",
    "CREATE INDEX ON :Version(version)",
    "CREATE INDEX ON :Version(timestamp)",
  ];
  driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "donne"));
  const session = driver.session();
  return session
    .writeTransaction(async (txc) => {
      indexQueries.forEach(async (query) => {
        await txc.run(query);
      });
    })
    .then(() => session.close());
};

export const savePackage = async (pack: Package) => {
  const query = `
  MERGE (p:Package {name: $name})
  WITH p
  UNWIND $versions as version
  CREATE (v:Version {
    version: version.version,
    timestamp: version.timestamp,
    repository: version.repository,
    fileCount: version.fileCount,
    unpackedSize: version.unpackedSize,
    tag: version.tag
  })
  CREATE (p)<-[:VERSION_OF]-(v)

  WITH version, v
  UNWIND version.maintainers AS maintainer
  MERGE (u:User {username: maintainer})
  CREATE (u)-[:MAINTAINS]->(v)

  WITH version, v
  UNWIND version.dependencies AS dependency
  MERGE (p:Package {name: dependency.package})
  MERGE (vr:VersionRequirement {range: dependency.range})
  MERGE (vr)-[:REQUIREMENT_OF {type: dependency.type}]->(p)
  MERGE (v)-[:DEPENDS_ON]->(vr)
  `;

  const session = driver.session();
  return session
    .writeTransaction(async (txc) => {
      await txc.run(query, pack);
      await saveNextVersionRelationships(txc, pack.name, pack.versions);
    })
    .then(() => session.close())
    .catch((err) => console.error(err));
};

const saveNextVersionRelationships = async (
  session: any,
  name: string,
  versions: Version[]
) => {
  const timestampByVersion = versions.reduce((acc, v) => {
    const version = v.version;
    const timestamp = v.timestamp;
    acc[version] = timestamp;
    return acc;
  }, {});
  const sortedVersions = chain(versions)
    .map((v) => semver.parse(v.version))
    .filter((v) => !!v)
    .uniq()
    .sort(semver.compare)
    .map((v) => v.version)
    .value();

  const intervals = zip(sortedVersions, sortedVersions.slice(1))
    .map(([prev, next]) => {
      if (!prev || !next) {
        return;
      }
      const timestampPrev = Date.parse(timestampByVersion[prev]);
      const timestampNext = Date.parse(timestampByVersion[next]);
      const interval = timestampNext - timestampPrev;
      if (!!interval && !isNaN(interval)) {
        const seconds = Math.trunc(interval / 1000);
        return `PT${seconds}S`;
      } else {
        return "PT0S";
      }
    })
    .filter((i) => !!i);
  if (sortedVersions.length !== intervals.length + 1) {
    console.log(sortedVersions);
    console.log(intervals);
    throw new Error("List lengths don't match");
  }

  const query = `
  MATCH (p:Package {name: $name})
  UNWIND RANGE(1, size($versions)-1) AS i
  WITH $versions[i-1] AS versionPrev, $versions[i] AS versionNext, $intervals[i] AS interval
  MATCH (prev:Version {version: versionPrev})<-[:VERSION_OF]-(p)
  MATCH (next:Version {version: versionNext})<-[:VERSION_OF]-(p)
  CREATE (prev)-[:NEXT_VERSION {interval: duration(interval)}]->(next)
  `;
  return session.run(query, { name, versions: sortedVersions, intervals });
};

export const processVersionRequirements = (vrHandler) => {
  const session = driver.session();
  session.run("MATCH (vr:VersionRequirement) RETURN vr").subscribe({
    onNext: (record) => {
      console.log(record);
      vrHandler(record);
    },
    onCompleted: () => {
      session.close();
    },
    onError: (error) => {
      console.error(error);
    },
  });
};
