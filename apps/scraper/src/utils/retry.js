/**
 * Retry utility with exponential backoff
 */

export class RetryError extends Error {
  constructor(message, attempts, lastError) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

export class RetryUtility {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.backoffFactor = options.backoffFactor || 2;
    this.jitter = options.jitter !== false; // true by default
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  calculateDelay(attempt) {
    let delay = this.baseDelay * Math.pow(this.backoffFactor, attempt - 1);
    delay = Math.min(delay, this.maxDelay);

    if (this.jitter) {
      // Add random jitter (±25% of delay)
      const jitterAmount = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }

    return Math.max(delay, 0);
  }

  /**
   * Execute function with retry logic
   */
  async execute(fn, context = 'operation') {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        const result = await fn(attempt);

        if (attempt > 1) {
          console.log(`✅ ${context} succeeded on attempt ${attempt}`);
        }

        return result;
      } catch (error) {
        lastError = error;

        if (attempt <= this.maxRetries) {
          const delay = this.calculateDelay(attempt);
          console.log(`⚠️ ${context} failed (attempt ${attempt}/${this.maxRetries + 1}): ${error.message}`);
          console.log(`⏳ Retrying in ${Math.round(delay)}ms...`);

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new RetryError(
      `${context} failed after ${this.maxRetries + 1} attempts`,
      this.maxRetries + 1,
      lastError
    );
  }

  /**
   * Check if error is retryable
   */
  static isRetryableError(error) {
    // Don't retry on these HTTP status codes
    const nonRetryableStatuses = [400, 401, 403, 404, 422];

    if (error.response && nonRetryableStatuses.includes(error.response.status)) {
      return false;
    }

    // Don't retry on syntax errors or type errors
    if (error instanceof SyntaxError || error instanceof TypeError) {
      return false;
    }

    // Retry on network errors, timeouts, and 5xx errors
    return true;
  }

  /**
   * Create a retry wrapper for HTTP requests
   */
  static createHttpRetry(options = {}) {
    const retry = new RetryUtility(options);

    return async function(requestFn, context = 'HTTP request') {
      return retry.execute(async (attempt) => {
        try {
          return await requestFn();
        } catch (error) {
          if (!RetryUtility.isRetryableError(error)) {
            throw error;
          }
          throw error;
        }
      }, context);
    };
  }
}