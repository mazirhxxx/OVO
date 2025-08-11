export class SecurityManager {
  static readonly INPUT_LIMITS = {
    TEXT_SHORT: 255,
    TEXT_MEDIUM: 1000,
    TEXT_LONG: 5000,
    EMAIL: 320,
    PHONE: 20,
    URL: 2048,
  };

  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential XSS characters
      .substring(0, this.INPUT_LIMITS.TEXT_MEDIUM);
  }

  static sanitizeUrl(url: string): string {
    if (typeof url !== 'string') return '';
    
    try {
      const parsedUrl = new URL(url);
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return '';
      }
      return parsedUrl.toString().substring(0, this.INPUT_LIMITS.URL);
    } catch {
      return '';
    }
  }

  static sanitizeEmail(email: string): string {
    if (typeof email !== 'string') return '';
    
    return email
      .trim()
      .toLowerCase()
      .substring(0, this.INPUT_LIMITS.EMAIL);
  }

  static sanitizePhone(phone: string): string {
    if (typeof phone !== 'string') return '';
    
    return phone
      .trim()
      .replace(/[^\d\+\-\(\)\s]/g, '') // Only allow digits, +, -, (), and spaces
      .substring(0, this.INPUT_LIMITS.PHONE);
  }
}