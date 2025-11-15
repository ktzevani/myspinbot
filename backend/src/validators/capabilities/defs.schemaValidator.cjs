"use strict";
module.exports = validate30;
module.exports.default = validate30;
var schema42 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"defs.schema.json","type":"object","properties":{},"title":"SharedDefinitions","$defs":{"jsonSchemaFragment":{"type":"object","description":"JSON Schema fragment describing a payload shape. Used for capability input/output validation.","additionalProperties":true},"parameter":{"type":"object","description":"Optional structured parameter definition for a capability, including name, type, description and whether it is required.","properties":{"name":{"type":"string","description":"Parameter name."},"type":{"type":"string","description":"Expected parameter data type (string, number, boolean, etc.)."},"description":{"type":"string","description":"Human-readable explanation of the parameter."},"required":{"type":"boolean","description":"Whether the parameter must be provided by the caller."},"default":{"description":"Optional default value used if the parameter is omitted."}},"required":["name","type"],"additionalProperties":true},"handler":{"type":"object","title":"Handler Binding","description":"Information about the concrete module and method implementing this capability.","properties":{"module":{"type":"string","description":"Path to the module exporting the resolver."},"method":{"type":"string","description":"Exported method or function name to invoke."}},"required":["module","method"],"additionalProperties":false},"runtime":{"type":"object","title":"Runtime Configuration","description":"Execution environment metadata governing where and how the capability is run.","properties":{"kind":{"type":"string","description":"Execution plane: cpu or gpu. Node-plane capabilities always use cpu.","enum":["cpu","gpu"]},"timeoutSeconds":{"type":"number","description":"Execution timeout guard in seconds."},"concurrency":{"type":"number","description":"Maximum allowed concurrent invocations."}},"required":["kind","concurrency"],"additionalProperties":true},"telemetry":{"type":"object","title":"Telemetry Description","description":"Optional telemetry behavior: progress events, emitted metrics, and other runtime instrumentation.","properties":{"emitsProgressEvents":{"type":"boolean","description":"Whether this capability emits progress events."},"metrics":{"type":"array","description":"List of metric identifiers emitted during execution.","items":{"type":"string"}}},"additionalProperties":true},"security":{"type":"object","title":"Security Requirements","description":"Security markings describing whether secrets or scoped credentials are required.","properties":{"requiresSecrets":{"type":"boolean","description":"Whether this capability requires access to secrets or secure credentials."}},"additionalProperties":true},"contracts":{"type":"object","title":"Operational Contracts","description":"Operational guarantees: idempotency, side effects, determinism, etc.","properties":{"idempotent":{"type":"boolean","description":"Whether invoking the capability multiple times produces the same result."},"sideEffects":{"type":"string","description":"Description of any operational side effects (e.g., persistent-storage-write)."}},"additionalProperties":true}}};

function validate30(data, valCxt){
"use strict"; /*# sourceURL="defs.schema.json" */;
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
if(!(data && typeof data == "object" && !Array.isArray(data))){
validate30.errors = [{instancePath:instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
validate30.errors = vErrors;
return errors === 0;
}
validate30.evaluated = {"dynamicProps":false,"dynamicItems":false};
