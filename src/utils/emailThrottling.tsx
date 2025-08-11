export class EmailThrottlingUtils {
  static readonly MIN_EMAIL_DELAY_MINUTES = 5;
  static readonly DEFAULT_DAILY_LIMIT = 100;

  static async checkEmailThrottling(
    userId: string,
    senderEmail: string,
    supabase: any
  ): Promise<{ canSend: boolean; waitTime?: number; reason?: string }> {
    try {
      const { data, error } = await supabase
        .from('email_throttling_state')
        .select('*')
        .eq('user_id', userId)
        .eq('sender_email', senderEmail)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const now = new Date();
      
      if (!data) {
        // No throttling record exists, create one
        await supabase
          .from('email_throttling_state')
          .insert({
            user_id: userId,
            sender_email: senderEmail,
            last_email_sent_at: now.toISOString(),
            emails_sent_today: 1,
            daily_limit: this.DEFAULT_DAILY_LIMIT,
          });
        
        return { canSend: true };
      }

      // Check daily limit
      const lastSent = new Date(data.last_email_sent_at);
      const isToday = lastSent.toDateString() === now.toDateString();
      
      if (isToday && data.emails_sent_today >= data.daily_limit) {
        return {
          canSend: false,
          reason: `Daily email limit reached (${data.daily_limit})`
        };
      }

      // Check minimum delay
      const timeSinceLastEmail = now.getTime() - lastSent.getTime();
      const minDelayMs = this.MIN_EMAIL_DELAY_MINUTES * 60 * 1000;
      
      if (timeSinceLastEmail < minDelayMs) {
        const waitTime = Math.ceil((minDelayMs - timeSinceLastEmail) / 1000 / 60);
        return {
          canSend: false,
          waitTime,
          reason: `Must wait ${waitTime} minutes between emails`
        };
      }

      return { canSend: true };
    } catch (error) {
      console.error('Error checking email throttling:', error);
      return { canSend: false, reason: 'Error checking throttling status' };
    }
  }

  static async updateEmailThrottling(
    userId: string,
    senderEmail: string,
    supabase: any
  ): Promise<void> {
    try {
      const now = new Date();
      
      await supabase
        .from('email_throttling_state')
        .upsert({
          user_id: userId,
          sender_email: senderEmail,
          last_email_sent_at: now.toISOString(),
          emails_sent_today: 1,
          updated_at: now.toISOString(),
        }, {
          onConflict: 'user_id,sender_email'
        });
    } catch (error) {
      console.error('Error updating email throttling:', error);
    }
  }
}