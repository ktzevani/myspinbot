"use strict";
module.exports = validate30;
module.exports.default = validate30;
var schema42 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"capability.schema.json","title":"Capability","description":"A single capability describing a task the system can perform, its runtime behavior, IO schemas, and operational contracts.","type":"object","properties":{"id":{"type":"string","description":"Unique string identifier (machine readable)."},"label":{"type":"string","description":"Human-readable label used in UIs and agent planners."},"description":{"type":"string","description":"Summary of what the capability does."},"version":{"type":"string","description":"Semantic version of the manifest defining this capability."},"plane":{"type":"string","enum":["node","python"],"description":"Execution plane hint (e.g. node, python)."},"runtime":{"$ref":"defs.schema.json#/$defs/runtime"},"handler":{"$ref":"defs.schema.json#/$defs/handler"},"io":{"type":"object","title":"Input/Output Schema Definitions","description":"JSON Schemas describing accepted input payloads and expected output responses.","properties":{"input":{"$ref":"defs.schema.json#/$defs/jsonSchemaFragment","description":"JSON Schema describing accepted payloads."},"output":{"$ref":"defs.schema.json#/$defs/jsonSchemaFragment","description":"JSON Schema describing the response."}},"required":["input","output"],"additionalProperties":false},"parameters":{"type":"array","description":"Optional structured parameter list (name/type/description/required).","items":{"$ref":"defs.schema.json#/$defs/parameter"}},"examples":{"type":"array","description":"Example payloads and responses used for planner grounding."},"telemetry":{"$ref":"defs.schema.json#/$defs/telemetry","description":"Flags describing progress events or custom metrics."},"security":{"$ref":"defs.schema.json#/$defs/security","description":"Whether secrets or scoped credentials are required."},"contracts":{"$ref":"defs.schema.json#/$defs/contracts","description":"Operational guarantees such as idempotency or expected side effects."}},"required":["id","label","description","version","plane","runtime","handler","io"],"additionalProperties":false};
var schema44 = {"type":"object","title":"Runtime Configuration","description":"Execution environment metadata governing where and how the capability is run.","properties":{"kind":{"type":"string","description":"Execution plane: cpu or gpu. Node-plane capabilities always use cpu.","enum":["cpu","gpu"]},"timeoutSeconds":{"type":"number","description":"Execution timeout guard in seconds."},"concurrency":{"type":"number","description":"Maximum allowed concurrent invocations."}},"required":["kind","concurrency"],"additionalProperties":true};
var schema45 = {"type":"object","title":"Handler Binding","description":"Information about the concrete module and method implementing this capability.","properties":{"module":{"type":"string","description":"Path to the module exporting the resolver."},"method":{"type":"string","description":"Exported method or function name to invoke."}},"required":["module","method"],"additionalProperties":false};
var schema46 = {"type":"object","description":"JSON Schema fragment describing a payload shape. Used for capability input/output validation.","additionalProperties":true};
var schema48 = {"type":"object","description":"Optional structured parameter definition for a capability, including name, type, description and whether it is required.","properties":{"name":{"type":"string","description":"Parameter name."},"type":{"type":"string","description":"Expected parameter data type (string, number, boolean, etc.)."},"description":{"type":"string","description":"Human-readable explanation of the parameter."},"required":{"type":"boolean","description":"Whether the parameter must be provided by the caller."},"default":{"description":"Optional default value used if the parameter is omitted."}},"required":["name","type"],"additionalProperties":true};
var schema49 = {"type":"object","title":"Telemetry Description","description":"Optional telemetry behavior: progress events, emitted metrics, and other runtime instrumentation.","properties":{"emitsProgressEvents":{"type":"boolean","description":"Whether this capability emits progress events."},"metrics":{"type":"array","description":"List of metric identifiers emitted during execution.","items":{"type":"string"}}},"additionalProperties":true};
var schema50 = {"type":"object","title":"Security Requirements","description":"Security markings describing whether secrets or scoped credentials are required.","properties":{"requiresSecrets":{"type":"boolean","description":"Whether this capability requires access to secrets or secure credentials."}},"additionalProperties":true};
var schema51 = {"type":"object","title":"Operational Contracts","description":"Operational guarantees: idempotency, side effects, determinism, etc.","properties":{"idempotent":{"type":"boolean","description":"Whether invoking the capability multiple times produces the same result."},"sideEffects":{"type":"string","description":"Description of any operational side effects (e.g., persistent-storage-write)."}},"additionalProperties":true};
var func3 = Object.prototype.hasOwnProperty;

function validate30(data, valCxt){
"use strict"; /*# sourceURL="capability.schema.json" */;
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
if(((((((((data.id === undefined) && (missing0 = "id")) || ((data.label === undefined) && (missing0 = "label"))) || ((data.description === undefined) && (missing0 = "description"))) || ((data.version === undefined) && (missing0 = "version"))) || ((data.plane === undefined) && (missing0 = "plane"))) || ((data.runtime === undefined) && (missing0 = "runtime"))) || ((data.handler === undefined) && (missing0 = "handler"))) || ((data.io === undefined) && (missing0 = "io"))){
validate30.errors = [{instancePath:instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];
return false;
}
else {
var _errs1 = errors;
for(var key0 in data){
if(!(func3.call(schema42.properties, key0))){
validate30.errors = [{instancePath:instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs1 === errors){
if(data.id !== undefined){
var _errs2 = errors;
if(typeof data.id !== "string"){
validate30.errors = [{instancePath:instancePath+"/id",schemaPath:"#/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs2 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.label !== undefined){
var _errs4 = errors;
if(typeof data.label !== "string"){
validate30.errors = [{instancePath:instancePath+"/label",schemaPath:"#/properties/label/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs4 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.description !== undefined){
var _errs6 = errors;
if(typeof data.description !== "string"){
validate30.errors = [{instancePath:instancePath+"/description",schemaPath:"#/properties/description/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs6 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.version !== undefined){
var _errs8 = errors;
if(typeof data.version !== "string"){
validate30.errors = [{instancePath:instancePath+"/version",schemaPath:"#/properties/version/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs8 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.plane !== undefined){
var data4 = data.plane;
var _errs10 = errors;
if(typeof data4 !== "string"){
validate30.errors = [{instancePath:instancePath+"/plane",schemaPath:"#/properties/plane/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
if(!((data4 === "node") || (data4 === "python"))){
validate30.errors = [{instancePath:instancePath+"/plane",schemaPath:"#/properties/plane/enum",keyword:"enum",params:{allowedValues: schema42.properties.plane.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid0 = _errs10 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.runtime !== undefined){
var data5 = data.runtime;
var _errs12 = errors;
var _errs13 = errors;
if(errors === _errs13){
if(data5 && typeof data5 == "object" && !Array.isArray(data5)){
var missing1;
if(((data5.kind === undefined) && (missing1 = "kind")) || ((data5.concurrency === undefined) && (missing1 = "concurrency"))){
validate30.errors = [{instancePath:instancePath+"/runtime",schemaPath:"defs.schema.json#/$defs/runtime/required",keyword:"required",params:{missingProperty: missing1},message:"must have required property '"+missing1+"'"}];
return false;
}
else {
if(data5.kind !== undefined){
var data6 = data5.kind;
var _errs16 = errors;
if(typeof data6 !== "string"){
validate30.errors = [{instancePath:instancePath+"/runtime/kind",schemaPath:"defs.schema.json#/$defs/runtime/properties/kind/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
if(!((data6 === "cpu") || (data6 === "gpu"))){
validate30.errors = [{instancePath:instancePath+"/runtime/kind",schemaPath:"defs.schema.json#/$defs/runtime/properties/kind/enum",keyword:"enum",params:{allowedValues: schema44.properties.kind.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid2 = _errs16 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data5.timeoutSeconds !== undefined){
var _errs18 = errors;
if(!(typeof data5.timeoutSeconds == "number")){
validate30.errors = [{instancePath:instancePath+"/runtime/timeoutSeconds",schemaPath:"defs.schema.json#/$defs/runtime/properties/timeoutSeconds/type",keyword:"type",params:{type: "number"},message:"must be number"}];
return false;
}
var valid2 = _errs18 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data5.concurrency !== undefined){
var _errs20 = errors;
if(!(typeof data5.concurrency == "number")){
validate30.errors = [{instancePath:instancePath+"/runtime/concurrency",schemaPath:"defs.schema.json#/$defs/runtime/properties/concurrency/type",keyword:"type",params:{type: "number"},message:"must be number"}];
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
else {
validate30.errors = [{instancePath:instancePath+"/runtime",schemaPath:"defs.schema.json#/$defs/runtime/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs12 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.handler !== undefined){
var data9 = data.handler;
var _errs22 = errors;
var _errs23 = errors;
if(errors === _errs23){
if(data9 && typeof data9 == "object" && !Array.isArray(data9)){
var missing2;
if(((data9.module === undefined) && (missing2 = "module")) || ((data9.method === undefined) && (missing2 = "method"))){
validate30.errors = [{instancePath:instancePath+"/handler",schemaPath:"defs.schema.json#/$defs/handler/required",keyword:"required",params:{missingProperty: missing2},message:"must have required property '"+missing2+"'"}];
return false;
}
else {
var _errs25 = errors;
for(var key1 in data9){
if(!((key1 === "module") || (key1 === "method"))){
validate30.errors = [{instancePath:instancePath+"/handler",schemaPath:"defs.schema.json#/$defs/handler/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs25 === errors){
if(data9.module !== undefined){
var _errs26 = errors;
if(typeof data9.module !== "string"){
validate30.errors = [{instancePath:instancePath+"/handler/module",schemaPath:"defs.schema.json#/$defs/handler/properties/module/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid4 = _errs26 === errors;
}
else {
var valid4 = true;
}
if(valid4){
if(data9.method !== undefined){
var _errs28 = errors;
if(typeof data9.method !== "string"){
validate30.errors = [{instancePath:instancePath+"/handler/method",schemaPath:"defs.schema.json#/$defs/handler/properties/method/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid4 = _errs28 === errors;
}
else {
var valid4 = true;
}
}
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/handler",schemaPath:"defs.schema.json#/$defs/handler/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs22 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.io !== undefined){
var data12 = data.io;
var _errs30 = errors;
if(errors === _errs30){
if(data12 && typeof data12 == "object" && !Array.isArray(data12)){
var missing3;
if(((data12.input === undefined) && (missing3 = "input")) || ((data12.output === undefined) && (missing3 = "output"))){
validate30.errors = [{instancePath:instancePath+"/io",schemaPath:"#/properties/io/required",keyword:"required",params:{missingProperty: missing3},message:"must have required property '"+missing3+"'"}];
return false;
}
else {
var _errs32 = errors;
for(var key2 in data12){
if(!((key2 === "input") || (key2 === "output"))){
validate30.errors = [{instancePath:instancePath+"/io",schemaPath:"#/properties/io/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key2},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs32 === errors){
if(data12.input !== undefined){
var data13 = data12.input;
var _errs33 = errors;
var _errs34 = errors;
if(errors === _errs34){
if(data13 && typeof data13 == "object" && !Array.isArray(data13)){
}
else {
validate30.errors = [{instancePath:instancePath+"/io/input",schemaPath:"defs.schema.json#/$defs/jsonSchemaFragment/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid5 = _errs33 === errors;
}
else {
var valid5 = true;
}
if(valid5){
if(data12.output !== undefined){
var data14 = data12.output;
var _errs37 = errors;
var _errs38 = errors;
if(errors === _errs38){
if(data14 && typeof data14 == "object" && !Array.isArray(data14)){
}
else {
validate30.errors = [{instancePath:instancePath+"/io/output",schemaPath:"defs.schema.json#/$defs/jsonSchemaFragment/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid5 = _errs37 === errors;
}
else {
var valid5 = true;
}
}
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/io",schemaPath:"#/properties/io/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs30 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.parameters !== undefined){
var data15 = data.parameters;
var _errs41 = errors;
if(errors === _errs41){
if(Array.isArray(data15)){
var valid8 = true;
var len0 = data15.length;
for(var i0=0; i0<len0; i0++){
var data16 = data15[i0];
var _errs43 = errors;
var _errs44 = errors;
if(errors === _errs44){
if(data16 && typeof data16 == "object" && !Array.isArray(data16)){
var missing4;
if(((data16.name === undefined) && (missing4 = "name")) || ((data16.type === undefined) && (missing4 = "type"))){
validate30.errors = [{instancePath:instancePath+"/parameters/" + i0,schemaPath:"defs.schema.json#/$defs/parameter/required",keyword:"required",params:{missingProperty: missing4},message:"must have required property '"+missing4+"'"}];
return false;
}
else {
if(data16.name !== undefined){
var _errs47 = errors;
if(typeof data16.name !== "string"){
validate30.errors = [{instancePath:instancePath+"/parameters/" + i0+"/name",schemaPath:"defs.schema.json#/$defs/parameter/properties/name/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid10 = _errs47 === errors;
}
else {
var valid10 = true;
}
if(valid10){
if(data16.type !== undefined){
var _errs49 = errors;
if(typeof data16.type !== "string"){
validate30.errors = [{instancePath:instancePath+"/parameters/" + i0+"/type",schemaPath:"defs.schema.json#/$defs/parameter/properties/type/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid10 = _errs49 === errors;
}
else {
var valid10 = true;
}
if(valid10){
if(data16.description !== undefined){
var _errs51 = errors;
if(typeof data16.description !== "string"){
validate30.errors = [{instancePath:instancePath+"/parameters/" + i0+"/description",schemaPath:"defs.schema.json#/$defs/parameter/properties/description/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid10 = _errs51 === errors;
}
else {
var valid10 = true;
}
if(valid10){
if(data16.required !== undefined){
var _errs53 = errors;
if(typeof data16.required !== "boolean"){
validate30.errors = [{instancePath:instancePath+"/parameters/" + i0+"/required",schemaPath:"defs.schema.json#/$defs/parameter/properties/required/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"}];
return false;
}
var valid10 = _errs53 === errors;
}
else {
var valid10 = true;
}
}
}
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/parameters/" + i0,schemaPath:"defs.schema.json#/$defs/parameter/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid8 = _errs43 === errors;
if(!valid8){
break;
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/parameters",schemaPath:"#/properties/parameters/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs41 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.examples !== undefined){
var _errs55 = errors;
if(!(Array.isArray(data.examples))){
validate30.errors = [{instancePath:instancePath+"/examples",schemaPath:"#/properties/examples/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
var valid0 = _errs55 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.telemetry !== undefined){
var data22 = data.telemetry;
var _errs57 = errors;
var _errs58 = errors;
if(errors === _errs58){
if(data22 && typeof data22 == "object" && !Array.isArray(data22)){
if(data22.emitsProgressEvents !== undefined){
var _errs61 = errors;
if(typeof data22.emitsProgressEvents !== "boolean"){
validate30.errors = [{instancePath:instancePath+"/telemetry/emitsProgressEvents",schemaPath:"defs.schema.json#/$defs/telemetry/properties/emitsProgressEvents/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"}];
return false;
}
var valid12 = _errs61 === errors;
}
else {
var valid12 = true;
}
if(valid12){
if(data22.metrics !== undefined){
var data24 = data22.metrics;
var _errs63 = errors;
if(errors === _errs63){
if(Array.isArray(data24)){
var valid13 = true;
var len1 = data24.length;
for(var i1=0; i1<len1; i1++){
var _errs65 = errors;
if(typeof data24[i1] !== "string"){
validate30.errors = [{instancePath:instancePath+"/telemetry/metrics/" + i1,schemaPath:"defs.schema.json#/$defs/telemetry/properties/metrics/items/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid13 = _errs65 === errors;
if(!valid13){
break;
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/telemetry/metrics",schemaPath:"defs.schema.json#/$defs/telemetry/properties/metrics/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid12 = _errs63 === errors;
}
else {
var valid12 = true;
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/telemetry",schemaPath:"defs.schema.json#/$defs/telemetry/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs57 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.security !== undefined){
var data26 = data.security;
var _errs67 = errors;
var _errs68 = errors;
if(errors === _errs68){
if(data26 && typeof data26 == "object" && !Array.isArray(data26)){
if(data26.requiresSecrets !== undefined){
if(typeof data26.requiresSecrets !== "boolean"){
validate30.errors = [{instancePath:instancePath+"/security/requiresSecrets",schemaPath:"defs.schema.json#/$defs/security/properties/requiresSecrets/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"}];
return false;
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/security",schemaPath:"defs.schema.json#/$defs/security/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs67 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.contracts !== undefined){
var data28 = data.contracts;
var _errs73 = errors;
var _errs74 = errors;
if(errors === _errs74){
if(data28 && typeof data28 == "object" && !Array.isArray(data28)){
if(data28.idempotent !== undefined){
var _errs77 = errors;
if(typeof data28.idempotent !== "boolean"){
validate30.errors = [{instancePath:instancePath+"/contracts/idempotent",schemaPath:"defs.schema.json#/$defs/contracts/properties/idempotent/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"}];
return false;
}
var valid17 = _errs77 === errors;
}
else {
var valid17 = true;
}
if(valid17){
if(data28.sideEffects !== undefined){
var _errs79 = errors;
if(typeof data28.sideEffects !== "string"){
validate30.errors = [{instancePath:instancePath+"/contracts/sideEffects",schemaPath:"defs.schema.json#/$defs/contracts/properties/sideEffects/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid17 = _errs79 === errors;
}
else {
var valid17 = true;
}
}
}
else {
validate30.errors = [{instancePath:instancePath+"/contracts",schemaPath:"defs.schema.json#/$defs/contracts/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs73 === errors;
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
