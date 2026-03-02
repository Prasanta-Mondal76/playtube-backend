// import dotenv from "dotenv";
// dotenv.config({path: "./env"})

import connectDB from "./db/index.js"
import app from "./app.js"

connectDB()
  .then(()=>{
    const port = process.env.PORT || 5000;
    app.listen(port, ()=>{
      console.log(` Server 🖥 is running on prot : ${port}`);
      
    })
  })
  .catch((err) => {
    console.log("MongoDB Connection Faild ⚠️!!!", err);
  })


/*
// Approach One
import mongoose from "mongoose";
import { DB_NAME } from "./constants.js";
import express from "express"
import dotenv from "dotenv";
dotenv.config({path: "./env"})

const app = express()
; (async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)

    app.on("error", (e) => {
      console.log("Error => "+e);
      throw e;
    })

    app.listen(port, ()=>{
      console.log(`App listine on port ${port}`)
    })
    
  } catch (error) {
    console.error("Error => " + error)
    throw error
  }
})()
  */