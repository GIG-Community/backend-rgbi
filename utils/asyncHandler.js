/**
 * Async handler to wrap async controller functions
 * This eliminates the need for try-catch blocks in controllers
 * @param {Function} fn - The async controller function to wrap
 * @returns {Function} - Express middleware function with error handling
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;
