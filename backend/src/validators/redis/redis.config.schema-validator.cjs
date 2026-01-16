"use strict";
module.exports = validate30;
module.exports.default = validate30;
var schema42 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"redis.config.schema.json","title":"Redis Configuration","type":"object","description":"Configuration for Redis connection, stream names, pub/sub channels, and job management.","required":["url","streams","channels","jobs"],"properties":{"url":{"type":"string","description":"Redis connection string (e.g. 'redis://redis:6379').","pattern":"^redis://.+"},"streams":{"type":"object","description":"List of Redis streams used by the bridge.","required":["control","data"],"properties":{"control":{"type":"string","description":"Stream for advertising jobs at control plane."},"data":{"type":"string","description":"Stream for advertising jobs at data plane."}},"additionalProperties":false},"channels":{"type":"object","description":"List of pub/sub channels used by the bridge.","required":["progress","status","data"],"properties":{"progress":{"type":"string","description":"Channel onto which jobs publish their progress (e.g. 'channel:progress')."},"status":{"type":"string","description":"Channel onto which jobs publish their status (e.g. 'channel:status')."},"data":{"type":"string","description":"Channel onto which jobs publish intermediate generic data (e.g. 'channel:data')."}},"additionalProperties":false},"jobs":{"type":"object","description":"Configuration for jobs.","required":["ttl"],"properties":{"ttl":{"type":"integer","minimum":1,"description":"Job keys TTL in Redis, in seconds (e.g. 43200 for 12 hours)."}},"additionalProperties":false},"planning":{"type":"object","description":"Configuration for planner.","required":["pipelines"],"properties":{"pipelines":{"type":"object","description":"List of mappings of available jobs supported by the Redis bridge, to worker tasks.","required":["PROCESS","FIXED"],"properties":{"PROCESS":{"type":"string","description":"Planner request type for creating execution pipelines for generic graphs."},"FIXED":{"type":"string","description":"Planner request type for creating execution pipelines from workflows registry."}}}},"additionalProperties":false}},"additionalProperties":false};
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
if(!(((((key0 === "url") || (key0 === "streams")) || (key0 === "channels")) || (key0 === "jobs")) || (key0 === "planning"))){
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
if(((data1.control === undefined) && (missing1 = "control")) || ((data1.data === undefined) && (missing1 = "data"))){
validate30.errors = [{instancePath:instancePath+"/streams",schemaPath:"#/properties/streams/required",keyword:"required",params:{missingProperty: missing1},message:"must have required property '"+missing1+"'"}];
return false;
}
else {
var _errs6 = errors;
for(var key1 in data1){
if(!((key1 === "control") || (key1 === "data"))){
validate30.errors = [{instancePath:instancePath+"/streams",schemaPath:"#/properties/streams/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs6 === errors){
if(data1.control !== undefined){
var _errs7 = errors;
if(typeof data1.control !== "string"){
validate30.errors = [{instancePath:instancePath+"/streams/control",schemaPath:"#/properties/streams/properties/control/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid1 = _errs7 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data1.data !== undefined){
var _errs9 = errors;
if(typeof data1.data !== "string"){
validate30.errors = [{instancePath:instancePath+"/streams/data",schemaPath:"#/properties/streams/properties/data/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid1 = _errs9 === errors;
}
else {
var valid1 = true;
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
var data4 = data.channels;
var _errs11 = errors;
if(errors === _errs11){
if(data4 && typeof data4 == "object" && !Array.isArray(data4)){
var missing2;
if((((data4.progress === undefined) && (missing2 = "progress")) || ((data4.status === undefined) && (missing2 = "status"))) || ((data4.data === undefined) && (missing2 = "data"))){
validate30.errors = [{instancePath:instancePath+"/channels",schemaPath:"#/properties/channels/required",keyword:"required",params:{missingProperty: missing2},message:"must have required property '"+missing2+"'"}];
return false;
}
else {
var _errs13 = errors;
for(var key2 in data4){
if(!(((key2 === "progress") || (key2 === "status")) || (key2 === "data"))){
validate30.errors = [{instancePath:instancePath+"/channels",schemaPath:"#/properties/channels/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key2},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs13 === errors){
if(data4.progress !== undefined){
var _errs14 = errors;
if(typeof data4.progress !== "string"){
validate30.errors = [{instancePath:instancePath+"/channels/progress",schemaPath:"#/properties/channels/properties/progress/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid2 = _errs14 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data4.status !== undefined){
var _errs16 = errors;
if(typeof data4.status !== "string"){
validate30.errors = [{instancePath:instancePath+"/channels/status",schemaPath:"#/properties/channels/properties/status/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid2 = _errs16 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data4.data !== undefined){
var _errs18 = errors;
if(typeof data4.data !== "string"){
validate30.errors = [{instancePath:instancePath+"/channels/data",schemaPath:"#/properties/channels/properties/data/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid2 = _errs18 === errors;
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
var valid0 = _errs11 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.jobs !== undefined){
var data8 = data.jobs;
var _errs20 = errors;
if(errors === _errs20){
if(data8 && typeof data8 == "object" && !Array.isArray(data8)){
var missing3;
if((data8.ttl === undefined) && (missing3 = "ttl")){
validate30.errors = [{instancePath:instancePath+"/jobs",schemaPath:"#/properties/jobs/required",keyword:"required",params:{missingProperty: missing3},message:"must have required property '"+missing3+"'"}];
return false;
}
else {
var _errs22 = errors;
for(var key3 in data8){
if(!(key3 === "ttl")){
validate30.errors = [{instancePath:instancePath+"/jobs",schemaPath:"#/properties/jobs/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key3},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs22 === errors){
if(data8.ttl !== undefined){
var data9 = data8.ttl;
var _errs23 = errors;
if(!((typeof data9 == "number") && (!(data9 % 1) && !isNaN(data9)))){
validate30.errors = [{instancePath:instancePath+"/jobs/ttl",schemaPath:"#/properties/jobs/properties/ttl/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs23){
if(typeof data9 == "number"){
if(data9 < 1 || isNaN(data9)){
validate30.errors = [{instancePath:instancePath+"/jobs/ttl",schemaPath:"#/properties/jobs/properties/ttl/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"}];
return false;
}
}
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
var valid0 = _errs20 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.planning !== undefined){
var data10 = data.planning;
var _errs25 = errors;
if(errors === _errs25){
if(data10 && typeof data10 == "object" && !Array.isArray(data10)){
var missing4;
if((data10.pipelines === undefined) && (missing4 = "pipelines")){
validate30.errors = [{instancePath:instancePath+"/planning",schemaPath:"#/properties/planning/required",keyword:"required",params:{missingProperty: missing4},message:"must have required property '"+missing4+"'"}];
return false;
}
else {
var _errs27 = errors;
for(var key4 in data10){
if(!(key4 === "pipelines")){
validate30.errors = [{instancePath:instancePath+"/planning",schemaPath:"#/properties/planning/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key4},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs27 === errors){
if(data10.pipelines !== undefined){
var data11 = data10.pipelines;
var _errs28 = errors;
if(errors === _errs28){
if(data11 && typeof data11 == "object" && !Array.isArray(data11)){
var missing5;
if(((data11.PROCESS === undefined) && (missing5 = "PROCESS")) || ((data11.FIXED === undefined) && (missing5 = "FIXED"))){
validate30.errors = [{instancePath:instancePath+"/planning/pipelines",schemaPath:"#/properties/planning/properties/pipelines/required",keyword:"required",params:{missingProperty: missing5},message:"must have required property '"+missing5+"'"}];
return false;
}
else {
if(data11.PROCESS !== undefined){
var _errs30 = errors;
if(typeof data11.PROCESS !== "string"){
validate30.errors = [{instancePath:instancePath+"/planning/pipelines/PROCESS",schemaPath:"#/properties/planning/properties/pipelines/properties/PROCESS/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid5 = _errs30 === errors;
}
else {
var valid5 = true;
}
if(valid5){
if(data11.FIXED !== undefined){
var _errs32 = errors;
if(typeof data11.FIXED !== "string"){
validate30.errors = [{instancePath:instancePath+"/planning/pipelines/FIXED",schemaPath:"#/properties/planning/properties/pipelines/properties/FIXED/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid5 = _errs32 === errors;
}
else {
var valid5 = true;
}
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/planning/pipelines",schemaPath:"#/properties/planning/properties/pipelines/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
}
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/planning",schemaPath:"#/properties/planning/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs25 === errors;
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
