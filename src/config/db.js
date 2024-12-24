require('dotenv').config();
const mongoose = require("mongoose");

const mongoURL = process.env.MONGODB_URL_LOCAL 

const connectDb = async () => {
  try {
    await mongoose.connect(mongoURL);
    console.log("connection successful to DB");
  } catch (error) {
    console.log(error)
    console.error("database connection fail");
    process.exit(0);
  }
};

module.exports = connectDb;