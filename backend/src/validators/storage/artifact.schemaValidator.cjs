"use strict";
module.exports = validate30;
module.exports.default = validate30;
var schema42 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"artifact.schema.json","title":"Artifact Schemas","type":"object","$defs":{"ArtifactMeta":{"type":"object","title":"ArtifactMeta","description":"Metadata for artifacts uploaded to MinIO (e.g. LoRA, voice, video).","properties":{"bucket":{"type":"string","description":"MinIO bucket where the artifact is stored."},"key":{"type":"string","description":"Object key inside the MinIO bucket."},"size_bytes":{"type":"integer","description":"Size of the artifact in bytes."},"created_at":{"type":"string","format":"date-time","description":"Timestamp when the artifact was created."},"content_type":{"type":["string","null"],"description":"Optional MIME type of the artifact (e.g. 'image/png')."}},"required":["bucket","key","size_bytes","created_at"],"additionalProperties":false},"ArtifactUploadResult":{"type":"object","title":"ArtifactUploadResult","description":"Result of a successful artifact upload.","properties":{"ok":{"type":"boolean","description":"Indicates whether the upload was successful."},"meta":{"$ref":"#/$defs/ArtifactMeta"}},"required":["ok","meta"],"additionalProperties":false}}};

function validate30(data, valCxt){
"use strict"; /*# sourceURL="artifact.schema.json" */;
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
