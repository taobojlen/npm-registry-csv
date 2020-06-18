import fs from "fs";
import axios from 'axios'
import ora from "ora"
import prettyBytes from "pretty-bytes"

const getCurrentRevision = async () => {
  const endpoint =
    "https://replicate.npmjs.com/_changes?descending=true&limit=1";
  const response = await axios.get(endpoint).then(r => r.data)
  return response["last_seq"];
};

const getAllDocs = async () => {
  const destination = "all_docs.json"
  const endpoint = "https://replicate.npmjs.com/_all_docs?include_docs=true";
  const spinnerText = "Downloading npm data..."
  let downloadedSize = 0
  const spinner = ora(spinnerText).start()

  const {data} = await axios({url: endpoint, method: "GET", responseType: "stream"})
  const fileWriter = fs.createWriteStream(destination)
  data.on("data", chunk => {
    downloadedSize += chunk.length
    spinner.text = `${spinnerText} (${prettyBytes(downloadedSize)})`
  })
  data.on("end", () => {
    fileWriter.end()
    spinner.stop()
  })
  data.pipe(fileWriter)
};

export const run = async () => {
  const currentRevision = await getCurrentRevision();
  console.log(`Current revision: ${currentRevision}`);
  await getAllDocs();
};
