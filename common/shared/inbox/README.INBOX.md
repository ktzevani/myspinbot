# 📥 Agent Coordination Inbox

This directory serves as the **centralized mailbox** and **asynchronous signal hub** for the orchestration of agents within this monorepo.

## 🎯 Purpose
To facilitate inter-agent communication and task handoffs via a "Blackboard" or "Mailbox" pattern. Agents write JSON-structured signals here to notify other agents of completed work, pending tasks, or system status changes.

## 📜 Protocol (The "Mailbox" Rules)

### 1. File Naming Convention
To prevent collisions and maintain a temporal log, all signals must follow this format:
`signal_[ISO_TIMESTAMP]_[FROM_AGENT]_to_[TO_AGENT].json`
*Example:* `signal_20260106T1230Z_backend_to_ml.json`

### 2. Standard Schema
Messages should be valid JSON and contain at least the following keys:
```json
{
  "type": "HANDOFF | NOTIFY | ERROR",
  "from": "agent-name",
  "to": "target-agent-name | all",
  "payload": {
    "status": "success | pending",
    "artifacts": ["path/to/output/files"],
    "message": "Human-readable summary of the action.",
    ...
  },
  "timestamp": "ISO-8601"
}
```

## 🤖 For Agents
Check this directory before beginning a new task to see if there are pending "HANDOFF" signals addressed to you.

Clean up your own processed signals once acknowledged, or move them to an archive/ subfolder.

Do not store large datasets here; only store pointers (file paths) to datasets.

> Note: This directory is shared across all Dev Containers via Docker volumes.