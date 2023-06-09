import fs from "fs";
import axios from "axios";
import prettyBytes from "pretty-bytes";
import { ALL_DOCS_DEST } from "./constants";

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
            console.log(prettyBytes(downloadedSize));
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
