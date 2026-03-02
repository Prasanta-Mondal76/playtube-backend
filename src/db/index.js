import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";


const connectDB = async () =>{
  try {
    const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    
    console.log(`MongoDB Connected !! DB Host : ${connectionInstance.connection.host} `)
  } catch (error) {
    console.log("Database connection FAILD : "+error);
    process.exit(1); //process.exit() is a Node.js function that immediately stops the current Node process. When this line runs, Node terminates right away—no more code runs after it.

  }
}

export default connectDB;