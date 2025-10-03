/**
 * Worker pool for concurrent processing
 */

export class WorkerPool {
  constructor(concurrency = 3) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  /**
   * Add a task to the pool
   */
  async execute(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  /**
   * Process tasks from the queue
   */
  async process() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { task, resolve, reject } = this.queue.shift();

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.process(); // Process next task
    }
  }

  /**
   * Execute multiple tasks concurrently
   */
  async executeAll(tasks, progressCallback = null) {
    const results = [];
    const errors = [];
    let completed = 0;

    const promises = tasks.map((task, index) =>
      this.execute(task).then(
        (result) => {
          results[index] = result;
          completed++;
          if (progressCallback) {
            progressCallback(completed, tasks.length, null);
          }
        },
        (error) => {
          errors[index] = error;
          completed++;
          if (progressCallback) {
            progressCallback(completed, tasks.length, error);
          }
        }
      )
    );

    await Promise.allSettled(promises);

    return {
      results: results.filter(r => r !== undefined),
      errors: errors.filter(e => e !== undefined),
      totalTasks: tasks.length,
      successCount: results.filter(r => r !== undefined).length,
      errorCount: errors.filter(e => e !== undefined).length
    };
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      concurrency: this.concurrency
    };
  }
}