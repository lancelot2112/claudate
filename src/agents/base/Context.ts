import { v4 as uuidv4 } from 'uuid';
import { AgentContext, AgentDecision } from '@/types/Agent';
import { BaseMessage } from '@/types/common';
import { contextLogger } from '@/utils/logger';

export class ContextManager {
  private contexts = new Map<string, AgentContext>();
  
  public createContext(
    userId: string,
    userPreferences: Record<string, any> = {},
    contextWindow = 50
  ): AgentContext {
    const sessionId = uuidv4();
    
    const context: AgentContext = {
      sessionId,
      userId,
      conversationHistory: [],
      userPreferences,
      activeProjects: [],
      recentDecisions: [],
      contextWindow,
      timestamp: new Date(),
    };

    this.contexts.set(sessionId, context);
    
    contextLogger.info('Context created', {
      sessionId,
      userId,
      contextWindow,
    });

    return context;
  }

  public getContext(sessionId: string): AgentContext | null {
    return this.contexts.get(sessionId) || null;
  }

  public updateContext(sessionId: string, updates: Partial<AgentContext>): AgentContext | null {
    const context = this.contexts.get(sessionId);
    if (!context) {
      contextLogger.warn('Attempted to update non-existent context', { sessionId });
      return null;
    }

    const updatedContext: AgentContext = {
      ...context,
      ...updates,
      timestamp: new Date(),
    };

    this.contexts.set(sessionId, updatedContext);
    
    contextLogger.debug('Context updated', {
      sessionId,
      updatedFields: Object.keys(updates),
    });

    return updatedContext;
  }

  public addMessage(sessionId: string, message: BaseMessage): boolean {
    const context = this.contexts.get(sessionId);
    if (!context) {
      contextLogger.warn('Attempted to add message to non-existent context', { sessionId });
      return false;
    }

    context.conversationHistory.push(message);
    
    // Maintain context window size
    if (context.conversationHistory.length > context.contextWindow) {
      context.conversationHistory = context.conversationHistory.slice(-context.contextWindow);
    }

    context.timestamp = new Date();
    
    contextLogger.debug('Message added to context', {
      sessionId,
      messageId: message.id,
      historyLength: context.conversationHistory.length,
    });

    return true;
  }

  public addDecision(sessionId: string, decision: AgentDecision): boolean {
    const context = this.contexts.get(sessionId);
    if (!context) {
      contextLogger.warn('Attempted to add decision to non-existent context', { sessionId });
      return false;
    }

    context.recentDecisions.push(decision);
    
    // Keep only last 20 decisions
    if (context.recentDecisions.length > 20) {
      context.recentDecisions = context.recentDecisions.slice(-20);
    }

    context.timestamp = new Date();
    
    contextLogger.debug('Decision added to context', {
      sessionId,
      decisionId: decision.id,
      decisionsCount: context.recentDecisions.length,
    });

    return true;
  }

  public setActiveProjects(sessionId: string, projects: string[]): boolean {
    const context = this.contexts.get(sessionId);
    if (!context) {
      contextLogger.warn('Attempted to set active projects for non-existent context', { sessionId });
      return false;
    }

    context.activeProjects = projects;
    context.timestamp = new Date();
    
    contextLogger.debug('Active projects updated', {
      sessionId,
      projectCount: projects.length,
    });

    return true;
  }

  public updateUserPreferences(
    sessionId: string,
    preferences: Record<string, any>
  ): boolean {
    const context = this.contexts.get(sessionId);
    if (!context) {
      contextLogger.warn('Attempted to update preferences for non-existent context', { sessionId });
      return false;
    }

    context.userPreferences = {
      ...context.userPreferences,
      ...preferences,
    };
    context.timestamp = new Date();
    
    contextLogger.debug('User preferences updated', {
      sessionId,
      updatedKeys: Object.keys(preferences),
    });

    return true;
  }

  public getRecentMessages(sessionId: string, count = 10): BaseMessage[] {
    const context = this.contexts.get(sessionId);
    if (!context) {
      return [];
    }

    return context.conversationHistory.slice(-count);
  }

  public getRecentDecisions(sessionId: string, count = 5): AgentDecision[] {
    const context = this.contexts.get(sessionId);
    if (!context) {
      return [];
    }

    return context.recentDecisions.slice(-count);
  }

  public deleteContext(sessionId: string): boolean {
    const deleted = this.contexts.delete(sessionId);
    
    if (deleted) {
      contextLogger.info('Context deleted', { sessionId });
    } else {
      contextLogger.warn('Attempted to delete non-existent context', { sessionId });
    }

    return deleted;
  }

  public getContextSummary(sessionId: string): object | null {
    const context = this.contexts.get(sessionId);
    if (!context) {
      return null;
    }

    return {
      sessionId: context.sessionId,
      userId: context.userId,
      messageCount: context.conversationHistory.length,
      decisionCount: context.recentDecisions.length,
      activeProjectCount: context.activeProjects.length,
      lastActivity: context.timestamp,
      contextWindow: context.contextWindow,
    };
  }

  public getAllContextSummaries(): object[] {
    const summaries: object[] = [];
    
    for (const [sessionId] of this.contexts) {
      const summary = this.getContextSummary(sessionId);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries;
  }

  public cleanupExpiredContexts(maxAgeMs = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, context] of this.contexts) {
      if (now - context.timestamp.getTime() > maxAgeMs) {
        this.contexts.delete(sessionId);
        cleaned++;
        
        contextLogger.info('Expired context cleaned up', {
          sessionId,
          age: now - context.timestamp.getTime(),
        });
      }
    }

    if (cleaned > 0) {
      contextLogger.info(`Cleaned up ${cleaned} expired contexts`);
    }

    return cleaned;
  }
}

// Singleton instance
export const contextManager = new ContextManager();

// Context utilities
export class ContextBuilder {
  private context: Partial<AgentContext>;

  constructor(userId: string) {
    this.context = {
      sessionId: uuidv4(),
      userId,
      conversationHistory: [],
      userPreferences: {},
      activeProjects: [],
      recentDecisions: [],
      contextWindow: 50,
      timestamp: new Date(),
    };
  }

  public withCurrentTask(task: any): ContextBuilder {
    this.context.currentTask = task;
    return this;
  }

  public withConversationHistory(messages: BaseMessage[]): ContextBuilder {
    this.context.conversationHistory = messages;
    return this;
  }

  public withUserPreferences(preferences: Record<string, any>): ContextBuilder {
    this.context.userPreferences = preferences;
    return this;
  }

  public withActiveProjects(projects: string[]): ContextBuilder {
    this.context.activeProjects = projects;
    return this;
  }

  public withRecentDecisions(decisions: AgentDecision[]): ContextBuilder {
    this.context.recentDecisions = decisions;
    return this;
  }

  public withContextWindow(size: number): ContextBuilder {
    this.context.contextWindow = size;
    return this;
  }

  public build(): AgentContext {
    return this.context as AgentContext;
  }
}