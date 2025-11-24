"use strict";
module.exports = validate30;
module.exports.default = validate30;
var schema42 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"job-messaging.schema.json","title":"Job Messaging Schemas","type":"object","$defs":{"JobMessage":{"type":"object","title":"JobMessage","description":"Raw message pulled directly from Redis Streams (before normalization).","properties":{"xid":{"type":"string","description":"Redis Stream entry ID"},"stream":{"type":"string","description":"Stream name"},"jobId":{"type":"string","description":"Unique job ID"},"name":{"type":"string","description":"Job type identifier (train/generate/etc.)"},"created":{"type":["string","null"],"description":"Timestamp in ms (stringified)"},"input":{"type":["string","null"],"description":"Generic data input serialized to string"}},"required":["xid","stream","jobId","name"],"additionalProperties":false},"JobStatus":{"type":"string","title":"JobStatus","description":"Allowed job lifecycle states.","enum":["advertised","queued","running","completed","failed"]},"DataUpdate":{"type":"object","title":"DataUpdate","description":"Pub/Sub payload containing generic job updates.","properties":{"jobId":{"type":"string"},"data":{"type":"string"},"created":{"type":"string","format":"date-time"}},"required":["jobId","data","created"],"additionalProperties":false},"ProgressUpdate":{"type":"object","title":"ProgressUpdate","description":"Payload for job progress updates.","properties":{"jobId":{"type":"string"},"progress":{"type":"number","minimum":0,"maximum":1,"description":"Normalized progress value between 0 and 1 inclusive"},"created":{"type":"string","format":"date-time"}},"required":["jobId","progress","created"],"additionalProperties":false},"StatusUpdate":{"type":"object","title":"StatusUpdate","description":"Payload for job status updates.","properties":{"jobId":{"type":"string"},"status":{"$ref":"#/$defs/JobStatus"},"created":{"type":"string","format":"date-time"}},"required":["jobId","status","created"],"additionalProperties":false},"StateUpdate":{"type":"object","title":"StateUpdate","description":"Payload for job state updates.","properties":{"jobId":{"type":"string"},"status":{"$ref":"#/$defs/JobStatus"},"progress":{"type":"number","minimum":0,"maximum":1,"description":"Normalized progress value between 0 and 1 inclusive"}},"required":["jobId","status","progress"],"additionalProperties":false}}};

function validate30(data, valCxt){
"use strict"; /*# sourceURL="job-messaging.schema.json" */;
if(valCxt){
var instancePath = valCxt.instancePath;
var parentData = valCxt.parentData;
var parentDataProperty = valCxt.parentDataProperty;
var rootData = valCxt.rootData;
var dynamicAnchors = valCxt.dynamicAnchors;
}
else {
var instancePath = "";
var parentData = undefined;
var parentDataProperty = undefined;
var rootData = data;
var dynamicAnchors = {};
}
var vErrors = null;
var errors = 0;
var evaluated0 = validate30.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(!(data && typeof data == "object" && !Array.isArray(data))){
validate30.errors = [{instancePath:instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
validate30.errors = vErrors;
return errors === 0;
}
validate30.evaluated = {"dynamicProps":false,"dynamicItems":false};
