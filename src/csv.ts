import fsm from "fs-minipass";
import fs from "fs";
import stringify from "csv-stringify";

export let packageCsv: stringify.Stringifier,
  versionCsv: stringify.Stringifier,
  versionRequirementCsv: stringify.Stringifier,
  userCsv: stringify.Stringifier,
  versionOfCsv: stringify.Stringifier,
  dependsOnCsv: stringify.Stringifier,
  requirementOfCsv: stringify.Stringifier,
  resolvesToCsv: stringify.Stringifier,
  maintainsCsv: stringify.Stringifier,
  nextVersionCsv: stringify.Stringifier,
  dependsOnResolvesToCsv: stringify.Stringifier,
  closeAllCsvs: () => void;

const createStringifier = (writeStream, columns) => {
  const stringifier = stringify({ columns: columns, header: true });
  stringifier.pipe(writeStream);
  return stringifier;
};

const createWriteStream = (path) => {
  return new fsm.WriteStreamSync(path);
};

export const createCsvs = () => {
  // Nodes
  const packagePath = "./data/nodes/package.csv";
  const versionPath = "./data/nodes/version.csv";
  const versionRequirementPath = "./data/nodes/versionRequirement.csv";
  const userPath = "./data/nodes/user.csv";
  // Relationships
  const versionOfPath = "./data/relationships/versionOf.csv";
  const dependsOnPath = "./data/relationships/dependsOn.csv";
  const requirementOfPath = "./data/relationships/requirementOf.csv";
  const resolvesToPath = "./data/relationships/resolvesTo.csv";
  const maintainsPath = "./data/relationships/maintains.csv";
  const nextVersionPath = "./data/relationships/nextVersion.csv";
  const dependsOnResolvesToPath = "./data/relationships/dependsOnResolvesTo.csv";

  const paths = [
    packagePath,
    versionPath,
    versionRequirementPath,
    userPath,
    versionOfPath,
    dependsOnPath,
    requirementOfPath,
    resolvesToPath,
    maintainsPath,
    nextVersionPath,
    dependsOnResolvesToPath
  ];
  paths.forEach((path) => {
    if (fs.existsSync(path)) {
      throw new Error(`${path} already exists!`);
    }
  });

  // Create file writers (nodes)
  const packageWriter = createWriteStream(packagePath);
  const versionWriter = createWriteStream(versionPath);
  const versionRequirementWriter = createWriteStream(versionRequirementPath);
  const userWriter = createWriteStream(userPath);
  // Create file writers (relationships)
  const versionOfWriter = createWriteStream(versionOfPath);
  const dependsOnWriter = createWriteStream(dependsOnPath);
  const requirementOfWriter = createWriteStream(requirementOfPath);
  const resolvesToWriter = createWriteStream(resolvesToPath);
  const maintainsWriter = createWriteStream(maintainsPath);
  const nextVersionWriter = createWriteStream(nextVersionPath);
  const dependsOnResolvesToWriter = createWriteStream(dependsOnResolvesToPath);

  // Create stringifiers (nodes)
  packageCsv = createStringifier(packageWriter, ["name:ID(Package)"]);
  versionCsv = createStringifier(versionWriter, [
    "id:ID(Version)",
    "version",
    "timestamp:datetime",
    "repository",
    "file_count",
    "unpacked_size",
  ]);
  versionRequirementCsv = createStringifier(versionRequirementWriter, [
    "id:ID(VersionRequirement)",
    "requirement",
  ]);
  userCsv = createStringifier(userWriter, ["username:ID(User)"]);
  // Create stringifiers (relationships)
  versionOfCsv = createStringifier(versionOfWriter, [
    ":START_ID(Version)",
    ":END_ID(Package)",
  ]);
  dependsOnCsv = createStringifier(dependsOnWriter, [
    ":START_ID(Version)",
    "type",
    ":END_ID(VersionRequirement)",
  ]);
  requirementOfCsv = createStringifier(requirementOfWriter, [
    ":START_ID(VersionRequirement)",
    ":END_ID(Package)",
  ]);
  resolvesToCsv = createStringifier(resolvesToWriter, [
    ":START_ID(VersionRequirement)",
    ":END_ID(Version)",
  ]);
  maintainsCsv = createStringifier(maintainsWriter, [
    ":START_ID(User)",
    ":END_ID(Version)",
  ]);
  nextVersionCsv = createStringifier(nextVersionWriter, [
    ":START_ID(Version)",
    "interval",
    ":END_ID(Version)",
  ]);
  dependsOnResolvesToCsv = createStringifier(dependsOnResolvesToWriter, [
    ":START_ID(Version)",
    ":END_ID(Version)"
  ])

  closeAllCsvs = () => {
    const writers = [
      packageWriter,
      versionOfWriter,
      versionRequirementWriter,
      userWriter,
      versionOfWriter,
      dependsOnWriter,
      requirementOfWriter,
      resolvesToWriter,
      maintainsWriter,
      nextVersionWriter,
      dependsOnResolvesToWriter
    ];
    writers.forEach((w) => {
      w.end();
    });
  };
};
