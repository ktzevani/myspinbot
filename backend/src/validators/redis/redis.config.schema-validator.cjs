"use strict";
module.exports = validate30;
module.exports.default = validate30;
var schema42 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"redis.config.schema.json","title":"Redis Configuration","type":"object","description":"Configuration for Redis connection, stream names, pub/sub channels, and job management.","required":["url","streams","channels","jobs"],"properties":{"url":{"type":"string","description":"Redis connection string (e.g. 'redis://redis:6379').","pattern":"^redis://.+"},"streams":{"type":"object","description":"List of Redis streams used by the bridge.","required":["info","process"],"properties":{"info":{"type":"string","description":"Root name of stream for exchanging high level information (e.g. 'stream:info:data')."},"process":{"type":"string","description":"Root name of stream for exchanging job messages (e.g. 'stream:process:data')."},"plan":{"type":"string","description":"Root name of stream for exchanging planner messages (e.g. 'stream:plan:control')."}},"additionalProperties":false},"channels":{"type":"object","description":"List of pub/sub channels used by the bridge.","required":["progress","status","data"],"properties":{"progress":{"type":"string","description":"Channel onto which jobs publish their progress (e.g. 'channel:progress')."},"status":{"type":"string","description":"Channel onto which jobs publish their status (e.g. 'channel:status')."},"data":{"type":"string","description":"Channel onto which jobs publish intermediate generic data (e.g. 'channel:data')."}},"additionalProperties":false},"jobs":{"type":"object","description":"Configuration for jobs.","required":["ttl"],"properties":{"available":{"type":"object","description":"List of mappings of available jobs supported by the Redis bridge, to worker tasks.","required":["GET_CAPABILITIES","PROCESS_GRAPH"],"properties":{"GET_CAPABILITIES":{"type":"string","description":"Worker task mapped to this job."},"PROCESS_GRAPH":{"type":"string","description":"Worker task mapped to this job."}}},"ttl":{"type":"integer","minimum":1,"description":"Job keys TTL in Redis, in seconds (e.g. 43200 for 12 hours)."}},"additionalProperties":false}},"additionalProperties":false};
var pattern4 = new RegExp("^redis://.+", "u");

function validate30(data, valCxt){
"use strict"; /*# sourceURL="redis.config.schema.json" */;
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
if(errors === 0){
if(data && typeof data == "object" && !Array.isArray(data)){
var missing0;
if(((((data.url === undefined) && (missing0 = "url")) || ((data.streams === undefined) && (missing0 = "streams"))) || ((data.channels === undefined) && (missing0 = "channels"))) || ((data.jobs === undefined) && (missing0 = "jobs"))){
validate30.errors = [{instancePath:instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];
return false;
}
else {
var _errs1 = errors;
for(var key0 in data){
if(!((((key0 === "url") || (key0 === "streams")) || (key0 === "channels")) || (key0 === "jobs"))){
validate30.errors = [{instancePath:instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs1 === errors){
if(data.url !== undefined){
var data0 = data.url;
var _errs2 = errors;
if(errors === _errs2){
if(typeof data0 === "string"){
if(!pattern4.test(data0)){
validate30.errors = [{instancePath:instancePath+"/url",schemaPath:"#/properties/url/pattern",keyword:"pattern",params:{pattern: "^redis://.+"},message:"must match pattern \""+"^redis://.+"+"\""}];
return false;
}
}
else {
validate30.errors = [{instancePath:instancePath+"/url",schemaPath:"#/properties/url/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid0 = _errs2 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.streams !== undefined){
var data1 = data.streams;
var _errs4 = errors;
if(errors === _errs4){
if(data1 && typeof data1 == "object" && !Array.isArray(data1)){
var missing1;
if(((data1.info === undefined) && (missing1 = "info")) || ((data1.process === undefined) && (missing1 = "process"))){
validate30.errors = [{instancePath:instancePath+"/streams",schemaPath:"#/properties/streams/required",keyword:"required",params:{missingProperty: missing1},message:"must have required property '"+missing1+"'"}];
return false;
}
else {
var _errs6 = errors;
for(var key1 in data1){
if(!(((key1 === "info") || (key1 === "process")) || (key1 === "plan"))){
validate30.errors = [{instancePath:instancePath+"/streams",schemaPath:"#/properties/streams/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs6 === errors){
if(data1.info !== undefined){
var _errs7 = errors;
if(typeof data1.info !== "string"){
validate30.errors = [{instancePath:instancePath+"/streams/info",schemaPath:"#/properties/streams/properties/info/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid1 = _errs7 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data1.process !== undefined){
var _errs9 = errors;
if(typeof data1.process !== "string"){
validate30.errors = [{instancePath:instancePath+"/streams/process",schemaPath:"#/properties/streams/properties/process/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid1 = _errs9 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data1.plan !== undefined){
var _errs11 = errors;
if(typeof data1.plan !== "string"){
validate30.errors = [{instancePath:instancePath+"/streams/plan",schemaPath:"#/properties/streams/properties/plan/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid1 = _errs11 === errors;
}
else {
var valid1 = true;
}
}
}
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/streams",schemaPath:"#/properties/streams/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs4 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.channels !== undefined){
var data5 = data.channels;
var _errs13 = errors;
if(errors === _errs13){
if(data5 && typeof data5 == "object" && !Array.isArray(data5)){
var missing2;
if((((data5.progress === undefined) && (missing2 = "progress")) || ((data5.status === undefined) && (missing2 = "status"))) || ((data5.data === undefined) && (missing2 = "data"))){
validate30.errors = [{instancePath:instancePath+"/channels",schemaPath:"#/properties/channels/required",keyword:"required",params:{missingProperty: missing2},message:"must have required property '"+missing2+"'"}];
return false;
}
else {
var _errs15 = errors;
for(var key2 in data5){
if(!(((key2 === "progress") || (key2 === "status")) || (key2 === "data"))){
validate30.errors = [{instancePath:instancePath+"/channels",schemaPath:"#/properties/channels/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key2},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs15 === errors){
if(data5.progress !== undefined){
var _errs16 = errors;
if(typeof data5.progress !== "string"){
validate30.errors = [{instancePath:instancePath+"/channels/progress",schemaPath:"#/properties/channels/properties/progress/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid2 = _errs16 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data5.status !== undefined){
var _errs18 = errors;
if(typeof data5.status !== "string"){
validate30.errors = [{instancePath:instancePath+"/channels/status",schemaPath:"#/properties/channels/properties/status/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid2 = _errs18 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data5.data !== undefined){
var _errs20 = errors;
if(typeof data5.data !== "string"){
validate30.errors = [{instancePath:instancePath+"/channels/data",schemaPath:"#/properties/channels/properties/data/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid2 = _errs20 === errors;
}
else {
var valid2 = true;
}
}
}
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/channels",schemaPath:"#/properties/channels/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs13 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.jobs !== undefined){
var data9 = data.jobs;
var _errs22 = errors;
if(errors === _errs22){
if(data9 && typeof data9 == "object" && !Array.isArray(data9)){
var missing3;
if((data9.ttl === undefined) && (missing3 = "ttl")){
validate30.errors = [{instancePath:instancePath+"/jobs",schemaPath:"#/properties/jobs/required",keyword:"required",params:{missingProperty: missing3},message:"must have required property '"+missing3+"'"}];
return false;
}
else {
var _errs24 = errors;
for(var key3 in data9){
if(!((key3 === "available") || (key3 === "ttl"))){
validate30.errors = [{instancePath:instancePath+"/jobs",schemaPath:"#/properties/jobs/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key3},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs24 === errors){
if(data9.available !== undefined){
var data10 = data9.available;
var _errs25 = errors;
if(errors === _errs25){
if(data10 && typeof data10 == "object" && !Array.isArray(data10)){
var missing4;
if(((data10.GET_CAPABILITIES === undefined) && (missing4 = "GET_CAPABILITIES")) || ((data10.PROCESS_GRAPH === undefined) && (missing4 = "PROCESS_GRAPH"))){
validate30.errors = [{instancePath:instancePath+"/jobs/available",schemaPath:"#/properties/jobs/properties/available/required",keyword:"required",params:{missingProperty: missing4},message:"must have required property '"+missing4+"'"}];
return false;
}
else {
if(data10.GET_CAPABILITIES !== undefined){
var _errs27 = errors;
if(typeof data10.GET_CAPABILITIES !== "string"){
validate30.errors = [{instancePath:instancePath+"/jobs/available/GET_CAPABILITIES",schemaPath:"#/properties/jobs/properties/available/properties/GET_CAPABILITIES/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid4 = _errs27 === errors;
}
else {
var valid4 = true;
}
if(valid4){
if(data10.PROCESS_GRAPH !== undefined){
var _errs29 = errors;
if(typeof data10.PROCESS_GRAPH !== "string"){
validate30.errors = [{instancePath:instancePath+"/jobs/available/PROCESS_GRAPH",schemaPath:"#/properties/jobs/properties/available/properties/PROCESS_GRAPH/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid4 = _errs29 === errors;
}
else {
var valid4 = true;
}
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/jobs/available",schemaPath:"#/properties/jobs/properties/available/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid3 = _errs25 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data9.ttl !== undefined){
var data13 = data9.ttl;
var _errs31 = errors;
if(!((typeof data13 == "number") && (!(data13 % 1) && !isNaN(data13)))){
validate30.errors = [{instancePath:instancePath+"/jobs/ttl",schemaPath:"#/properties/jobs/properties/ttl/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs31){
if(typeof data13 == "number"){
if(data13 < 1 || isNaN(data13)){
validate30.errors = [{instancePath:instancePath+"/jobs/ttl",schemaPath:"#/properties/jobs/properties/ttl/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"}];
return false;
}
}
}
var valid3 = _errs31 === errors;
}
else {
var valid3 = true;
}
}
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/jobs",schemaPath:"#/properties/jobs/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs22 === errors;
}
else {
var valid0 = true;
}
}
}
}
}
}
}
else {
validate30.errors = [{instancePath:instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
validate30.errors = vErrors;
return errors === 0;
}
validate30.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};
