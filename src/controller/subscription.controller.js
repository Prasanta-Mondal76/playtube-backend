import { ApiError, ApiResponse, asyncHandler } from "../utils/index.js"
import { Subscription } from "../models/subscription.model.js"
import mongoose, { isValidObjectId } from "mongoose"
import { User } from "../models/user.model.js"

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params

  if (!isValidObjectId(channelId)) throw new ApiError(400, "Invalid channel ID.")
  if (!req.user?._id) throw new ApiError(401, "Unauthorized.")
  if (req.user._id.equals(channelId)) throw new ApiError(400, "You cannot subscribe to yourself.")

  const channelExists = await User.exists({ _id: channelId })
  if (!channelExists) throw new ApiError(404, "Channel not found")

  const session = await mongoose.startSession()

  try {
    session.startTransaction()

    const deletedSubscription = await Subscription.findOneAndDelete({
      subscriber: req.user._id,
      channel: channelId
    }, { session })

    if (!deletedSubscription) {
      await Subscription.create(
        [
          {
            subscriber: req.user._id,
            channel: channelId
          }
        ],
        { session }
      )
      // Update channels total subscriber count
      await User.findByIdAndUpdate(
        channelId,
        {
          $inc: {
            totalSubscribers: 1
          }
        },
        { session }
      )
      // Update users total subscribed count
      await User.findByIdAndUpdate(
        req.user._id,
        {
          $inc: {
            totalSubscribedChannels: 1
          }
        },
        { session }
      )

      await session.commitTransaction()
      return res.status(201).json(
        new ApiResponse(201, { subscribed: true }, "Subscribed successfully.")
      )
    }

    await User.findByIdAndUpdate(
      channelId,
      {
        $inc: {
          totalSubscribers: -1
        }
      },
      { session }
    )
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $inc: {
          totalSubscribedChannels: -1
        }
      },
      { session }
    )
    await session.commitTransaction()
    return res.status(200).json(
      new ApiResponse(200, { subscribed: false }, "Unsubscribed successfully.")
    )
  } catch (error) {
    await session.abortTransaction()

    // E11000 duplicate key error catching
    if (error.code === 11000) throw new ApiError(409, "Subscription already exists.")

    throw error
  }
  finally {
    await session.endSession()
  }

})

const getSubscriptionStats = asyncHandler(async (req, res) => {
  const { channelId } = req.params

  if (!isValidObjectId(channelId)) throw new ApiError(400, "Invalid channel ID.")
  if (!req.user?._id) {
    return res.status(200).json(new ApiResponse(
      200,
      {
        subscribed: false
      },
      "Guest User."
    ))
  }

  const subscribed = await Subscription.exists({
    subscriber: req.user._id,
    channel: channelId
  })

  return res.status(200).json(new ApiResponse(
    200,
    {
      subscribed: !!subscribed
    },
    "Subscription status fetched successfully."
  ))
})

// GET SUBSCRIBERS OF A CHANNEL (cursor paginated)
const getUserSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) throw new ApiError(400, "Invalid channel ID.");
  if (!req.user?._id) throw new ApiError(401, "Unauthorized.");

  const limit = Math.min(Number(req.query.limit) || 20, 100); // cap at 100
  const cursor = req.query.cursor; // _id of last item from previous page

  const filter = { channel: channelId };

  // If cursor provided, only fetch documents AFTER it
  if (cursor) {
    if (!isValidObjectId(cursor)) throw new ApiError(400, "Invalid cursor.");
    filter._id = { $gt: new mongoose.Types.ObjectId(cursor) };
  }

  const subscribers = await Subscription.find(filter)
    .sort({ _id: 1 })           // must sort by the cursor field
    .limit(limit + 1)           // fetch one extra to check if next page exists
    .populate("subscriber", "username fullName avatar");

  // If we got limit+1 results, there's a next page
  const hasNextPage = subscribers.length > limit;
  if (hasNextPage) subscribers.pop(); // remove the extra doc before sending

  // The last doc's _id becomes the cursor for the next request
  const nextCursor = hasNextPage
    ? subscribers[subscribers.length - 1]._id
    : null;

  return res.status(200).json(new ApiResponse(200, {
    subscribers,
    pagination: {
      nextCursor,   // client sends this as ?cursor= in next request
      hasNextPage,
      count: subscribers.length,
    }
  }, "Subscribers fetched."));
});


// GET ALL SUBSCRIPTIONS OF A USER (simple, no pagination needed)
const getUserSubscriptions = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) throw new ApiError(400, "Invalid user ID.");
  if (!req.user?._id) throw new ApiError(401, "Unauthorized.");

  const subscriptions = await Subscription.find({ subscriber: userId })
    .sort({ createdAt: -1 })
    .populate("channel", "username fullName avatar");

  return res.status(200).json(new ApiResponse(200, {
    subscriptions,
    count: subscriptions.length,
  }, "Subscriptions fetched."));
});

export {
  toggleSubscription,
  getSubscriptionStats,
  getUserSubscribers,
  getUserSubscriptions
}