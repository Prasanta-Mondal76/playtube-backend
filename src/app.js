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
import userRouter from "./routes/user.routes.js"
import videoRouter from "./routes/video.routes.js"
import playlistRouter from "./routes/playlist.routes.js"
import commentRouter from "./routes/comment.routes.js"
import likeRouter from "./routes/like.routes.js"
import subscriptionRouter from "./routes/subscription.routes.js"
import dashboardRouter from "./routes/dashboard.routes.js"
import healthCheckRouter from "./routes/healthCheck.routes.js"
// Redis code run
import redis from "./db/redis.js"


// Router declaration for user route
app.use("/api/v1/users", userRouter);

// Router declaration for video route
app.use("/api/v1/videos", videoRouter);

// Router declaration for playlist route
app.use("/api/v1/playlists", playlistRouter);


// Router declaration for comments route
app.use("/api/v1/comments", commentRouter);

// Router declaration for like route
app.use("/api/v1/likes", likeRouter);

// Router declaration for subscription route
app.use("/api/v1/subscriptions", subscriptionRouter);

// Router declaration for dashboard route
app.use("/api/v1/dashboard", dashboardRouter);

// Router declaration for HealthCheck route
app.use("/api/v1/healthCheck", healthCheckRouter);




// Periodic update using node-corn 
import cron from "node-cron"
import { syncViewsToMongoDB, cleanupTempFiles } from "./utils/index.js"

// Views Sync
cron.schedule("*/90 * * * *", async () => {

  console.log("Running views sync cron...")

  await syncViewsToMongoDB()
})

// 
cron.schedule("*/30 * * * *", async () => {
  cleanupTempFiles()
  console.log("Temp Clean Up")
})

export default app;