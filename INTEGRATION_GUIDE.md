# Journey Mapper API & MCP Integration Guide

This guide details how external applications and AI agents can interact with the **Journey Mapper** system. The system exposes a dual interface: a standard **REST API** for traditional applications and a **Model Context Protocol (MCP)** server for AI agents.

## System Architecture

The core of the system is the **Journey Mapper API**, which manages the lifecycle of a user journey map. It handles:
- **Phases**: Horizontal time-slices (e.g., "Research", "Implementation").
- **Swimlanes**: Vertical categories or actors (e.g., "User", "System", "Pain Points").
- **Cells**: The intersection of a Phase and a Swimlane, containing specific actions and context.
- **Metrics**: Real-time calculation of completeness.

### Directory Structure
```
/
├── api-mcp/           # Core Backend
│   ├── src/
│   │   ├── server.ts      # REST API (Fastify)
│   │   ├── mcp-server.ts  # MCP Tool Wrapper
│   │   └── types.ts       # Domain Models (Zod)
│   └── API-MCP.MD         # Technical Specification
└── front-end/         # Reference UI Implementation
```

---

## 1. REST API Guide (For Applications)

**Base URL**: `http://localhost:3001` (Default)
**Swagger Docs**: `http://localhost:3001/docs`

### Key Workflows

#### A. Creating a Journey
To start a new session, create a journey map. The `sessionId` allows you to link this journey to a specific user session in your app.
```bash
POST /v1/journey-maps
{
  "name": "Onboarding Journey",
  "role": "New Employee",
  "sessionId": "user-session-123"
}
```

#### B. Defining Structure (Phases & Swimlanes)
You can add phases and swimlanes individually or in bulk. This defines the grid.
```bash
# Add a Phase
POST /v1/journey-maps/{id}/phases
{ "name": "Day 1", "description": "Orientation and Setup" }

# Add a Swimlane
POST /v1/journey-maps/{id}/swimlanes
{ "name": "HR System", "description": "portals and paperwork" }
```

#### C. Generating the Matrix
Once phases and swimlanes are defined, generate the empty cells. This ensures every intersection exists.
```bash
POST /v1/journey-maps/{id}:generate-matrix
{}
```

#### D. Updating Cells (Real-time Interaction)
As a user describes an action, update the specific cell. The API recalculates metrics automatically.
```bash
PUT /v1/journey-maps/{id}/cells/{cellId}
{
  "action": "Uploads ID documents",
  "context": "User complained about file size limits."
}
```

#### E. Visualization
The API returns a `mermaid` object in the response of `generate-artifacts`, which contains Mermaid.js code for rendering the journey map visually.

---

## 2. MCP Guide (For AI Agents)

The **Model Context Protocol (MCP)** server wraps the REST API, allowing AI models (like Claude, Gemini, or custom agents) to "drive" the creation of a journey map using tools.

**Tool Prefix**: None (Tools are top-level)

### The "Rigid Interviewer" Pattern
The MCP tools are designed to support a specific interaction flow where the AI acts as an interviewer.

1.  **`create_journey_map`**: Call this first when the user provides their name and role.
2.  **`update_journey_metadata`**: Call this when the user describes the high-level journey goal.
3.  **`set_phases_bulk`**: Call this after asking the user "What are the high-level steps?". The AI should verify the list before calling this.
4.  **`set_swimlanes_bulk`**: Call this after asking "Who are the actors or what systems are involved?".
5.  **`generate_matrix`**: Call this immediately after phases and swimlanes are set. It's an internal housekeeping step.
6.  **`update_cell`**: The AI should iterate through the grid (mentally) and ask specific questions (e.g., "What does the HR System do on Day 1?"). Use this tool to save the answer.
7.  **`generate_artifacts`**: Call this when `percentCellsComplete` (in the `get_journey_map` response) reaches 100% or the user is done.

### Tool Reference

| Tool Name | Description | Key Inputs |
| :--- | :--- | :--- |
| `create_journey_map` | Initialize a blank map | `name`, `role`, `context` |
| `get_journey_map` | Read current state & metrics | `journeyMapId` |
| `add_phase` / `set_phases_bulk` | Define horizontal steps | `name`, `description` |
| `add_swimlane` / `set_swimlanes_bulk` | Define vertical actors | `name`, `description` |
| `update_cell` | Fill a specific intersection | `cellId`, `action`, `context` |
| `generate_artifacts` | Finalize and get visual code | `journeyMapId` |

---

## 3. Data Domain Model

### Phase vs. Step
- **Phase**: A distinct period of time (horizontal axis).
- **Swimlane**: A category or actor (vertical axis).

### Completion Logic
The system tracks completeness automatically.
- **Cell Complete**: Needs both an `action` (what happened) and `context` (details/nuance).
- **Journey Complete**: When all expected cells (Phases × Swimlanes) are complete.

## 4. Vertex AI Configuration (Canonical)

As of February 2026, this project is optimized for the **Gemini 3.0** family on Google Cloud Vertex AI.

### Recommended Models
*   **Agentic Logic (Driver)**: `gemini-3.0-pro`
    *   *Why:* State-of-the-art reasoning for complex workflows and strict instruction following ("Rigid Interviewer").
    *   *Availability:* Stable in AI Studio, Preview in Vertex AI.
*   **High-Volume/Speed**: `gemini-3.0-flash`
    *   *Why:* Optimized for speed and cost-efficiency.

### Fallback Strategy
If `gemini-3.0-pro` is unavailable in your specific GCP region (e.g., specific `us-central1` rollout constraints), fallback to the **Gemini 2.5** stable family:
*   `gemini-2.5-pro-002`
*   `gemini-2.5-flash-002`

*Note: Gemini 2.0 models are scheduled for retirement.*
