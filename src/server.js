require("dotenv").config();
const express = require("express");
const app = express();

const connectDb = require("./config/db.js");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const multer = require("multer");

app.use(bodyParser.json());
app.use(cookieParser());

const PORT = process.env.PORT || 3005;

// Import the router files
const userRoutes = require("./routes/userRoutes.js");
const candidateRoutes = require("./routes/candidateRoutes.js");

// Use the routers
app.use("/user", userRoutes);
app.use("/candidate", candidateRoutes);

connectDb().then(() => {
  app.listen(PORT, () => {
    console.log(`server is running at port: ${PORT}`);
  });
});
