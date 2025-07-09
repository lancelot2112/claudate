import { EventEmitter } from 'events';
import { KnowledgeEntry } from '../types/Knowledge';
import logger from '../../utils/logger';

export interface KnowledgeEntity {
  id: string;
  type: 'person' | 'project' | 'concept' | 'document' | 'task' | 'decision' | 'metric';
  name: string;
  attributes: Record<string, any>;
  context: string;
  confidence: number; // 0-1
  lastUpdated: Date;
  source: string;
}

export interface Relationship {
  id: string;
  fromEntity: string;
  toEntity: string;
  type: 'contains' | 'depends_on' | 'related_to' | 'part_of' | 'influences' | 'assigned_to' | 'created_by';
  strength: number; // 0-1
  confidence: number; // 0-1
  metadata: {
    discoveryMethod: 'semantic' | 'explicit' | 'temporal' | 'behavioral';
    evidence: string[];
    context: string;
    discoveredAt: Date;
    lastConfirmed: Date;
  };
  bidirectional: boolean;
  temporalData?: {
    startDate?: Date;
    endDate?: Date;
    duration?: number;
    frequency?: number;
  };
}

export interface InferredRelationship extends Relationship {
  inferenceReason: string;
  inferenceConfidence: number;
  supportingEvidence: string[];
  requiresVerification: boolean;
}

export interface EntityExtractionResult {
  entities: KnowledgeEntity[];
  relationships: Relationship[];
  confidence: number;
  processingTime: number;
}

export interface RelationshipPattern {
  pattern: string;
  type: Relationship['type'];
  confidence: number;
  examples: string[];
}

export class RelationshipDiscovery extends EventEmitter {
  private entityCache: Map<string, KnowledgeEntity> = new Map();
  private relationshipCache: Map<string, Relationship> = new Map();
  private patterns: Map<string, RelationshipPattern> = new Map();
  private entityConfidenceThreshold: number = 0.6;
  private relationshipConfidenceThreshold: number = 0.5;

  constructor() {
    super();
    this.initializePatterns();
  }

  async initialize(): Promise<void> {
    logger.info('Relationship discovery system initialized');
  }

  /**
   * Discover relationships between entities from knowledge entries
   */
  async discoverEntityRelationships(entries: KnowledgeEntry[]): Promise<EntityExtractionResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting entity relationship discovery', {
        entryCount: entries.length,
      });

      // Step 1: Extract entities from knowledge entries
      const entities = await this.extractEntities(entries);

      // Step 2: Discover explicit relationships
      const explicitRelationships = await this.findExplicitRelationships(entities, entries);

      // Step 3: Infer implicit relationships
      const implicitRelationships = await this.inferImplicitRelationships(entities, entries);

      // Step 4: Merge and validate relationships
      const allRelationships = [...explicitRelationships, ...implicitRelationships];
      const validatedRelationships = this.validateRelationships(allRelationships);

      // Step 5: Update caches
      this.updateCaches(entities, validatedRelationships);

      const processingTime = Date.now() - startTime;
      const confidence = this.calculateOverallConfidence(entities, validatedRelationships);

      const result: EntityExtractionResult = {
        entities,
        relationships: validatedRelationships,
        confidence,
        processingTime,
      };

      this.emit('relationshipsDiscovered', {
        entityCount: entities.length,
        relationshipCount: validatedRelationships.length,
        confidence,
        processingTime,
      });

      logger.info('Entity relationship discovery completed', {
        entityCount: entities.length,
        relationshipCount: validatedRelationships.length,
        confidence,
        processingTime,
      });

      return result;
    } catch (error) {
      logger.error('Entity relationship discovery failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update the strength of an existing relationship
   */
  async updateRelationshipStrength(relationshipId: string, strength: number): Promise<void> {
    const relationship = this.relationshipCache.get(relationshipId);
    
    if (!relationship) {
      throw new Error(`Relationship not found: ${relationshipId}`);
    }

    const oldStrength = relationship.strength;
    relationship.strength = Math.max(0, Math.min(1, strength));
    relationship.metadata.lastConfirmed = new Date();

    this.relationshipCache.set(relationshipId, relationship);

    this.emit('relationshipUpdated', {
      relationshipId,
      oldStrength,
      newStrength: relationship.strength,
      type: relationship.type,
    });

    logger.info('Relationship strength updated', {
      relationshipId,
      oldStrength,
      newStrength: relationship.strength,
      type: relationship.type,
    });
  }

  /**
   * Infer implicit relationships from context and patterns
   */
  async inferImplicitRelationships(entities: KnowledgeEntity[], entries: KnowledgeEntry[]): Promise<InferredRelationship[]> {
    const inferred: InferredRelationship[] = [];

    // Temporal co-occurrence analysis
    const temporalRelationships = await this.findTemporalRelationships(entities, entries);
    inferred.push(...temporalRelationships);

    // Semantic similarity analysis
    const semanticRelationships = await this.findSemanticRelationships(entities);
    inferred.push(...semanticRelationships);

    // Pattern-based inference
    const patternRelationships = await this.findPatternBasedRelationships(entities, entries);
    inferred.push(...patternRelationships);

    // Hierarchical relationships
    const hierarchicalRelationships = await this.findHierarchicalRelationships(entities);
    inferred.push(...hierarchicalRelationships);

    return inferred.filter(rel => rel.inferenceConfidence >= this.relationshipConfidenceThreshold);
  }

  private async extractEntities(entries: KnowledgeEntry[]): Promise<KnowledgeEntity[]> {
    const entities: KnowledgeEntity[] = [];
    const entityMap = new Map<string, KnowledgeEntity>();

    for (const entry of entries) {
      const extractedEntities = await this.extractEntitiesFromEntry(entry);
      
      for (const entity of extractedEntities) {
        const existingEntity = entityMap.get(entity.name.toLowerCase());
        
        if (existingEntity) {
          // Merge entities with same name
          existingEntity.confidence = Math.max(existingEntity.confidence, entity.confidence);
          existingEntity.attributes = { ...existingEntity.attributes, ...entity.attributes };
          existingEntity.lastUpdated = new Date();
        } else {
          entityMap.set(entity.name.toLowerCase(), entity);
          entities.push(entity);
        }
      }
    }

    return entities.filter(entity => entity.confidence >= this.entityConfidenceThreshold);
  }

  private async extractEntitiesFromEntry(entry: KnowledgeEntry): Promise<KnowledgeEntity[]> {
    const entities: KnowledgeEntity[] = [];
    const content = entry.content.toLowerCase();

    // Person extraction
    const personPatterns = [
      /(?:@|user:|by\s+|assigned\s+to\s+|created\s+by\s+)([a-z\s]+?)(?:\s|$|,|\.)/gi,
      /(?:team\s+member|colleague|developer|manager|lead)\s+([a-z\s]+?)(?:\s|$|,|\.)/gi,
    ];

    for (const pattern of personPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const name = match[1].trim();
        if (name.length > 2 && name.length < 50) {
          entities.push(this.createEntity('person', name, entry, 0.7));
        }
      }
    }

    // Project extraction
    const projectPatterns = [
      /project\s+([a-z0-9\s-]+?)(?:\s|$|,|\.)/gi,
      /(?:working\s+on|part\s+of)\s+([a-z0-9\s-]+?)\s+project/gi,
    ];

    for (const pattern of projectPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const name = match[1].trim();
        if (name.length > 2 && name.length < 100) {
          entities.push(this.createEntity('project', name, entry, 0.8));
        }
      }
    }

    // Task extraction
    const taskPatterns = [
      /(?:task|todo|action\s+item):\s*([^.!?]+)/gi,
      /need\s+to\s+([^.!?]+)/gi,
      /should\s+([^.!?]+)/gi,
    ];

    for (const pattern of taskPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const name = match[1].trim();
        if (name.length > 5 && name.length < 200) {
          entities.push(this.createEntity('task', name, entry, 0.6));
        }
      }
    }

    // Decision extraction
    const decisionPatterns = [
      /decision:\s*([^.!?]+)/gi,
      /decided\s+to\s+([^.!?]+)/gi,
      /choice\s+between\s+([^.!?]+)/gi,
    ];

    for (const pattern of decisionPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const name = match[1].trim();
        if (name.length > 5 && name.length < 200) {
          entities.push(this.createEntity('decision', name, entry, 0.7));
        }
      }
    }

    // Concept extraction
    const conceptPatterns = [
      /(?:concept|principle|methodology|approach):\s*([^.!?]+)/gi,
      /using\s+([a-z\s-]+?)\s+(?:methodology|approach|framework)/gi,
    ];

    for (const pattern of conceptPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const name = match[1].trim();
        if (name.length > 3 && name.length < 100) {
          entities.push(this.createEntity('concept', name, entry, 0.6));
        }
      }
    }

    // Metric extraction
    const metricPatterns = [
      /([a-z\s]+?):\s*(\d+(?:\.\d+)?)\s*(%|units?|points?|$|ms|seconds?)/gi,
      /(\d+(?:\.\d+)?)\s*(%|units?|points?)\s+([a-z\s]+)/gi,
    ];

    for (const pattern of metricPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const name = match[1] || match[3];
        if (name && name.trim().length > 2) {
          entities.push(this.createEntity('metric', name.trim(), entry, 0.8));
        }
      }
    }

    return entities;
  }

  private createEntity(
    type: KnowledgeEntity['type'],
    name: string,
    entry: KnowledgeEntry,
    confidence: number
  ): KnowledgeEntity {
    return {
      id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      name: name.trim(),
      attributes: {
        sourceEntry: entry.id,
        sourceType: entry.type,
      },
      context: entry.content.substring(0, 200),
      confidence,
      lastUpdated: new Date(),
      source: entry.source || 'knowledge-entry',
    };
  }

  private async findExplicitRelationships(
    entities: KnowledgeEntity[],
    entries: KnowledgeEntry[]
  ): Promise<Relationship[]> {
    const relationships: Relationship[] = [];

    for (const entry of entries) {
      const content = entry.content.toLowerCase();
      const entryEntities = entities.filter(e => content.includes(e.name.toLowerCase()));

      // Find explicit relationship patterns
      for (const pattern of this.patterns.values()) {
        const regex = new RegExp(pattern.pattern, 'gi');
        const matches = content.matchAll(regex);

        for (const match of matches) {
          const entityNames = match.slice(1).filter(Boolean);
          
          if (entityNames.length >= 2) {
            const fromEntity = entities.find(e => 
              entityNames.some(name => e.name.toLowerCase().includes(name.toLowerCase()))
            );
            const toEntity = entities.find(e => 
              e !== fromEntity && entityNames.some(name => e.name.toLowerCase().includes(name.toLowerCase()))
            );

            if (fromEntity && toEntity) {
              relationships.push(this.createRelationship(
                fromEntity.id,
                toEntity.id,
                pattern.type,
                pattern.confidence,
                'explicit',
                [match[0]],
                entry.content.substring(0, 300)
              ));
            }
          }
        }
      }

      // Find assignment relationships
      const assignmentMatches = content.matchAll(/([a-z\s]+?)\s+(?:is\s+)?assigned\s+to\s+([a-z\s]+)/gi);
      for (const match of assignmentMatches) {
        const task = entities.find(e => e.type === 'task' && match[1].includes(e.name.toLowerCase()));
        const person = entities.find(e => e.type === 'person' && match[2].includes(e.name.toLowerCase()));
        
        if (task && person) {
          relationships.push(this.createRelationship(
            task.id,
            person.id,
            'assigned_to',
            0.9,
            'explicit',
            [match[0]],
            entry.content.substring(0, 300)
          ));
        }
      }
    }

    return relationships;
  }

  private async findTemporalRelationships(
    entities: KnowledgeEntity[],
    entries: KnowledgeEntry[]
  ): Promise<InferredRelationship[]> {
    const relationships: InferredRelationship[] = [];
    
    // Group entities by time periods
    const timeGroups = new Map<string, KnowledgeEntity[]>();
    
    for (const entity of entities) {
      const timeKey = entity.lastUpdated.toISOString().substring(0, 10); // Daily grouping
      const group = timeGroups.get(timeKey) || [];
      group.push(entity);
      timeGroups.set(timeKey, group);
    }

    // Find co-occurring entities
    for (const [timeKey, groupEntities] of timeGroups.entries()) {
      if (groupEntities.length >= 2) {
        for (let i = 0; i < groupEntities.length; i++) {
          for (let j = i + 1; j < groupEntities.length; j++) {
            const entity1 = groupEntities[i];
            const entity2 = groupEntities[j];

            // Skip if already have explicit relationship
            const existingRel = Array.from(this.relationshipCache.values()).find(r =>
              (r.fromEntity === entity1.id && r.toEntity === entity2.id) ||
              (r.fromEntity === entity2.id && r.toEntity === entity1.id)
            );

            if (!existingRel) {
              relationships.push(this.createInferredRelationship(
                entity1.id,
                entity2.id,
                'related_to',
                0.3,
                `Temporal co-occurrence on ${timeKey}`,
                0.6,
                [`Co-occurred in same time period: ${timeKey}`],
                true
              ));
            }
          }
        }
      }
    }

    return relationships;
  }

  private async findSemanticRelationships(entities: KnowledgeEntity[]): Promise<InferredRelationship[]> {
    const relationships: InferredRelationship[] = [];

    // Simple semantic similarity based on shared keywords
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];

        const similarity = this.calculateSemanticSimilarity(entity1, entity2);
        
        if (similarity > 0.7) {
          relationships.push(this.createInferredRelationship(
            entity1.id,
            entity2.id,
            'related_to',
            similarity * 0.6,
            `High semantic similarity (${(similarity * 100).toFixed(1)}%)`,
            similarity,
            [`Semantic similarity: ${(similarity * 100).toFixed(1)}%`],
            false
          ));
        }
      }
    }

    return relationships;
  }

  private calculateSemanticSimilarity(entity1: KnowledgeEntity, entity2: KnowledgeEntity): number {
    const words1 = new Set(entity1.name.toLowerCase().split(/\s+/));
    const words2 = new Set(entity2.name.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private async findPatternBasedRelationships(
    entities: KnowledgeEntity[],
    entries: KnowledgeEntry[]
  ): Promise<InferredRelationship[]> {
    const relationships: InferredRelationship[] = [];

    // Project-task relationships
    const projects = entities.filter(e => e.type === 'project');
    const tasks = entities.filter(e => e.type === 'task');

    for (const project of projects) {
      for (const task of tasks) {
        // Check if task mentions project
        const taskWords = task.name.toLowerCase().split(/\s+/);
        const projectWords = project.name.toLowerCase().split(/\s+/);
        
        const overlap = taskWords.filter(word => projectWords.includes(word)).length;
        
        if (overlap > 0) {
          const confidence = Math.min(0.8, overlap / Math.max(taskWords.length, projectWords.length));
          
          relationships.push(this.createInferredRelationship(
            task.id,
            project.id,
            'part_of',
            confidence,
            `Task appears to be part of project based on shared terminology`,
            confidence,
            [`Shared words: ${overlap}`],
            true
          ));
        }
      }
    }

    return relationships;
  }

  private async findHierarchicalRelationships(entities: KnowledgeEntity[]): Promise<InferredRelationship[]> {
    const relationships: InferredRelationship[] = [];

    // Find containment relationships based on naming patterns
    for (let i = 0; i < entities.length; i++) {
      for (let j = 0; j < entities.length; j++) {
        if (i === j) continue;

        const entity1 = entities[i];
        const entity2 = entities[j];

        // Check if one entity name contains the other
        if (entity1.name.toLowerCase().includes(entity2.name.toLowerCase()) && 
            entity1.name.length > entity2.name.length + 3) {
          
          relationships.push(this.createInferredRelationship(
            entity1.id,
            entity2.id,
            'contains',
            0.7,
            `Hierarchical relationship inferred from naming pattern`,
            0.6,
            [`"${entity1.name}" contains "${entity2.name}"`],
            true
          ));
        }
      }
    }

    return relationships;
  }

  private createRelationship(
    fromEntity: string,
    toEntity: string,
    type: Relationship['type'],
    strength: number,
    discoveryMethod: Relationship['metadata']['discoveryMethod'],
    evidence: string[],
    context: string
  ): Relationship {
    return {
      id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      fromEntity,
      toEntity,
      type,
      strength,
      confidence: strength,
      metadata: {
        discoveryMethod,
        evidence,
        context,
        discoveredAt: new Date(),
        lastConfirmed: new Date(),
      },
      bidirectional: type === 'related_to' || type === 'influences',
    };
  }

  private createInferredRelationship(
    fromEntity: string,
    toEntity: string,
    type: Relationship['type'],
    strength: number,
    inferenceReason: string,
    inferenceConfidence: number,
    supportingEvidence: string[],
    requiresVerification: boolean
  ): InferredRelationship {
    const baseRelationship = this.createRelationship(
      fromEntity,
      toEntity,
      type,
      strength,
      'semantic',
      supportingEvidence,
      inferenceReason
    );

    return {
      ...baseRelationship,
      inferenceReason,
      inferenceConfidence,
      supportingEvidence,
      requiresVerification,
    };
  }

  private validateRelationships(relationships: Relationship[]): Relationship[] {
    return relationships.filter(rel => {
      // Remove duplicate relationships
      const duplicate = relationships.find(other => 
        other !== rel &&
        ((other.fromEntity === rel.fromEntity && other.toEntity === rel.toEntity) ||
         (other.fromEntity === rel.toEntity && other.toEntity === rel.fromEntity && rel.bidirectional))
      );

      if (duplicate) {
        // Keep the one with higher confidence
        return rel.confidence >= duplicate.confidence;
      }

      return rel.confidence >= this.relationshipConfidenceThreshold;
    });
  }

  private calculateOverallConfidence(entities: KnowledgeEntity[], relationships: Relationship[]): number {
    const entityConfidenceSum = entities.reduce((sum, e) => sum + e.confidence, 0);
    const relationshipConfidenceSum = relationships.reduce((sum, r) => sum + r.confidence, 0);
    
    const totalItems = entities.length + relationships.length;
    
    return totalItems > 0 ? (entityConfidenceSum + relationshipConfidenceSum) / totalItems : 0;
  }

  private updateCaches(entities: KnowledgeEntity[], relationships: Relationship[]): void {
    // Update entity cache
    for (const entity of entities) {
      this.entityCache.set(entity.id, entity);
    }

    // Update relationship cache
    for (const relationship of relationships) {
      this.relationshipCache.set(relationship.id, relationship);
    }
  }

  private initializePatterns(): void {
    const patterns: RelationshipPattern[] = [
      {
        pattern: '([a-z\\s]+?)\\s+depends\\s+on\\s+([a-z\\s]+)',
        type: 'depends_on',
        confidence: 0.8,
        examples: ['Project A depends on Project B', 'Task X depends on completion of Y'],
      },
      {
        pattern: '([a-z\\s]+?)\\s+is\\s+part\\s+of\\s+([a-z\\s]+)',
        type: 'part_of',
        confidence: 0.9,
        examples: ['Module A is part of System B', 'Team X is part of Department Y'],
      },
      {
        pattern: '([a-z\\s]+?)\\s+influences\\s+([a-z\\s]+)',
        type: 'influences',
        confidence: 0.7,
        examples: ['Market trends influence pricing', 'User feedback influences design'],
      },
      {
        pattern: '([a-z\\s]+?)\\s+created\\s+by\\s+([a-z\\s]+)',
        type: 'created_by',
        confidence: 0.9,
        examples: ['Document created by John', 'Feature created by Development Team'],
      },
      {
        pattern: '([a-z\\s]+?)\\s+contains\\s+([a-z\\s]+)',
        type: 'contains',
        confidence: 0.8,
        examples: ['Project contains multiple tasks', 'System contains various modules'],
      },
    ];

    for (const pattern of patterns) {
      this.patterns.set(pattern.pattern, pattern);
    }
  }

  // Public methods for accessing discovered relationships

  getEntity(entityId: string): KnowledgeEntity | undefined {
    return this.entityCache.get(entityId);
  }

  getRelationship(relationshipId: string): Relationship | undefined {
    return this.relationshipCache.get(relationshipId);
  }

  getEntitiesByType(type: KnowledgeEntity['type']): KnowledgeEntity[] {
    return Array.from(this.entityCache.values()).filter(e => e.type === type);
  }

  getRelationshipsForEntity(entityId: string): Relationship[] {
    return Array.from(this.relationshipCache.values()).filter(r =>
      r.fromEntity === entityId || r.toEntity === entityId
    );
  }

  getRelationshipsByType(type: Relationship['type']): Relationship[] {
    return Array.from(this.relationshipCache.values()).filter(r => r.type === type);
  }

  getAllEntities(): KnowledgeEntity[] {
    return Array.from(this.entityCache.values());
  }

  getAllRelationships(): Relationship[] {
    return Array.from(this.relationshipCache.values());
  }

  getSystemStats(): {
    totalEntities: number;
    totalRelationships: number;
    entityTypes: Record<string, number>;
    relationshipTypes: Record<string, number>;
    averageEntityConfidence: number;
    averageRelationshipStrength: number;
  } {
    const entities = this.getAllEntities();
    const relationships = this.getAllRelationships();

    const entityTypes: Record<string, number> = {};
    const relationshipTypes: Record<string, number> = {};

    entities.forEach(e => {
      entityTypes[e.type] = (entityTypes[e.type] || 0) + 1;
    });

    relationships.forEach(r => {
      relationshipTypes[r.type] = (relationshipTypes[r.type] || 0) + 1;
    });

    const averageEntityConfidence = entities.length > 0 
      ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length 
      : 0;

    const averageRelationshipStrength = relationships.length > 0 
      ? relationships.reduce((sum, r) => sum + r.strength, 0) / relationships.length 
      : 0;

    return {
      totalEntities: entities.length,
      totalRelationships: relationships.length,
      entityTypes,
      relationshipTypes,
      averageEntityConfidence,
      averageRelationshipStrength,
    };
  }

  async clearCache(): Promise<void> {
    this.entityCache.clear();
    this.relationshipCache.clear();
    
    this.emit('cacheCleared');
    logger.info('Relationship discovery cache cleared');
  }
}

export default RelationshipDiscovery;