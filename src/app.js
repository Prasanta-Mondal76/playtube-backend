import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser";

const app = express();
// CORS error handel. 'use' is middleware, used for checking connection or configuration purpose
app.use(cors({
  origin: process.env.CORS_ORIGINE,
  credentials: true,
}))
// JSON request handel
app.use(express.json({
  limit : "20kb", 
}))
// Url access handel
app.use(express.urlencoded({extended: true, limit: "20kb"}))
//For store odf or images or files
app.use(express.static("public"))
// For store and access cookie in users browser 
app.use(cookieParser())



// Router import
import userRoute from "./routes/user.routes.js"
import videoRouter from "./routes/video.routes.js"

// Router declaration for user route
app.use("/api/v1/users", userRoute);

// Router declaration for video route
app.use("/api/v1/videos", videoRouter);



export default app;