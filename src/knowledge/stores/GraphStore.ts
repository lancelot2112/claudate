import {
  IGraphStore,
  GraphNode,
  GraphRelationship,
  GraphPath,
  GraphResult,
  VectorStoreError
} from '../../types/Knowledge.js';
import logger from '../../utils/logger.js';

export interface GraphStoreConfig {
  persistToDisk?: boolean;
  persistenceFile?: string;
  maxNodes?: number;
  maxRelationships?: number;
  enableIndexing?: boolean;
}

interface InternalNode extends GraphNode {
  incomingRelationships: Map<string, GraphRelationship>;
  outgoingRelationships: Map<string, GraphRelationship>;
}

export class GraphStore implements IGraphStore {
  private nodes: Map<string, InternalNode> = new Map();
  private relationshipIndex: Map<string, Set<string>> = new Map(); // type -> node IDs
  private config: GraphStoreConfig;
  private isInitialized = false;

  constructor(config: GraphStoreConfig = {}) {
    this.config = {
      persistToDisk: false,
      persistenceFile: 'graph_store.json',
      maxNodes: 100000,
      maxRelationships: 500000,
      enableIndexing: true,
      ...config
    };

    logger.info('GraphStore initialized', { config: this.config });
  }

  public async initialize(): Promise<void> {
    try {
      if (this.config.persistToDisk && this.config.persistenceFile) {
        await this.loadFromDisk();
      }
      
      this.isInitialized = true;
      logger.info('GraphStore initialization completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize GraphStore', { error: errorMessage });
      throw new VectorStoreError(`Failed to initialize graph store: ${errorMessage}`);
    }
  }

  public async shutdown(): Promise<void> {
    try {
      if (this.config.persistToDisk && this.config.persistenceFile) {
        await this.saveToDisk();
      }
      
      this.isInitialized = false;
      logger.info('GraphStore shutdown completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error during GraphStore shutdown', { error: errorMessage });
      throw new VectorStoreError(`Shutdown failed: ${errorMessage}`);
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      return this.isInitialized && this.nodes.size >= 0;
    } catch (error) {
      logger.error('GraphStore health check failed', { error: error.message });
      return false;
    }
  }

  public async addNode(id: string, type: string, properties: Record<string, any>): Promise<void> {
    if (!this.isInitialized) {
      throw new VectorStoreError('GraphStore not initialized');
    }

    if (this.config.maxNodes && this.nodes.size >= this.config.maxNodes) {
      throw new VectorStoreError(`Maximum nodes limit reached: ${this.config.maxNodes}`);
    }

    try {
      const existingNode = this.nodes.get(id);
      
      const node: InternalNode = {
        id,
        type,
        properties: { ...properties },
        relationships: [],
        incomingRelationships: existingNode?.incomingRelationships || new Map(),
        outgoingRelationships: existingNode?.outgoingRelationships || new Map()
      };

      this.nodes.set(id, node);

      // Update type index
      if (this.config.enableIndexing) {
        if (!this.relationshipIndex.has(type)) {
          this.relationshipIndex.set(type, new Set());
        }
        this.relationshipIndex.get(type)!.add(id);
      }

      logger.debug('Node added to graph store', { nodeId: id, type });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to add node to graph store', { nodeId: id, error: errorMessage });
      throw new VectorStoreError(`Failed to add node: ${errorMessage}`);
    }
  }

  public async addEdge(
    fromId: string, 
    toId: string, 
    type: string, 
    properties: Record<string, any> = {}
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new VectorStoreError('GraphStore not initialized');
    }

    try {
      const fromNode = this.nodes.get(fromId);
      const toNode = this.nodes.get(toId);

      if (!fromNode) {
        throw new VectorStoreError(`Source node not found: ${fromId}`);
      }
      if (!toNode) {
        throw new VectorStoreError(`Target node not found: ${toId}`);
      }

      const relationshipId = `${fromId}-${type}-${toId}`;
      const relationship: GraphRelationship = {
        id: relationshipId,
        type,
        targetId: toId,
        properties
      };

      // Add to outgoing relationships of source node
      fromNode.outgoingRelationships.set(relationshipId, relationship);
      
      // Add to incoming relationships of target node
      const incomingRelationship: GraphRelationship = {
        id: relationshipId,
        type,
        targetId: fromId, // For incoming, the target is the source
        properties
      };
      toNode.incomingRelationships.set(relationshipId, incomingRelationship);

      // Update the relationships array for external API compatibility
      fromNode.relationships = Array.from(fromNode.outgoingRelationships.values());
      toNode.relationships = Array.from(toNode.incomingRelationships.values())
        .concat(Array.from(toNode.outgoingRelationships.values()));

      logger.debug('Edge added to graph store', { fromId, toId, type });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to add edge to graph store', { 
        fromId, 
        toId, 
        type,
        error: errorMessage 
      });
      throw new VectorStoreError(`Failed to add edge: ${errorMessage}`);
    }
  }

  public async getNode(id: string): Promise<GraphNode | null> {
    if (!this.isInitialized) {
      throw new VectorStoreError('GraphStore not initialized');
    }

    try {
      const node = this.nodes.get(id);
      if (!node) {
        return null;
      }

      // Convert internal node to external format
      return {
        id: node.id,
        type: node.type,
        properties: { ...node.properties },
        relationships: Array.from(node.outgoingRelationships.values())
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get node from graph store', { nodeId: id, error: errorMessage });
      throw new VectorStoreError(`Failed to get node: ${errorMessage}`);
    }
  }

  public async getRelated(
    id: string, 
    relationshipType?: string, 
    depth = 1
  ): Promise<GraphNode[]> {
    if (!this.isInitialized) {
      throw new VectorStoreError('GraphStore not initialized');
    }

    try {
      const visited = new Set<string>();
      const result: GraphNode[] = [];
      
      await this.traverseGraph(id, relationshipType, depth, visited, result);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get related nodes', { 
        nodeId: id, 
        relationshipType,
        depth,
        error: errorMessage 
      });
      throw new VectorStoreError(`Failed to get related nodes: ${errorMessage}`);
    }
  }

  public async findPath(
    fromId: string, 
    toId: string, 
    maxDepth = 6
  ): Promise<GraphPath | null> {
    if (!this.isInitialized) {
      throw new VectorStoreError('GraphStore not initialized');
    }

    try {
      return await this.breadthFirstSearch(fromId, toId, maxDepth);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to find path between nodes', { 
        fromId, 
        toId, 
        maxDepth,
        error: errorMessage 
      });
      throw new VectorStoreError(`Failed to find path: ${errorMessage}`);
    }
  }

  public async queryGraph(query: string): Promise<GraphResult[]> {
    if (!this.isInitialized) {
      throw new VectorStoreError('GraphStore not initialized');
    }

    try {
      // Simple query implementation - in production, you'd want a proper query language
      const results: GraphResult[] = [];
      const queryLower = query.toLowerCase();

      for (const [nodeId, node] of this.nodes) {
        let matches = false;

        // Check if query matches node type
        if (node.type.toLowerCase().includes(queryLower)) {
          matches = true;
        }

        // Check if query matches any property values
        for (const [key, value] of Object.entries(node.properties)) {
          if (typeof value === 'string' && value.toLowerCase().includes(queryLower)) {
            matches = true;
            break;
          }
        }

        if (matches) {
          results.push({
            nodes: [{
              id: node.id,
              type: node.type,
              properties: { ...node.properties },
              relationships: Array.from(node.outgoingRelationships.values())
            }],
            relationships: Array.from(node.outgoingRelationships.values()),
            metadata: {
              matchType: 'node',
              score: this.calculateMatchScore(node, queryLower)
            }
          });
        }
      }

      // Sort by relevance score
      results.sort((a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0));

      logger.debug('Graph query executed', { 
        query: query.substring(0, 50), 
        results: results.length 
      });

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Graph query failed', { query, error: errorMessage });
      throw new VectorStoreError(`Graph query failed: ${errorMessage}`);
    }
  }

  public async deleteNode(id: string): Promise<void> {
    if (!this.isInitialized) {
      throw new VectorStoreError('GraphStore not initialized');
    }

    try {
      const node = this.nodes.get(id);
      if (!node) {
        return; // Node doesn't exist, nothing to delete
      }

      // Remove all incoming relationships from other nodes
      for (const [relationshipId, relationship] of node.incomingRelationships) {
        const sourceNode = this.nodes.get(relationship.targetId);
        if (sourceNode) {
          sourceNode.outgoingRelationships.delete(relationshipId);
          sourceNode.relationships = Array.from(sourceNode.outgoingRelationships.values());
        }
      }

      // Remove all outgoing relationships to other nodes
      for (const [relationshipId, relationship] of node.outgoingRelationships) {
        const targetNode = this.nodes.get(relationship.targetId);
        if (targetNode) {
          targetNode.incomingRelationships.delete(relationshipId);
          targetNode.relationships = Array.from(targetNode.incomingRelationships.values())
            .concat(Array.from(targetNode.outgoingRelationships.values()));
        }
      }

      // Remove from type index
      if (this.config.enableIndexing) {
        const typeNodes = this.relationshipIndex.get(node.type);
        if (typeNodes) {
          typeNodes.delete(id);
          if (typeNodes.size === 0) {
            this.relationshipIndex.delete(node.type);
          }
        }
      }

      // Delete the node
      this.nodes.delete(id);

      logger.debug('Node deleted from graph store', { nodeId: id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete node from graph store', { nodeId: id, error: errorMessage });
      throw new VectorStoreError(`Failed to delete node: ${errorMessage}`);
    }
  }

  public async deleteEdge(fromId: string, toId: string, type: string): Promise<void> {
    if (!this.isInitialized) {
      throw new VectorStoreError('GraphStore not initialized');
    }

    try {
      const fromNode = this.nodes.get(fromId);
      const toNode = this.nodes.get(toId);

      if (!fromNode || !toNode) {
        return; // Nodes don't exist, nothing to delete
      }

      const relationshipId = `${fromId}-${type}-${toId}`;

      // Remove from outgoing relationships of source node
      fromNode.outgoingRelationships.delete(relationshipId);
      fromNode.relationships = Array.from(fromNode.outgoingRelationships.values());

      // Remove from incoming relationships of target node
      toNode.incomingRelationships.delete(relationshipId);
      toNode.relationships = Array.from(toNode.incomingRelationships.values())
        .concat(Array.from(toNode.outgoingRelationships.values()));

      logger.debug('Edge deleted from graph store', { fromId, toId, type });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete edge from graph store', { 
        fromId, 
        toId, 
        type,
        error: errorMessage 
      });
      throw new VectorStoreError(`Failed to delete edge: ${errorMessage}`);
    }
  }

  private async traverseGraph(
    nodeId: string,
    relationshipType: string | undefined,
    depth: number,
    visited: Set<string>,
    result: GraphNode[]
  ): Promise<void> {
    if (depth <= 0 || visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    const node = this.nodes.get(nodeId);
    
    if (!node) {
      return;
    }

    // Add current node if it's not the starting node
    if (result.length > 0 || visited.size > 1) {
      result.push({
        id: node.id,
        type: node.type,
        properties: { ...node.properties },
        relationships: Array.from(node.outgoingRelationships.values())
      });
    }

    // Traverse outgoing relationships
    for (const [_, relationship] of node.outgoingRelationships) {
      if (!relationshipType || relationship.type === relationshipType) {
        await this.traverseGraph(relationship.targetId, relationshipType, depth - 1, visited, result);
      }
    }
  }

  private async breadthFirstSearch(
    fromId: string, 
    toId: string, 
    maxDepth: number
  ): Promise<GraphPath | null> {
    if (fromId === toId) {
      const node = await this.getNode(fromId);
      return node ? {
        nodes: [node],
        relationships: [],
        length: 0,
        weight: 0
      } : null;
    }

    const queue: Array<{
      nodeId: string;
      path: GraphNode[];
      relationships: GraphRelationship[];
      depth: number;
    }> = [];

    const visited = new Set<string>();
    const startNode = await this.getNode(fromId);
    
    if (!startNode) {
      return null;
    }

    queue.push({
      nodeId: fromId,
      path: [startNode],
      relationships: [],
      depth: 0
    });

    visited.add(fromId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (current.depth >= maxDepth) {
        continue;
      }

      const currentNode = this.nodes.get(current.nodeId);
      if (!currentNode) {
        continue;
      }

      for (const [_, relationship] of currentNode.outgoingRelationships) {
        if (visited.has(relationship.targetId)) {
          continue;
        }

        const targetNode = await this.getNode(relationship.targetId);
        if (!targetNode) {
          continue;
        }

        const newPath = [...current.path, targetNode];
        const newRelationships = [...current.relationships, relationship];

        if (relationship.targetId === toId) {
          return {
            nodes: newPath,
            relationships: newRelationships,
            length: newPath.length - 1,
            weight: newRelationships.length
          };
        }

        visited.add(relationship.targetId);
        queue.push({
          nodeId: relationship.targetId,
          path: newPath,
          relationships: newRelationships,
          depth: current.depth + 1
        });
      }
    }

    return null;
  }

  private calculateMatchScore(node: InternalNode, query: string): number {
    let score = 0;

    // Exact type match
    if (node.type.toLowerCase() === query) {
      score += 100;
    } else if (node.type.toLowerCase().includes(query)) {
      score += 50;
    }

    // Property matches
    for (const [key, value] of Object.entries(node.properties)) {
      if (typeof value === 'string') {
        const valueLower = value.toLowerCase();
        if (valueLower === query) {
          score += 75;
        } else if (valueLower.includes(query)) {
          score += 25;
        }
      }
    }

    return score;
  }

  private async loadFromDisk(): Promise<void> {
    try {
      if (!this.config.persistenceFile) {
        return;
      }

      const fs = await import('fs/promises');
      const data = await fs.readFile(this.config.persistenceFile, 'utf-8');
      const graphData = JSON.parse(data);

      // Restore nodes
      for (const nodeData of graphData.nodes || []) {
        const node: InternalNode = {
          ...nodeData,
          incomingRelationships: new Map(),
          outgoingRelationships: new Map()
        };
        this.nodes.set(node.id, node);
      }

      // Restore relationships
      for (const edgeData of graphData.edges || []) {
        await this.addEdge(edgeData.fromId, edgeData.toId, edgeData.type, edgeData.properties);
      }

      logger.info('Graph data loaded from disk', { 
        nodes: this.nodes.size,
        file: this.config.persistenceFile 
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('No persistence file found, starting with empty graph');
      } else {
        logger.error('Failed to load graph data from disk', { error: error.message });
      }
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      if (!this.config.persistenceFile) {
        return;
      }

      const fs = await import('fs/promises');
      
      const nodes = Array.from(this.nodes.values()).map(node => ({
        id: node.id,
        type: node.type,
        properties: node.properties
      }));

      const edges: any[] = [];
      for (const [nodeId, node] of this.nodes) {
        for (const [_, relationship] of node.outgoingRelationships) {
          edges.push({
            fromId: nodeId,
            toId: relationship.targetId,
            type: relationship.type,
            properties: relationship.properties
          });
        }
      }

      const graphData = { nodes, edges };
      await fs.writeFile(this.config.persistenceFile, JSON.stringify(graphData, null, 2));

      logger.info('Graph data saved to disk', { 
        nodes: nodes.length,
        edges: edges.length,
        file: this.config.persistenceFile 
      });
    } catch (error) {
      logger.error('Failed to save graph data to disk', { error: error.message });
    }
  }

  public getStats(): {
    nodeCount: number;
    relationshipCount: number;
    typeDistribution: Record<string, number>;
  } {
    const typeDistribution: Record<string, number> = {};
    let relationshipCount = 0;

    for (const [_, node] of this.nodes) {
      typeDistribution[node.type] = (typeDistribution[node.type] || 0) + 1;
      relationshipCount += node.outgoingRelationships.size;
    }

    return {
      nodeCount: this.nodes.size,
      relationshipCount,
      typeDistribution
    };
  }
}

export default GraphStore;