const express = require("express");
const cors = require("cors");
const zlib = require('zlib')
const fs = require("fs");
const lineReader = require('line-reader');
const { Readable } = require('stream');

const fileUpload = require("express-fileupload");
const app = express();

app.use(express.static('public'))

app.use(cors());
app.use(fileUpload());

// parse requests of content-type - application/json
app.use(express.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
let uploadedFileName;
let uploadedFileType;
let streamedData = [];

app.post("/upload", (req, res) => {
  if (!req.files) {
    return res.status(500).send({ msg: "file is not found" });
  }

  const myFile = req.files.file;

  uploadedFileName = myFile.name;
  uploadedFileType = myFile.mimetype;

  myFile.mv(`./public/${myFile.name}`, function (err) {
    if (err) {
      console.log(err);
      return res.status(500).send({ msg: "error" });
    }
    const filePath = `./public/${myFile.name}`;

    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        console.log(err);
        return res.status(500).send({ msg: "error" });
      }
      streamedData = JSON.parse(data); // Parse the JSON data and add it to the streamedData array
      console.log("Length of Streamed Data:", streamedData.length);
      // Slice the first 10 rows and save it as '10_rows'
      const slicedData = streamedData.slice(0, 10);
      const slicedDataFilePath = `./public/10_rows.json`;
      fs.writeFileSync(slicedDataFilePath, JSON.stringify(slicedData));

      return res.send({ file: myFile.name, path: `/${myFile.name}`, ty: myFile.type });
    });
  });
});
console.log("Uploaded file name:", uploadedFileName);
console.log("Uploaded file type:", uploadedFileType);

app.get("/", (req, res) => {
    if (!uploadedFileName) {
      return res.status(400).send({ msg: "No file has been uploaded" });
    }
    const filePath = `./public/10_rows.json`; //${uploadedFileName}
    
    // Set the appropriate response headers for the compressed content
    res.setHeader("Content-Encoding", "gzip");
    if (uploadedFileType === "application/json") {
      res.setHeader("Content-Type", "application/json");
    } else if (uploadedFileType === "text/csv") {
      res.setHeader("Content-Type", "text/csv");
    }
    
    const fileStream = fs.createReadStream(filePath);
    const gzip = zlib.createGzip();
    fileStream.pipe(gzip).pipe(res);

  fileStream.on("error", (error) => {
    console.error("Error reading file:", error);
    res.status(500).json({ error: "Error reading file" });
  });
});

app.post('/sortData', (req, res) => {
  const { xAxisParam, yAxisParams, groupEnabled, type } = req.body;

  if (!yAxisParams || yAxisParams.length === 0) {
    return; // Exit early if yAxisParams is undefined or empty
  }

  let sortedData = {};
  let loading = true;

  if (type === "pie") {
    const groupedData = {};
    streamedData.forEach((entry, index) => {
      const groupKey = entry[yAxisParams];

      if (!groupedData[groupKey]) {
        groupedData[groupKey] = {};
        yAxisParams.forEach((yAxisParam) => {
          groupedData[groupKey][yAxisParam] = 0;
        });
      }

      yAxisParams.forEach((yAxisParam) => {
        groupedData[groupKey][yAxisParam] += 1;
      });
    });

    const sorted = Object.entries(groupedData).sort((a, b) => a[0] - b[0]);
    const xAxisData = sorted.map(([key]) => key);
    const yAxisData = sorted.map(([key, value]) => {
      const data = [];

      yAxisParams.forEach((yAxisParam, index) => {
        data.push(value[yAxisParam]);
      });

      return data;
      loading = false;
    });

    sortedData = { xAxisData, yAxisData };
  } else if (groupEnabled) {
    const groupedData = {};
    streamedData.forEach((entry) => {
      const groupKey = entry[xAxisParam];

      if (!groupedData[groupKey]) {
        groupedData[groupKey] = {};
        yAxisParams.forEach((yAxisParam) => {
          groupedData[groupKey][yAxisParam] = 0;
        });
      }

      yAxisParams.forEach((yAxisParam) => {
        groupedData[groupKey][yAxisParam] += entry[yAxisParam];
      });
    });

    const sorted = Object.entries(groupedData).sort((a, b) => a[0] - b[0]);
    const xAxisData = sorted.map(([key]) => key);
    const yAxisData = sorted.map(([key, value]) => {
      const data = [];

      yAxisParams.forEach((yAxisParam) => {
        data.push(value[yAxisParam]);
      });

      return data;
    });

    sortedData = { xAxisData, yAxisData };
    loading = false;
  } else {
    const sorted = streamedData
    //   .filter((entry, index) => index % 10 === 0)
      .sort((a, b) => {
        const valueA = String(a[xAxisParam]);
        const valueB = String(b[xAxisParam]);
        return valueA.localeCompare(valueB);
      });
    const xAxisData = sorted.map((entry) => entry[xAxisParam]);
    const yAxisData = sorted.map((entry) => {
      const data = new Array(yAxisParams.length);

      yAxisParams.forEach((yAxisParam, index) => {
        data[index] = entry[yAxisParam];
      });

      return data;
    });

    sortedData = { xAxisData, yAxisData };
    loading = false;
  }

  const compressedData = zlib.gzipSync(JSON.stringify(sortedData)); // Compress the data using zlib
  res.setHeader("Content-Encoding", "gzip"); // Set the response header for compressed content
  return res.send(compressedData);
  
});

// set port, listen for requests
app.listen(5000, () => {
  console.log('server is running at port 5000');
})