const getErrorMessage = (error, fallback = "Something went wrong") => {
  if (!error) return fallback;

  if (typeof error === "string") return error;

  return (
    error.response?.data?.error ||
    error.response?.data?.message ||
    error.message ||
    fallback
  );
};

const errorHandler = {
  getMessage: getErrorMessage,

  createServiceError(error, fallbackMessage = "Request failed") {
    const message = getErrorMessage(error, fallbackMessage);
    return {
      success: false,
      error: message,
      status: error?.response?.status || 500,
      raw: error,
    };
  },

  log(error, context = "Service") {
    const message = getErrorMessage(error);
    console.error(`[${context}] ${message}`, error);
  },
};

export default errorHandler;
