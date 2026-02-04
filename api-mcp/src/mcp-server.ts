import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Config
const API_BASE_URL = process.env.JOURNEY_API_BASE_URL || 'http://localhost:3001';

async function callApi(method: string, path: string, body?: any) {
  const headers: any = { 'Content-Type': 'application/json' };
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// Helper for formatted output
function formatOutput(data: any) {
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(data, null, 2)
            }
        ]
    };
}

const server = new Server(
  {
    name: 'journey-map-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_journey_map',
        description: 'Create a new Journey Map',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            role: { type: 'string' },
            context: { type: 'string' },
            sessionId: { type: 'string' },
          },
          required: ['name', 'role'],
        },
      },
      {
        name: 'get_journey_map',
        description: 'Retrieve a Journey Map by ID',
        inputSchema: {
          type: 'object',
          properties: {
            journeyMapId: { type: 'string' },
          },
          required: ['journeyMapId'],
        },
      },
      {
        name: 'update_journey_metadata',
        description: 'Update top-level metadata (name, role, context, flags)',
        inputSchema: {
          type: 'object',
          properties: {
            journeyMapId: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' },
            context: { type: 'string' },
            arePhasesComplete: { type: 'boolean' },
            areSwimlanesComplete: { type: 'boolean' }
          },
          required: ['journeyMapId'],
        },
      },
      {
        name: 'add_phase',
        description: 'Add a single Phase (Step) to the journey',
        inputSchema: {
          type: 'object',
          properties: {
            journeyMapId: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            context: { type: 'string' },
          },
          required: ['journeyMapId', 'name', 'description'],
        },
      },
      {
        name: 'update_phase',
        description: 'Update an existing Phase',
        inputSchema: {
          type: 'object',
          properties: {
            journeyMapId: { type: 'string' },
            phaseId: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            context: { type: 'string' },
          },
          required: ['journeyMapId', 'phaseId'],
        },
      },
      {
        name: 'remove_phase',
        description: 'Remove a Phase',
        inputSchema: {
            type: 'object',
            properties: {
                journeyMapId: { type: 'string' },
                phaseId: { type: 'string' }
            },
            required: ['journeyMapId', 'phaseId']
        }
      },
      {
        name: 'set_phases_bulk',
        description: 'Replace ALL phases with a new ordered list',
        inputSchema: {
          type: 'object',
          properties: {
            journeyMapId: { type: 'string' },
            phases: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  context: { type: 'string' },
                },
                required: ['name', 'description'],
              },
            },
          },
          required: ['journeyMapId', 'phases'],
        },
      },
      {
        name: 'add_swimlane',
        description: 'Add a single Swimlane (Actor/System)',
        inputSchema: {
          type: 'object',
          properties: {
            journeyMapId: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            context: { type: 'string' },
          },
          required: ['journeyMapId', 'name', 'description'],
        },
      },
      {
        name: 'update_swimlane',
        description: 'Update an existing Swimlane',
        inputSchema: {
          type: 'object',
          properties: {
            journeyMapId: { type: 'string' },
            swimlaneId: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            context: { type: 'string' },
          },
          required: ['journeyMapId', 'swimlaneId'],
        },
      },
      {
        name: 'remove_swimlane',
        description: 'Remove a Swimlane',
        inputSchema: {
            type: 'object',
            properties: {
                journeyMapId: { type: 'string' },
                swimlaneId: { type: 'string' }
            },
            required: ['journeyMapId', 'swimlaneId']
        }
      },
      {
        name: 'set_swimlanes_bulk',
        description: 'Replace ALL swimlanes with a new ordered list',
        inputSchema: {
          type: 'object',
          properties: {
            journeyMapId: { type: 'string' },
            swimlanes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  context: { type: 'string' },
                },
                required: ['name', 'description'],
              },
            },
          },
          required: ['journeyMapId', 'swimlanes'],
        },
      },
      {
        name: 'generate_matrix',
        description: 'Generate the dense grid of cells based on current Phases and Swimlanes',
        inputSchema: {
          type: 'object',
          properties: {
            journeyMapId: { type: 'string' },
          },
          required: ['journeyMapId'],
        },
      },
      {
        name: 'update_cell',
        description: 'Update the content of a specific cell',
        inputSchema: {
          type: 'object',
          properties: {
            journeyMapId: { type: 'string' },
            cellId: { type: 'string' },
            action: { type: 'string' },
            context: { type: 'string' },
          },
          required: ['journeyMapId', 'cellId'],
        },
      },
      {
        name: 'generate_artifacts',
        description: 'Finalize the journey map and generate summaries/Mermaid code',
        inputSchema: {
          type: 'object',
          properties: {
            journeyMapId: { type: 'string' },
          },
          required: ['journeyMapId'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    // Safety cast for common ID pattern
    const params = args as any;

    try {
        switch (name) {
            case 'create_journey_map':
                return formatOutput(await callApi('POST', '/v1/journey-maps', params));
            
            case 'get_journey_map':
                return formatOutput(await callApi('GET', `/v1/journey-maps/${params.journeyMapId}`));
            
            case 'update_journey_metadata':
                return formatOutput(await callApi('PATCH', `/v1/journey-maps/${params.journeyMapId}`, params));
            
            case 'add_phase':
                return formatOutput(await callApi('POST', `/v1/journey-maps/${params.journeyMapId}/phases`, params));
            
            case 'update_phase':
                return formatOutput(await callApi('PUT', `/v1/journey-maps/${params.journeyMapId}/phases/${params.phaseId}`, params));
            
            case 'remove_phase':
                return formatOutput(await callApi('DELETE', `/v1/journey-maps/${params.journeyMapId}/phases/${params.phaseId}`));
            
            case 'set_phases_bulk':
                return formatOutput(await callApi('PUT', `/v1/journey-maps/${params.journeyMapId}/phases`, params));

            case 'add_swimlane':
                return formatOutput(await callApi('POST', `/v1/journey-maps/${params.journeyMapId}/swimlanes`, params));
            
            case 'update_swimlane':
                return formatOutput(await callApi('PUT', `/v1/journey-maps/${params.journeyMapId}/swimlanes/${params.swimlaneId}`, params));

            case 'remove_swimlane':
                return formatOutput(await callApi('DELETE', `/v1/journey-maps/${params.journeyMapId}/swimlanes/${params.swimlaneId}`));
            
            case 'set_swimlanes_bulk':
                return formatOutput(await callApi('PUT', `/v1/journey-maps/${params.journeyMapId}/swimlanes`, params));

            case 'generate_matrix':
                return formatOutput(await callApi('POST', `/v1/journey-maps/${params.journeyMapId}:generate-matrix`));

            case 'update_cell':
                return formatOutput(await callApi('PUT', `/v1/journey-maps/${params.journeyMapId}/cells/${params.cellId}`, params));

            case 'generate_artifacts':
                return formatOutput(await callApi('POST', `/v1/journey-maps/${params.journeyMapId}:generate-artifacts`));

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error: any) {
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true
        };
    }
});

const transport = new StdioServerTransport();
server.connect(transport).catch((err) => {
  console.error("MCP Server connection error:", err);
  process.exit(1);
});
