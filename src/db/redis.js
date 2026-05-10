import { createClient } from "redis"

const redisClient = createClient({
  url: process.env.REDIS_DB_URL
})

redisClient.on("error", (err) => {
  console.log("Redis Error:", err)
})

; (async () => {
  try {
    await redisClient.connect()
    console.log("Redis Connected")
  } catch (error) {
    console.log("Redis Connection Error:", error.message)
    process.exit(1)
  }
})()

export default redisClient