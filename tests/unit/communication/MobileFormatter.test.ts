import { MobileFormatter, ExecutiveMobileFormatters } from '../../../src/communication/formatters/MobileFormatter';
import { BaseMessage } from '../../../src/types/common';
import { ExecutiveBrief, ChannelMessage } from '../../../src/types/Communication';

describe('MobileFormatter', () => {
  const mockMessage: BaseMessage = {
    id: 'test-message-1',
    content: 'This is a test message with some content that needs to be formatted for mobile delivery.',
    type: 'text',
    urgency: 'normal',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    source: 'test',
  };

  const mockChannelMessage: ChannelMessage = {
    ...mockMessage,
    channel: 'sms',
    recipient: '+1234567890',
    attachments: [
      {
        id: 'attachment-1',
        type: 'image',
        url: 'https://example.com/image.png',
        filename: 'image.png',
        size: 1024,
        mimeType: 'image/png',
      },
    ],
  };

  const mockExecutiveBrief: ExecutiveBrief = {
    id: 'brief-1',
    title: 'Daily Operations Summary',
    summary: 'All systems are operating normally with high efficiency metrics.',
    keyPoints: [
      'Message processing at 99.5% success rate',
      'All agents responding within SLA',
      'No critical issues detected',
    ],
    urgency: 'normal',
    actionItems: [
      'Review quarterly metrics',
      'Schedule team check-in',
    ],
  };

  describe('formatMessage', () => {
    it('should format a basic message', () => {
      const formatted = MobileFormatter.formatMessage(mockMessage);
      
      // Check that the key words from content are present
      expect(formatted).toContain('test message');
      expect(formatted).toContain('content');
      expect(formatted).toContain('formatted');
      expect(formatted).toContain('mobile');
      expect(formatted).toContain('delivery');
      expect(formatted.length).toBeLessThanOrEqual(1600);
    });

    it('should add urgency indicators for high priority messages', () => {
      const urgentMessage = { ...mockMessage, urgency: 'critical' as const };
      const formatted = MobileFormatter.formatMessage(urgentMessage);
      
      expect(formatted).toContain('🚨');
      expect(formatted).toContain('URGENT');
    });

    it('should respect maximum length limits', () => {
      const longMessage = {
        ...mockMessage,
        content: 'A'.repeat(2000),
      };
      
      const formatted = MobileFormatter.formatMessage(longMessage, { maxTotalLength: 100 });
      
      expect(formatted.length).toBeLessThanOrEqual(100);
      expect(formatted).toContain('...');
    });

    it('should include timestamp when requested', () => {
      const formatted = MobileFormatter.formatMessage(mockMessage, { includeTimestamp: true });
      
      expect(formatted).toContain('⏰');
      expect(formatted).toMatch(/\d{1,2}:\d{2}/); // Time format
    });

    it('should format attachment summary', () => {
      const formatted = MobileFormatter.formatMessage(mockChannelMessage);
      
      expect(formatted).toContain('📸');
      expect(formatted).toContain('1 attachment');
    });

    it('should work without emojis when disabled', () => {
      const urgentMessage = { ...mockMessage, urgency: 'critical' as const };
      const formatted = MobileFormatter.formatMessage(urgentMessage, { includeEmojis: false });
      
      expect(formatted).not.toContain('🚨');
      expect(formatted).toContain('URGENT');
    });
  });

  describe('formatExecutiveBrief', () => {
    it('should format an executive brief properly', () => {
      const formatted = MobileFormatter.formatExecutiveBrief(mockExecutiveBrief);
      
      expect(formatted).toContain(mockExecutiveBrief.title);
      expect(formatted).toContain('All systems are operating');
      expect(formatted).toContain('normally');
      expect(formatted).toContain('📊 Key Points:');
      expect(formatted).toContain('📋 Actions:');
    });

    it('should limit bullet points to maximum', () => {
      const briefWithManyPoints = {
        ...mockExecutiveBrief,
        keyPoints: Array(10).fill('Point'),
        actionItems: Array(10).fill('Action'),
      };
      
      const formatted = MobileFormatter.formatExecutiveBrief(briefWithManyPoints, { 
        maxBulletPoints: 2 
      });
      
      // Should only have 2 bullet points for each section
      const bulletCount = (formatted.match(/•/g) || []).length;
      expect(bulletCount).toBeLessThanOrEqual(4); // 2 key points + 2 actions
    });

    it('should add urgency indicators for high urgency briefs', () => {
      const urgentBrief = { ...mockExecutiveBrief, urgency: 'critical' as const };
      const formatted = MobileFormatter.formatExecutiveBrief(urgentBrief);
      
      expect(formatted).toContain('🚨');
      expect(formatted).toContain('URGENT');
    });

    it('should handle empty key points and action items', () => {
      const minimalBrief = {
        ...mockExecutiveBrief,
        keyPoints: [],
        actionItems: [],
      };
      
      const formatted = MobileFormatter.formatExecutiveBrief(minimalBrief);
      
      expect(formatted).toContain(minimalBrief.title);
      expect(formatted).toContain('All systems are operating');
      expect(formatted).toContain('normally');
      expect(formatted).not.toContain('Key Points:');
      expect(formatted).not.toContain('Actions:');
    });
  });

  describe('formatQuickStatus', () => {
    it('should format a quick status update', () => {
      const formatted = MobileFormatter.formatQuickStatus(
        'System Status',
        ['All services operational', 'Response times normal', 'No incidents reported']
      );
      
      expect(formatted).toContain('📊 System Status');
      expect(formatted).toContain('• All services operational');
      expect(formatted).toContain('• Response times normal');
    });

    it('should limit details to maximum bullet points', () => {
      const manyDetails = Array(10).fill('Detail item');
      const formatted = MobileFormatter.formatQuickStatus('Status', manyDetails, { 
        maxBulletPoints: 2 
      });
      
      const bulletCount = (formatted.match(/•/g) || []).length;
      expect(bulletCount).toBe(2);
    });
  });

  describe('formatAgentUpdate', () => {
    it('should format an agent update', () => {
      const formatted = MobileFormatter.formatAgentUpdate(
        'Claude-Assistant',
        'Task Completed',
        'Successfully processed 50 messages and updated the knowledge base.'
      );
      
      expect(formatted).toContain('🤖 Claude-Assistant');
      expect(formatted).toContain('Task Completed');
      expect(formatted).toContain('Successfully processed');
    });
  });

  describe('Text Processing', () => {
    it('should strip markdown formatting', () => {
      const markdownMessage = {
        ...mockMessage,
        content: '**Bold text** and *italic text* with `code` and ```code block```',
      };
      
      const formatted = MobileFormatter.formatMessage(markdownMessage);
      
      expect(formatted).not.toContain('**');
      expect(formatted).not.toContain('*');
      expect(formatted).not.toContain('```');
      expect(formatted).toContain('"code"'); // Inline code should be quoted
      expect(formatted).toContain('[CODE]'); // Code blocks should be replaced
    });

    it('should wrap long lines in compact mode', () => {
      const longLineMessage = {
        ...mockMessage,
        content: 'This is a very long line that should be wrapped when compact mode is enabled to ensure mobile readability.',
      };
      
      const formatted = MobileFormatter.formatMessage(longLineMessage, { 
        compactMode: true,
        maxLineLength: 30 
      });
      
      const lines = formatted.split('\n');
      const hasLongLines = lines.some(line => line.length > 35); // Allow some tolerance
      expect(hasLongLines).toBe(false);
    });

    it('should normalize whitespace', () => {
      const messyMessage = {
        ...mockMessage,
        content: 'Text   with    extra     spaces\n\n\nand   empty   lines',
      };
      
      const formatted = MobileFormatter.formatMessage(messyMessage);
      
      expect(formatted).not.toContain('   '); // No triple spaces
      expect(formatted).not.toContain('\n\n\n'); // No triple line breaks
    });
  });
});

describe('ExecutiveMobileFormatters', () => {
  describe('formatDailyBriefing', () => {
    it('should format a daily briefing', () => {
      const metrics = {
        messagesProcessed: 1250,
        agentsActive: 8,
        successRate: 0.995,
        urgentIssues: 2,
      };
      
      const topIssues = ['Database slow queries', 'Memory leak in agent pool'];
      
      const formatted = ExecutiveMobileFormatters.formatDailyBriefing(metrics, topIssues);
      
      expect(formatted).toContain('Daily Operations Brief');
      expect(formatted).toContain('1250'); // messagesProcessed
      expect(formatted).toContain('8'); // agentsActive
      expect(formatted).toContain('100%'); // successRate
      expect(formatted).toContain('2'); // urgentIssues
      expect(formatted).toContain('Review: Database slow queries');
    });
  });

  describe('formatCriticalAlert', () => {
    it('should format a critical alert', () => {
      const formatted = ExecutiveMobileFormatters.formatCriticalAlert(
        'Database Connection Lost',
        'Primary database connection has been lost. Switching to backup.',
        ['Investigate primary DB', 'Monitor backup performance'],
        { includeTimestamp: true }
      );
      
      expect(formatted).toContain('🚨 CRITICAL ALERT');
      expect(formatted).toContain('Database Connection Lost');
      expect(formatted).toContain('⚡ IMMEDIATE ACTIONS:');
      expect(formatted).toContain('• Investigate primary DB');
      expect(formatted).toContain('⏰'); // Timestamp
    });

    it('should work without emojis', () => {
      const formatted = ExecutiveMobileFormatters.formatCriticalAlert(
        'System Alert',
        'Alert description',
        ['Action 1'],
        { includeEmojis: false }
      );
      
      expect(formatted).toContain('CRITICAL ALERT');
      expect(formatted).not.toContain('🚨');
    });
  });

  describe('formatStatusUpdate', () => {
    it('should format an operational status', () => {
      const formatted = ExecutiveMobileFormatters.formatStatusUpdate(
        'API Gateway',
        'operational',
        'All endpoints responding normally with average response time of 120ms.'
      );
      
      expect(formatted).toContain('✅ API Gateway');
      expect(formatted).toContain('OPERATIONAL');
      expect(formatted).toContain('All endpoints responding');
    });

    it('should format a degraded status with ETA', () => {
      const formatted = ExecutiveMobileFormatters.formatStatusUpdate(
        'Payment Service',
        'degraded',
        'Experiencing intermittent timeouts. Team investigating.',
        '30 minutes'
      );
      
      expect(formatted).toContain('⚠️ Payment Service');
      expect(formatted).toContain('DEGRADED');
      expect(formatted).toContain('⏱️ ETA: 30 minutes');
    });

    it('should format an outage status', () => {
      const formatted = ExecutiveMobileFormatters.formatStatusUpdate(
        'Email Service',
        'outage',
        'Complete service outage. Investigating root cause.'
      );
      
      expect(formatted).toContain('🔴 Email Service');
      expect(formatted).toContain('OUTAGE');
    });
  });
});