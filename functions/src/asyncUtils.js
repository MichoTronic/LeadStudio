"use strict";

async function mapWithConcurrency(values, concurrency, worker) {
  values = Array.isArray(values) ? values : [];
  var output = new Array(values.length);
  var cursor = 0;
  var workerCount = Math.min(
    Math.max(1, Math.floor(Number(concurrency)) || 1),
    values.length || 1
  );
  async function runWorker() {
    while (cursor < values.length) {
      var index = cursor;
      cursor += 1;
      output[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return output;
}

module.exports = { mapWithConcurrency };
