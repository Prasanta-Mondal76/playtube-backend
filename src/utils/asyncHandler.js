//Using promicess ( .then, .catch )
const asyncHandler = (fn) =>{
  ( req, res, next) =>{
    Promise.resolve(fn( req, res, next)).catch((error) => next(error))
  }
}





// // Using try - catch
// const asyncHandler = (fn) => async ( req, res, next) => {
//   try {
//     await fn( req, res, next)
//   } catch (err) {
//     res.status(err.code || error || 500).json({
//       success: false,
//       message: err.message
//     })
//   } 
// }

export {asyncHandler};