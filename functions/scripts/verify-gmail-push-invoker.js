"use strict";

var GoogleAuth = require("google-auth-library").GoogleAuth;

var PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "timeless-lead-studio";
var REGION = process.env.LEAD_STUDIO_REGION || "europe-west1";
var FUNCTION_NAME = process.env.LEAD_STUDIO_GMAIL_PUSH_FUNCTION || "leadStudioGmailPushV5";
var EXPECTED_SERVICE_ACCOUNT = process.env.LEAD_STUDIO_WRITER_SERVICE_ACCOUNT ||
  "lead-studio-writer@timeless-lead-studio.iam.gserviceaccount.com";

function resourceBaseName(value) {
  return String(value || "").split("/").pop();
}

function hasInvoker(policy, member) {
  return (policy.bindings || []).some(function (binding) {
    return binding.role === "roles/run.invoker" &&
      (binding.members || []).includes(member);
  });
}

async function main() {
  var auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  var client = await auth.getClient();
  var functionResource = `projects/${PROJECT_ID}/locations/${REGION}/functions/${FUNCTION_NAME}`;
  var functionResponse = await client.request({
    url: `https://cloudfunctions.googleapis.com/v2/${functionResource}`,
    timeout: 30000,
    retry: false
  });
  var revision = functionResponse.data.serviceConfig && functionResponse.data.serviceConfig.revision;
  var serviceName = resourceBaseName(revision).replace(/-\d{5}-[a-z]+$/, "");
  if (!serviceName) throw new Error("The Gmail push Cloud Run service could not be resolved.");

  var triggersResponse = await client.request({
    url: `https://eventarc.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/triggers`,
    timeout: 30000,
    retry: false
  });
  var trigger = (triggersResponse.data.triggers || []).find(function (candidate) {
    return candidate.destination && candidate.destination.cloudFunction === functionResource;
  });
  if (!trigger) throw new Error(`No Eventarc trigger targets ${FUNCTION_NAME}.`);
  if (trigger.serviceAccount !== EXPECTED_SERVICE_ACCOUNT) {
    throw new Error("The Gmail push Eventarc trigger uses an unexpected service account.");
  }

  var policyResponse = await client.request({
    url: `https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/services/${serviceName}:getIamPolicy`,
    timeout: 30000,
    retry: false
  });
  var member = `serviceAccount:${EXPECTED_SERVICE_ACCOUNT}`;
  if (!hasInvoker(policyResponse.data, member)) {
    throw new Error(`${member} lacks roles/run.invoker on ${serviceName}.`);
  }

  console.log(JSON.stringify({
    projectId: PROJECT_ID,
    region: REGION,
    functionName: FUNCTION_NAME,
    revision: resourceBaseName(revision),
    trigger: resourceBaseName(trigger.name),
    service: serviceName,
    invokerVerified: true
  }, null, 2));
}

main().catch(function (error) {
  console.error(`Gmail push invoker verification failed: ${error.message}`);
  process.exitCode = 1;
});
