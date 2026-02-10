export const JOURNEY_TOOLS = [
    {
        functionDeclarations: [
            {
                name: "create_journey_map",
                description: "Initialize a new journey map when the user provides their name and role.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        name: { type: "STRING", description: "Name of the journey/project (e.g. 'Draft')" },
                        userName: { type: "STRING", description: "The User's Name" },
                        role: { type: "STRING", description: "User's role" },
                        description: { type: "STRING", description: "Any extra context provided" }
                    },
                    required: ["name", "userName", "role"]
                }
            },
            {
                name: "update_journey_metadata",
                description: "Update the journey name and description after the user explains the process.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        journeyMapId: { type: "STRING" },
                        name: { type: "STRING", description: "Succinct journey name" },
                        description: { type: "STRING", description: "Detailed description/context" }
                    },
                    required: ["journeyMapId", "name"]
                }
            },
            {
                name: "set_phases_bulk",
                description: "Set the list of high-level phases (steps) for the journey.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        journeyMapId: { type: "STRING" },
                        phases: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    name: { type: "STRING" },
                                    description: { type: "STRING" }
                                },
                                required: ["name", "description"]
                            }
                        }
                    },
                    required: ["journeyMapId", "phases"]
                }
            },
            {
                name: "set_swimlanes_bulk",
                description: "Set the list of actors/swimlanes.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        journeyMapId: { type: "STRING" },
                        swimlanes: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    name: { type: "STRING" },
                                    description: { type: "STRING" }
                                },
                                required: ["name", "description"]
                            }
                        }
                    },
                    required: ["journeyMapId", "swimlanes"]
                }
            },
            {
                name: "generate_matrix",
                description: "Generate the empty cell grid. Call this immediately after setting phases and swimlanes.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        journeyMapId: { type: "STRING" }
                    },
                    required: ["journeyMapId"]
                }
            },
            {
                name: "update_cell",
                description: "Save content for a specific cell intersection. You MUST identify the cell by its cellId (UUID) from the journeyState.cells array.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        journeyMapId: { type: "STRING" },
                        cellId: { type: "STRING", description: "The UUID of the cell from journeyState.cells (REQUIRED)" },
                        headline: { type: "STRING", description: "Succinct title/headline for the intersection (e.g. 'Data Entry')" },
                        description: { type: "STRING", description: "Detailed description of what happens based ONLY on user input. Do not Hallucinate." },
                        context: { type: "STRING", description: "Any extra spillover notes or raw details." }
                    },
                    required: ["journeyMapId", "cellId", "headline", "description"]
                }
            },
            {
                name: "generate_artifacts",
                description: "Finalize the journey. You MUST provide 'summaryOfFindings' and 'mentalModels' based on the conversation.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        journeyMapId: { type: "STRING" },
                        summaryOfFindings: { type: "STRING", description: "Comprehensive summary of findings" },
                        mentalModels: { type: "STRING", description: "Identified mental models" },
                        quotes: { 
                            type: "ARRAY", 
                            description: "2-5 most interesting verbatim direct quotes from the participant's chat messages",
                            items: { type: "STRING" }
                        },
                        anythingElse: { type: "STRING", description: "Any final additions from the user" }
                    },
                    required: ["journeyMapId", "summaryOfFindings", "mentalModels", "quotes"]
                }
            }
        ]
    }
];
