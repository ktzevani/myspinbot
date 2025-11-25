import wsServer from "../../infra/websocket.js";
import jobQueue from "../../core/job-queue.js";

function configureServer() {
  try {
    wsServer.registerJobMessageHandler(async (jobId) => {
      return jobQueue.getJobState(jobId);
    });
  } catch (err) {
    // KTZ: log error
    return false;
  }
  return true;
}

const serverConfigured = configureServer();

export async function getConnection(req, reply) {
  if (!serverConfigured) {
    reply.send({ error: "Failed to configure websockets server." });
    return;
  }
  return wsServer.endpoint(req, reply);
}
