"use strict";
module.exports = validate30;
module.exports.default = validate30;
var schema42 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"graph.schema.json","title":"LangGraph Workflow","description":"Shared dual-plane LangGraph JSON used by Node.js (control plane) and Python worker (data plane).","type":"object","additionalProperties":false,"required":["schema","workflowId","nodes","edges"],"properties":{"schema":{"type":"string","enum":["langgraph.v1"],"description":"Logical schema version of the LangGraph document."},"workflowId":{"type":"string","description":"Stable identifier for this workflow instance (distinct from Job id, which wraps this graph)."},"context":{"type":"object","description":"Shared, plane-agnostic context object accessible to all nodes.","additionalProperties":true},"metadata":{"type":"object","description":"Optional planner/runtime metadata (non-critical for execution).","additionalProperties":true},"nodes":{"type":"array","minItems":1,"items":{"$ref":"#/$defs/node"},"description":"All nodes in the workflow DAG."},"edges":{"type":"array","items":{"$ref":"#/$defs/edge"},"description":"Directed edges representing dependencies between nodes."}},"$defs":{"plane":{"type":"string","description":"Execution plane for this node.","enum":["node","python"]},"nodeStatus":{"type":"string","description":"Execution status of a node.","enum":["pending","ready","running","completed","failed","skipped"]},"errorInfo":{"type":"object","description":"Error information when node.status == 'failed'.","additionalProperties":true,"properties":{"message":{"type":"string","description":"Human-readable error message."},"code":{"type":"string","description":"Machine-readable error code."},"details":{"description":"Arbitrary structured details about the failure.","type":["object","array","string","number","boolean","null"]}}},"node":{"type":"object","additionalProperties":false,"required":["id","task","plane","status"],"properties":{"id":{"type":"string","description":"Unique node identifier within this workflow."},"name":{"type":"string","description":"Optional human-friendly label for the node."},"task":{"type":"string","description":"Symbolic task/capability identifier (e.g. a capabilities.json `id` like 'train.train_lora')."},"plane":{"$ref":"#/$defs/plane"},"status":{"$ref":"#/$defs/nodeStatus"},"params":{"type":"object","description":"Planner-defined parameters for this node (mapped onto capability input/parameters).","additionalProperties":true},"input":{"description":"Optional snapshot of node-specific input (resolved from context/previous outputs).","type":["object","array","string","number","boolean","null"]},"output":{"description":"Node output payload or artifact references; stored as part of the graph for later nodes.","type":["object","array","string","number","boolean","null"]},"error":{"$ref":"#/$defs/errorInfo"},"retries":{"type":"object","description":"Retry bookkeeping, if implemented (attempt count etc).","additionalProperties":false,"properties":{"attempt":{"type":"integer","minimum":0,"description":"Current attempt number for this node."},"maxAttempts":{"type":"integer","minimum":1,"description":"Maximum allowed attempts for this node."}}},"tags":{"type":"array","description":"Optional tags for debugging, grouping, or analytics.","items":{"type":"string"}},"telemetry":{"type":"object","description":"Optional telemetry hints (metrics keys, spans, etc.).","additionalProperties":true}}},"edge":{"type":"object","additionalProperties":false,"required":["from","to"],"properties":{"from":{"type":"string","description":"Source node id."},"to":{"type":"string","description":"Target node id."},"kind":{"type":"string","description":"Optional edge kind to support conditional flows.","enum":["normal","on_success","on_failure"],"default":"normal"},"metadata":{"type":"object","description":"Optional edge-level metadata (e.g. condition expressions, weights).","additionalProperties":true}}}}};
var schema47 = {"type":"object","additionalProperties":false,"required":["from","to"],"properties":{"from":{"type":"string","description":"Source node id."},"to":{"type":"string","description":"Target node id."},"kind":{"type":"string","description":"Optional edge kind to support conditional flows.","enum":["normal","on_success","on_failure"],"default":"normal"},"metadata":{"type":"object","description":"Optional edge-level metadata (e.g. condition expressions, weights).","additionalProperties":true}}};
var schema43 = {"type":"object","additionalProperties":false,"required":["id","task","plane","status"],"properties":{"id":{"type":"string","description":"Unique node identifier within this workflow."},"name":{"type":"string","description":"Optional human-friendly label for the node."},"task":{"type":"string","description":"Symbolic task/capability identifier (e.g. a capabilities.json `id` like 'train.train_lora')."},"plane":{"$ref":"#/$defs/plane"},"status":{"$ref":"#/$defs/nodeStatus"},"params":{"type":"object","description":"Planner-defined parameters for this node (mapped onto capability input/parameters).","additionalProperties":true},"input":{"description":"Optional snapshot of node-specific input (resolved from context/previous outputs).","type":["object","array","string","number","boolean","null"]},"output":{"description":"Node output payload or artifact references; stored as part of the graph for later nodes.","type":["object","array","string","number","boolean","null"]},"error":{"$ref":"#/$defs/errorInfo"},"retries":{"type":"object","description":"Retry bookkeeping, if implemented (attempt count etc).","additionalProperties":false,"properties":{"attempt":{"type":"integer","minimum":0,"description":"Current attempt number for this node."},"maxAttempts":{"type":"integer","minimum":1,"description":"Maximum allowed attempts for this node."}}},"tags":{"type":"array","description":"Optional tags for debugging, grouping, or analytics.","items":{"type":"string"}},"telemetry":{"type":"object","description":"Optional telemetry hints (metrics keys, spans, etc.).","additionalProperties":true}}};
var schema44 = {"type":"string","description":"Execution plane for this node.","enum":["node","python"]};
var schema45 = {"type":"string","description":"Execution status of a node.","enum":["pending","ready","running","completed","failed","skipped"]};
var schema46 = {"type":"object","description":"Error information when node.status == 'failed'.","additionalProperties":true,"properties":{"message":{"type":"string","description":"Human-readable error message."},"code":{"type":"string","description":"Machine-readable error code."},"details":{"description":"Arbitrary structured details about the failure.","type":["object","array","string","number","boolean","null"]}}};
var func3 = Object.prototype.hasOwnProperty;

function validate31(data, valCxt){
"use strict"; ;
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
var evaluated0 = validate31.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(errors === 0){
if(data && typeof data == "object" && !Array.isArray(data)){
var missing0;
if(((((data.id === undefined) && (missing0 = "id")) || ((data.task === undefined) && (missing0 = "task"))) || ((data.plane === undefined) && (missing0 = "plane"))) || ((data.status === undefined) && (missing0 = "status"))){
validate31.errors = [{instancePath:instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];
return false;
}
else {
var _errs1 = errors;
for(var key0 in data){
if(!(func3.call(schema43.properties, key0))){
validate31.errors = [{instancePath:instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs1 === errors){
if(data.id !== undefined){
var _errs2 = errors;
if(typeof data.id !== "string"){
validate31.errors = [{instancePath:instancePath+"/id",schemaPath:"#/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs2 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.name !== undefined){
var _errs4 = errors;
if(typeof data.name !== "string"){
validate31.errors = [{instancePath:instancePath+"/name",schemaPath:"#/properties/name/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs4 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.task !== undefined){
var _errs6 = errors;
if(typeof data.task !== "string"){
validate31.errors = [{instancePath:instancePath+"/task",schemaPath:"#/properties/task/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs6 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.plane !== undefined){
var data3 = data.plane;
var _errs8 = errors;
if(typeof data3 !== "string"){
validate31.errors = [{instancePath:instancePath+"/plane",schemaPath:"#/$defs/plane/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
if(!((data3 === "node") || (data3 === "python"))){
validate31.errors = [{instancePath:instancePath+"/plane",schemaPath:"#/$defs/plane/enum",keyword:"enum",params:{allowedValues: schema44.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid0 = _errs8 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.status !== undefined){
var data4 = data.status;
var _errs11 = errors;
if(typeof data4 !== "string"){
validate31.errors = [{instancePath:instancePath+"/status",schemaPath:"#/$defs/nodeStatus/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
if(!((((((data4 === "pending") || (data4 === "ready")) || (data4 === "running")) || (data4 === "completed")) || (data4 === "failed")) || (data4 === "skipped"))){
validate31.errors = [{instancePath:instancePath+"/status",schemaPath:"#/$defs/nodeStatus/enum",keyword:"enum",params:{allowedValues: schema45.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid0 = _errs11 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.params !== undefined){
var data5 = data.params;
var _errs14 = errors;
if(errors === _errs14){
if(data5 && typeof data5 == "object" && !Array.isArray(data5)){
}
else {
validate31.errors = [{instancePath:instancePath+"/params",schemaPath:"#/properties/params/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs14 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.input !== undefined){
var data6 = data.input;
var _errs17 = errors;
if((((typeof data6 != "object") && (typeof data6 !== "string")) && (!(typeof data6 == "number"))) && (typeof data6 !== "boolean")){
validate31.errors = [{instancePath:instancePath+"/input",schemaPath:"#/properties/input/type",keyword:"type",params:{type: schema43.properties.input.type},message:"must be object,array,string,number,boolean,null"}];
return false;
}
var valid0 = _errs17 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.output !== undefined){
var data7 = data.output;
var _errs19 = errors;
if((((typeof data7 != "object") && (typeof data7 !== "string")) && (!(typeof data7 == "number"))) && (typeof data7 !== "boolean")){
validate31.errors = [{instancePath:instancePath+"/output",schemaPath:"#/properties/output/type",keyword:"type",params:{type: schema43.properties.output.type},message:"must be object,array,string,number,boolean,null"}];
return false;
}
var valid0 = _errs19 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.error !== undefined){
var data8 = data.error;
var _errs21 = errors;
var _errs22 = errors;
if(errors === _errs22){
if(data8 && typeof data8 == "object" && !Array.isArray(data8)){
if(data8.message !== undefined){
var _errs25 = errors;
if(typeof data8.message !== "string"){
validate31.errors = [{instancePath:instancePath+"/error/message",schemaPath:"#/$defs/errorInfo/properties/message/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid4 = _errs25 === errors;
}
else {
var valid4 = true;
}
if(valid4){
if(data8.code !== undefined){
var _errs27 = errors;
if(typeof data8.code !== "string"){
validate31.errors = [{instancePath:instancePath+"/error/code",schemaPath:"#/$defs/errorInfo/properties/code/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid4 = _errs27 === errors;
}
else {
var valid4 = true;
}
if(valid4){
if(data8.details !== undefined){
var data11 = data8.details;
var _errs29 = errors;
if((((typeof data11 != "object") && (typeof data11 !== "string")) && (!(typeof data11 == "number"))) && (typeof data11 !== "boolean")){
validate31.errors = [{instancePath:instancePath+"/error/details",schemaPath:"#/$defs/errorInfo/properties/details/type",keyword:"type",params:{type: schema46.properties.details.type},message:"must be object,array,string,number,boolean,null"}];
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
validate31.errors = [{instancePath:instancePath+"/error",schemaPath:"#/$defs/errorInfo/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs21 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.retries !== undefined){
var data12 = data.retries;
var _errs31 = errors;
if(errors === _errs31){
if(data12 && typeof data12 == "object" && !Array.isArray(data12)){
var _errs33 = errors;
for(var key1 in data12){
if(!((key1 === "attempt") || (key1 === "maxAttempts"))){
validate31.errors = [{instancePath:instancePath+"/retries",schemaPath:"#/properties/retries/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs33 === errors){
if(data12.attempt !== undefined){
var data13 = data12.attempt;
var _errs34 = errors;
if(!((typeof data13 == "number") && (!(data13 % 1) && !isNaN(data13)))){
validate31.errors = [{instancePath:instancePath+"/retries/attempt",schemaPath:"#/properties/retries/properties/attempt/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs34){
if(typeof data13 == "number"){
if(data13 < 0 || isNaN(data13)){
validate31.errors = [{instancePath:instancePath+"/retries/attempt",schemaPath:"#/properties/retries/properties/attempt/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid5 = _errs34 === errors;
}
else {
var valid5 = true;
}
if(valid5){
if(data12.maxAttempts !== undefined){
var data14 = data12.maxAttempts;
var _errs36 = errors;
if(!((typeof data14 == "number") && (!(data14 % 1) && !isNaN(data14)))){
validate31.errors = [{instancePath:instancePath+"/retries/maxAttempts",schemaPath:"#/properties/retries/properties/maxAttempts/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs36){
if(typeof data14 == "number"){
if(data14 < 1 || isNaN(data14)){
validate31.errors = [{instancePath:instancePath+"/retries/maxAttempts",schemaPath:"#/properties/retries/properties/maxAttempts/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"}];
return false;
}
}
}
var valid5 = _errs36 === errors;
}
else {
var valid5 = true;
}
}
}
}
else {
validate31.errors = [{instancePath:instancePath+"/retries",schemaPath:"#/properties/retries/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs31 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.tags !== undefined){
var data15 = data.tags;
var _errs38 = errors;
if(errors === _errs38){
if(Array.isArray(data15)){
var valid6 = true;
var len0 = data15.length;
for(var i0=0; i0<len0; i0++){
var _errs40 = errors;
if(typeof data15[i0] !== "string"){
validate31.errors = [{instancePath:instancePath+"/tags/" + i0,schemaPath:"#/properties/tags/items/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid6 = _errs40 === errors;
if(!valid6){
break;
}
}
}
else {
validate31.errors = [{instancePath:instancePath+"/tags",schemaPath:"#/properties/tags/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs38 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.telemetry !== undefined){
var data17 = data.telemetry;
var _errs42 = errors;
if(errors === _errs42){
if(data17 && typeof data17 == "object" && !Array.isArray(data17)){
}
else {
validate31.errors = [{instancePath:instancePath+"/telemetry",schemaPath:"#/properties/telemetry/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs42 === errors;
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
}
}
}
}
}
}
}
else {
validate31.errors = [{instancePath:instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
validate31.errors = vErrors;
return errors === 0;
}
validate31.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};


function validate30(data, valCxt){
"use strict"; /*# sourceURL="graph.schema.json" */;
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
if(((((data.schema === undefined) && (missing0 = "schema")) || ((data.workflowId === undefined) && (missing0 = "workflowId"))) || ((data.nodes === undefined) && (missing0 = "nodes"))) || ((data.edges === undefined) && (missing0 = "edges"))){
validate30.errors = [{instancePath:instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];
return false;
}
else {
var _errs1 = errors;
for(var key0 in data){
if(!((((((key0 === "schema") || (key0 === "workflowId")) || (key0 === "context")) || (key0 === "metadata")) || (key0 === "nodes")) || (key0 === "edges"))){
validate30.errors = [{instancePath:instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs1 === errors){
if(data.schema !== undefined){
var data0 = data.schema;
var _errs2 = errors;
if(typeof data0 !== "string"){
validate30.errors = [{instancePath:instancePath+"/schema",schemaPath:"#/properties/schema/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
if(!(data0 === "langgraph.v1")){
validate30.errors = [{instancePath:instancePath+"/schema",schemaPath:"#/properties/schema/enum",keyword:"enum",params:{allowedValues: schema42.properties.schema.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid0 = _errs2 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.workflowId !== undefined){
var _errs4 = errors;
if(typeof data.workflowId !== "string"){
validate30.errors = [{instancePath:instancePath+"/workflowId",schemaPath:"#/properties/workflowId/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs4 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.context !== undefined){
var data2 = data.context;
var _errs6 = errors;
if(errors === _errs6){
if(data2 && typeof data2 == "object" && !Array.isArray(data2)){
}
else {
validate30.errors = [{instancePath:instancePath+"/context",schemaPath:"#/properties/context/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs6 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.metadata !== undefined){
var data3 = data.metadata;
var _errs9 = errors;
if(errors === _errs9){
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
}
else {
validate30.errors = [{instancePath:instancePath+"/metadata",schemaPath:"#/properties/metadata/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs9 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.nodes !== undefined){
var data4 = data.nodes;
var _errs12 = errors;
if(errors === _errs12){
if(Array.isArray(data4)){
if(data4.length < 1){
validate30.errors = [{instancePath:instancePath+"/nodes",schemaPath:"#/properties/nodes/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"}];
return false;
}
else {
var valid1 = true;
var len0 = data4.length;
for(var i0=0; i0<len0; i0++){
var _errs14 = errors;
if(!(validate31(data4[i0], {instancePath:instancePath+"/nodes/" + i0,parentData:data4,parentDataProperty:i0,rootData:rootData,dynamicAnchors:dynamicAnchors}))){
vErrors = vErrors === null ? validate31.errors : vErrors.concat(validate31.errors);
errors = vErrors.length;
}
var valid1 = _errs14 === errors;
if(!valid1){
break;
}
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/nodes",schemaPath:"#/properties/nodes/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs12 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.edges !== undefined){
var data6 = data.edges;
var _errs15 = errors;
if(errors === _errs15){
if(Array.isArray(data6)){
var valid2 = true;
var len1 = data6.length;
for(var i1=0; i1<len1; i1++){
var data7 = data6[i1];
var _errs17 = errors;
var _errs18 = errors;
if(errors === _errs18){
if(data7 && typeof data7 == "object" && !Array.isArray(data7)){
var missing1;
if(((data7.from === undefined) && (missing1 = "from")) || ((data7.to === undefined) && (missing1 = "to"))){
validate30.errors = [{instancePath:instancePath+"/edges/" + i1,schemaPath:"#/$defs/edge/required",keyword:"required",params:{missingProperty: missing1},message:"must have required property '"+missing1+"'"}];
return false;
}
else {
var _errs20 = errors;
for(var key1 in data7){
if(!((((key1 === "from") || (key1 === "to")) || (key1 === "kind")) || (key1 === "metadata"))){
validate30.errors = [{instancePath:instancePath+"/edges/" + i1,schemaPath:"#/$defs/edge/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs20 === errors){
if(data7.from !== undefined){
var _errs21 = errors;
if(typeof data7.from !== "string"){
validate30.errors = [{instancePath:instancePath+"/edges/" + i1+"/from",schemaPath:"#/$defs/edge/properties/from/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid4 = _errs21 === errors;
}
else {
var valid4 = true;
}
if(valid4){
if(data7.to !== undefined){
var _errs23 = errors;
if(typeof data7.to !== "string"){
validate30.errors = [{instancePath:instancePath+"/edges/" + i1+"/to",schemaPath:"#/$defs/edge/properties/to/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid4 = _errs23 === errors;
}
else {
var valid4 = true;
}
if(valid4){
if(data7.kind !== undefined){
var data10 = data7.kind;
var _errs25 = errors;
if(typeof data10 !== "string"){
validate30.errors = [{instancePath:instancePath+"/edges/" + i1+"/kind",schemaPath:"#/$defs/edge/properties/kind/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
if(!(((data10 === "normal") || (data10 === "on_success")) || (data10 === "on_failure"))){
validate30.errors = [{instancePath:instancePath+"/edges/" + i1+"/kind",schemaPath:"#/$defs/edge/properties/kind/enum",keyword:"enum",params:{allowedValues: schema47.properties.kind.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid4 = _errs25 === errors;
}
else {
var valid4 = true;
}
if(valid4){
if(data7.metadata !== undefined){
var data11 = data7.metadata;
var _errs27 = errors;
if(errors === _errs27){
if(data11 && typeof data11 == "object" && !Array.isArray(data11)){
}
else {
validate30.errors = [{instancePath:instancePath+"/edges/" + i1+"/metadata",schemaPath:"#/$defs/edge/properties/metadata/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid4 = _errs27 === errors;
}
else {
var valid4 = true;
}
}
}
}
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/edges/" + i1,schemaPath:"#/$defs/edge/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid2 = _errs17 === errors;
if(!valid2){
break;
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/edges",schemaPath:"#/properties/edges/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs15 === errors;
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
