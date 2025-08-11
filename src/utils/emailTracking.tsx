export interface EmailTrackingConfig {
  trackingId: string;
  baseUrl: string;
  originalEmail: string;
  campaignId: string;
  leadId: string;
}

export interface TrackedLink {
  originalUrl: string;
  trackingUrl: string;
  linkText?: string;
  position?: number;
}

export interface ProcessedEmail {
  subject: string;
  htmlContent: string;
  trackedLinks: TrackedLink[];
}

export class EmailTrackingUtils {
  static generateWebhookUrl(baseUrl: string): string {
    return `${baseUrl}/functions/v1/email-webhook-handler`;
  }

  static generateTrackingPixelUrl(trackingId: string, baseUrl: string): string {
    return `${baseUrl}/functions/v1/email-tracking?t=${trackingId}&e=open`;
  }

  static generateClickTrackingUrl(trackingId: string, originalUrl: string, baseUrl: string): string {
    return `${baseUrl}/functions/v1/email-tracking?t=${trackingId}&e=click&url=${encodeURIComponent(originalUrl)}`;
  }
}

export const emailTracking = {
  generateTrackingId(): string {
    return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  processEmailForTracking(
    htmlContent: string,
    subject: string,
    config: EmailTrackingConfig
  ): ProcessedEmail {
    const trackedLinks: TrackedLink[] = [];
    let processedHtml = htmlContent;

    // Add tracking pixel
    const pixelUrl = EmailTrackingUtils.generateTrackingPixelUrl(config.trackingId, config.baseUrl);
    const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" style="display: none;" alt="" />`;
    
    // Insert tracking pixel before closing body tag
    if (processedHtml.includes('</body>')) {
      processedHtml = processedHtml.replace('</body>', `${trackingPixel}</body>`);
    } else {
      processedHtml += trackingPixel;
    }

    // Process links for click tracking
    const linkRegex = /<a\s+([^>]*href\s*=\s*["']([^"']+)["'][^>]*)>([^<]*)<\/a>/gi;
    let linkMatch;
    let position = 0;

    while ((linkMatch = linkRegex.exec(htmlContent)) !== null) {
      const [fullMatch, attributes, originalUrl, linkText] = linkMatch;
      
      // Skip tracking pixel and mailto links
      if (originalUrl.includes('email-tracking') || originalUrl.startsWith('mailto:')) {
        continue;
      }

      const trackingUrl = EmailTrackingUtils.generateClickTrackingUrl(
        config.trackingId,
        originalUrl,
        config.baseUrl
      );

      trackedLinks.push({
        originalUrl,
        trackingUrl,
        linkText: linkText.trim(),
        position: position++
      });

      // Replace the original URL with tracking URL
      const newAttributes = attributes.replace(
        /href\s*=\s*["']([^"']+)["']/i,
        `href="${trackingUrl}"`
      );
      const newLink = `<a ${newAttributes}>${linkText}</a>`;
      processedHtml = processedHtml.replace(fullMatch, newLink);
    }

    // Add tracking headers to subject
    const processedSubject = `${subject} [TRACK:${config.trackingId}]`;

    return {
      subject: processedSubject,
      htmlContent: processedHtml,
      trackedLinks
    };
  },

  async createTrackingRecord(
    config: EmailTrackingConfig,
    emailData: {
      subject: string;
      recipient: string;
      provider: string;
      messageId: string;
    },
    supabase: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('email_tracking')
        .insert({
          user_id: config.originalEmail,
          campaign_id: config.campaignId,
          lead_id: config.leadId,
          email_address: emailData.recipient,
          subject: emailData.subject,
          tracking_id: config.trackingId,
          message_id: emailData.messageId,
          provider: emailData.provider,
          status: 'sent'
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  async storeTrackedLinks(
    trackingId: string,
    trackedLinks: TrackedLink[],
    supabase: any
  ): Promise<void> {
    if (trackedLinks.length === 0) return;

    try {
      const linksToInsert = trackedLinks.map(link => ({
        tracking_id: trackingId,
        original_url: link.originalUrl,
        tracking_url: link.trackingUrl,
        link_text: link.linkText,
        position_in_email: link.position
      }));

      const { error } = await supabase
        .from('tracked_links')
        .insert(linksToInsert);

      if (error) {
        console.error('Error storing tracked links:', error);
      }
    } catch (error) {
      console.error('Error storing tracked links:', error);
    }
  }
};