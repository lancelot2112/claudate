import { InteractiveElement, InteractiveAction } from '../../types/Communication';
import logger from '../../utils/logger';

export interface ButtonConfig {
  label: string;
  actionId: string;
  style: 'primary' | 'secondary' | 'danger' | 'success';
  parameters?: Record<string, string>;
  disabled?: boolean;
  icon?: string;
}

export interface DropdownConfig {
  label: string;
  actionId: string;
  placeholder?: string;
  options: Array<{
    label: string;
    value: string;
    description?: string;
  }>;
  parameters?: Record<string, string>;
  required?: boolean;
}

export interface InputConfig {
  label: string;
  actionId: string;
  type: 'text' | 'email' | 'number' | 'date' | 'time';
  placeholder?: string;
  required?: boolean;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
  parameters?: Record<string, string>;
}

export interface CardConfig {
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  elements: InteractiveElement[];
  footer?: string;
}

export class InteractiveElementBuilder {
  private elements: InteractiveElement[] = [];

  /**
   * Add a button element
   */
  addButton(config: ButtonConfig): InteractiveElementBuilder {
    const button: InteractiveElement = {
      type: 'button',
      id: `btn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      label: config.label,
      action: { type: 'postback', value: config.actionId },
      style: { variant: config.style as any },
      parameters: config.parameters,
      metadata: {
        icon: config.icon,
        disabled: config.disabled || false,
        createdAt: new Date().toISOString(),
      },
    };

    this.elements.push(button);
    return this;
  }

  /**
   * Add a dropdown/select element
   */
  addDropdown(config: DropdownConfig): InteractiveElementBuilder {
    const dropdown: InteractiveElement = {
      type: 'dropdown',
      id: `dd_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      label: config.label,
      action: { type: 'postback', value: config.actionId },
      options: config.options,
      parameters: config.parameters,
      metadata: {
        placeholder: config.placeholder,
        required: config.required || false,
        createdAt: new Date().toISOString(),
      },
    };

    this.elements.push(dropdown);
    return this;
  }

  /**
   * Add an input field element
   */
  addInput(config: InputConfig): InteractiveElementBuilder {
    const input: InteractiveElement = {
      type: 'input',
      id: `inp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      label: config.label,
      action: { type: 'postback', value: config.actionId },
      parameters: config.parameters,
      metadata: {
        placeholder: config.placeholder,
        required: config.required || false,
        validation: config.validation,
        inputType: config.type,
        createdAt: new Date().toISOString(),
      },
    };

    this.elements.push(input);
    return this;
  }

  /**
   * Add a text display element
   */
  addText(text: string, style: 'normal' | 'bold' | 'italic' | 'code' = 'normal'): InteractiveElementBuilder {
    const textElement: InteractiveElement = {
      type: 'card',
      id: `txt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      label: text,
      action: { type: 'postback', value: '' }, // Text elements don't have actions
      metadata: {
        style,
        isTextOnly: true,
        createdAt: new Date().toISOString(),
      },
    };

    this.elements.push(textElement);
    return this;
  }

  /**
   * Add a divider/separator
   */
  addDivider(): InteractiveElementBuilder {
    const divider: InteractiveElement = {
      type: 'card',
      id: `div_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      label: '',
      action: { type: 'postback', value: '' },
      metadata: {
        isDivider: true,
        createdAt: new Date().toISOString(),
      },
    };

    this.elements.push(divider);
    return this;
  }

  /**
   * Get all built elements
   */
  build(): InteractiveElement[] {
    return [...this.elements];
  }

  /**
   * Clear all elements
   */
  clear(): InteractiveElementBuilder {
    this.elements = [];
    return this;
  }

  /**
   * Get element count
   */
  count(): number {
    return this.elements.length;
  }

  /**
   * Remove element by ID
   */
  removeElement(id: string): InteractiveElementBuilder {
    this.elements = this.elements.filter(element => element.id !== id);
    return this;
  }

  /**
   * Update element by ID
   */
  updateElement(id: string, updates: Partial<InteractiveElement>): InteractiveElementBuilder {
    const index = this.elements.findIndex(element => element.id === id);
    if (index !== -1) {
      // Filter out undefined values to avoid type errors
      const filteredUpdates: Partial<InteractiveElement> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          (filteredUpdates as any)[key] = value;
        }
      }
      const existingElement = this.elements[index];
      if (existingElement) {
        this.elements[index] = { 
          ...existingElement, 
          ...filteredUpdates,
          // Ensure required properties are never undefined
          type: filteredUpdates.type || existingElement.type,
          id: filteredUpdates.id || existingElement.id,
          label: filteredUpdates.label || existingElement.label,
          action: filteredUpdates.action || existingElement.action,
        };
      }
    }
    return this;
  }
}

/**
 * Pre-built interactive element templates
 */
export class InteractiveTemplates {
  /**
   * Create a quick action template with common buttons
   */
  static createQuickActions(): InteractiveElement[] {
    return new InteractiveElementBuilder()
      .addButton({
        label: '✅ Approve',
        actionId: 'quick_approve',
        style: 'success',
      })
      .addButton({
        label: '❌ Reject',
        actionId: 'quick_reject',
        style: 'danger',
      })
      .addButton({
        label: '⏸️ Hold',
        actionId: 'quick_hold',
        style: 'secondary',
      })
      .build();
  }

  /**
   * Create an executive decision template
   */
  static createExecutiveDecision(decisionContext: string): InteractiveElement[] {
    return new InteractiveElementBuilder()
      .addText(`Decision Required: ${decisionContext}`, 'bold')
      .addDivider()
      .addButton({
        label: '🚀 Proceed',
        actionId: 'executive_proceed',
        style: 'primary',
        parameters: { context: decisionContext },
      })
      .addButton({
        label: '📋 Need More Info',
        actionId: 'executive_info',
        style: 'secondary',
        parameters: { context: decisionContext },
      })
      .addButton({
        label: '🔄 Delay',
        actionId: 'executive_delay',
        style: 'secondary',
        parameters: { context: decisionContext },
      })
      .addButton({
        label: '🛑 Cancel',
        actionId: 'executive_cancel',
        style: 'danger',
        parameters: { context: decisionContext },
      })
      .build();
  }

  /**
   * Create a priority selection template
   */
  static createPrioritySelector(taskId: string): InteractiveElement[] {
    return new InteractiveElementBuilder()
      .addText('Set Priority Level:', 'bold')
      .addDropdown({
        label: 'Priority',
        actionId: 'set_priority',
        placeholder: 'Select priority level',
        options: [
          { label: '🔴 Critical', value: 'critical', description: 'Immediate attention required' },
          { label: '🟠 High', value: 'high', description: 'Complete within 24 hours' },
          { label: '🟡 Medium', value: 'medium', description: 'Complete within week' },
          { label: '🟢 Low', value: 'low', description: 'No specific deadline' },
        ],
        parameters: { taskId },
        required: true,
      })
      .addButton({
        label: 'Update Priority',
        actionId: 'update_priority',
        style: 'primary',
        parameters: { taskId },
      })
      .build();
  }

  /**
   * Create a feedback collection template
   */
  static createFeedbackForm(contextId: string): InteractiveElement[] {
    return new InteractiveElementBuilder()
      .addText('Please provide your feedback:', 'bold')
      .addInput({
        label: 'Feedback',
        actionId: 'submit_feedback',
        type: 'text',
        placeholder: 'Enter your feedback here...',
        required: true,
        validation: {
          minLength: 10,
          maxLength: 500,
        },
        parameters: { contextId },
      })
      .addDropdown({
        label: 'Rating',
        actionId: 'submit_rating',
        options: [
          { label: '⭐⭐⭐⭐⭐ Excellent', value: '5' },
          { label: '⭐⭐⭐⭐ Good', value: '4' },
          { label: '⭐⭐⭐ Average', value: '3' },
          { label: '⭐⭐ Poor', value: '2' },
          { label: '⭐ Very Poor', value: '1' },
        ],
        parameters: { contextId },
        required: true,
      })
      .addButton({
        label: 'Submit Feedback',
        actionId: 'submit_feedback_form',
        style: 'primary',
        parameters: { contextId },
      })
      .build();
  }

  /**
   * Create a meeting scheduling template
   */
  static createMeetingScheduler(meetingId: string): InteractiveElement[] {
    return new InteractiveElementBuilder()
      .addText('Schedule Meeting:', 'bold')
      .addInput({
        label: 'Meeting Title',
        actionId: 'set_meeting_title',
        type: 'text',
        placeholder: 'Enter meeting title',
        required: true,
        parameters: { meetingId },
      })
      .addInput({
        label: 'Date',
        actionId: 'set_meeting_date',
        type: 'date',
        required: true,
        parameters: { meetingId },
      })
      .addInput({
        label: 'Time',
        actionId: 'set_meeting_time',
        type: 'time',
        required: true,
        parameters: { meetingId },
      })
      .addDropdown({
        label: 'Duration',
        actionId: 'set_meeting_duration',
        options: [
          { label: '15 minutes', value: '15' },
          { label: '30 minutes', value: '30' },
          { label: '45 minutes', value: '45' },
          { label: '1 hour', value: '60' },
          { label: '1.5 hours', value: '90' },
          { label: '2 hours', value: '120' },
        ],
        parameters: { meetingId },
        required: true,
      })
      .addButton({
        label: 'Schedule Meeting',
        actionId: 'create_meeting',
        style: 'primary',
        parameters: { meetingId },
      })
      .build();
  }

  /**
   * Create a project status update template
   */
  static createProjectStatusUpdate(projectId: string): InteractiveElement[] {
    return new InteractiveElementBuilder()
      .addText('Update Project Status:', 'bold')
      .addDropdown({
        label: 'Status',
        actionId: 'update_project_status',
        options: [
          { label: '🟢 On Track', value: 'on_track' },
          { label: '🟡 At Risk', value: 'at_risk' },
          { label: '🔴 Blocked', value: 'blocked' },
          { label: '✅ Complete', value: 'complete' },
          { label: '⏸️ On Hold', value: 'on_hold' },
        ],
        parameters: { projectId },
        required: true,
      })
      .addInput({
        label: 'Progress %',
        actionId: 'update_progress',
        type: 'number',
        placeholder: '0-100',
        validation: { min: 0, max: 100 },
        parameters: { projectId },
      })
      .addInput({
        label: 'Notes',
        actionId: 'update_notes',
        type: 'text',
        placeholder: 'Additional notes or blockers...',
        validation: { maxLength: 300 },
        parameters: { projectId },
      })
      .addButton({
        label: 'Update Project',
        actionId: 'save_project_update',
        style: 'primary',
        parameters: { projectId },
      })
      .build();
  }
}

/**
 * Action handler registry for interactive elements
 */
export class InteractiveActionHandler {
  private handlers: Map<string, (action: InteractiveAction) => Promise<any>> = new Map();

  /**
   * Register an action handler
   */
  registerHandler(actionId: string, handler: (action: InteractiveAction) => Promise<any>): void {
    this.handlers.set(actionId, handler);
    logger.info('Registered interactive action handler', { actionId });
  }

  /**
   * Handle an interactive action
   */
  async handleAction(action: InteractiveAction): Promise<any> {
    const handler = this.handlers.get(action.value);
    
    if (!handler) {
      logger.warn('No handler found for interactive action', { actionValue: action.value });
      throw new Error(`No handler registered for action: ${action.value}`);
    }

    try {
      logger.info('Handling interactive action', {
        actionValue: action.value,
        type: action.type,
        parameters: action.parameters,
      });

      const result = await handler(action);
      
      logger.info('Interactive action handled successfully', {
        actionValue: action.value,
        type: action.type,
      });

      return result;
    } catch (error) {
      logger.error('Interactive action handling failed', {
        actionValue: action.value,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get registered action IDs
   */
  getRegisteredActions(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Remove action handler
   */
  unregisterHandler(actionId: string): boolean {
    return this.handlers.delete(actionId);
  }

  /**
   * Clear all handlers
   */
  clearHandlers(): void {
    this.handlers.clear();
    logger.info('Cleared all interactive action handlers');
  }
}

export default InteractiveElementBuilder;