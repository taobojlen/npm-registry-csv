import fs from "fs";
import axios from "axios";
import prettyBytes from "pretty-bytes";
import {
  ALL_DOCS_DEST,
} from "./constants.js";

export const getCurrentRevision = async () => {
  const endpoint =
    "https://replicate.npmjs.com/_changes?descending=true&limit=1";
  try {
    const response = await axios.get(endpoint).then((r) => r.data);
    return response["last_seq"]
  } catch (e) {
    throw e;
  }
};

export const getAllDocs = async () => {
  const endpoint = "https://replicate.npmjs.com/_all_docs?include_docs=true";
  let downloadedSize = 0;

  return new Promise((resolve, reject) => {
    axios({
      url: endpoint,
      method: "GET",
      responseType: "stream",
    })
      .then(({ data }) => {
        const fileWriter = fs.createWriteStream(ALL_DOCS_DEST);
        data.pipe(fileWriter);
        data.on("data", (chunk) => {
          downloadedSize += chunk.length;
          if (downloadedSize % 100000000 === 0) {
            console.log(prettyBytes(downloadedSize))
          }
        });
        data.on("end", () => {
          fileWriter.end();
          resolve();
        });
      })
      .catch((e) => {
        reject(e);
      });
  });
};
