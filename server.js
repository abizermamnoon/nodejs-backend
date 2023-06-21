const express = require("express");
const cors = require("cors");
const zlib = require('zlib')
const fs = require("fs");
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

app.post("/upload", (req, res) => {
  if (!req.files) {
    return res.status(500).send({ msg: "file is not found" })
}

const myFile = req.files.file;

uploadedFileName = myFile.name;


// Use the mv() method to place the file somewhere on your server
myFile.mv(`./public/${myFile.name}`, function (err) {
    if (err) {
        console.log(err)
        return res.status(500).send({ msg: "fuck eroor" });
    }
    return res.send({ file: myFile.name, path: `/${myFile.name}`, ty: myFile.type });
});
})
console.log("Uploaded file name:", uploadedFileName);

app.get("/", (req, res) => {
  console.log("GET request received. Uploaded file name:", uploadedFileName);
    if (!uploadedFileName) {
      return res.status(400).send({ msg: "No file has been uploaded" });
    }
    const filePath = `./public/${uploadedFileName}`; //${uploadedFileName}
    console.log("File path:", filePath);
    const fileStream = fs.createReadStream(filePath);
    const gzip = zlib.createGzip();
    // Set the appropriate response headers for the compressed content
    res.setHeader("Content-Encoding", "gzip");
    res.setHeader("Content-Type", "application/json");
    fileStream.pipe(gzip).pipe(res);

  fileStream.on("error", (error) => {
    console.error("Error reading file:", error);
    res.status(500).json({ error: "Error reading file" });
  });
});

// set port, listen for requests
app.listen(5000, () => {
  console.log('server is running at port 5000');
})