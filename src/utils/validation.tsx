export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class InputValidator {
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    
    if (!email || email.trim() === '') {
      errors.push('Email is required');
      return { isValid: false, errors };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Please enter a valid email address');
    }

    if (email.length > 320) {
      errors.push('Email address is too long');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validatePhone(phone: string): ValidationResult {
    const errors: string[] = [];
    
    if (!phone || phone.trim() === '') {
      errors.push('Phone number is required');
      return { isValid: false, errors };
    }

    // Remove all non-digit characters for validation
    const digitsOnly = phone.replace(/\D/g, '');
    
    if (digitsOnly.length < 10) {
      errors.push('Phone number must be at least 10 digits');
    }

    if (digitsOnly.length > 15) {
      errors.push('Phone number is too long');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateUrl(url: string, required: boolean = false): ValidationResult {
    const errors: string[] = [];
    
    if (!url || url.trim() === '') {
      if (required) {
        errors.push('URL is required');
      }
      return { isValid: !required, errors };
    }

    try {
      new URL(url);
    } catch {
      errors.push('Please enter a valid URL');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateText(text: string, options: {
    required?: boolean;
    maxLength?: number;
    fieldName?: string;
  } = {}): ValidationResult {
    const errors: string[] = [];
    const { required = false, maxLength = 1000, fieldName = 'Field' } = options;
    
    if (!text || text.trim() === '') {
      if (required) {
        errors.push(`${fieldName} is required`);
      }
      return { isValid: !required, errors };
    }

    if (text.length > maxLength) {
      errors.push(`${fieldName} must be less than ${maxLength} characters`);
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateCampaignData(data: {
    offer: string;
    calendar_url: string;
    goal: string;
  }): ValidationResult {
    const errors: string[] = [];

    if (!data.offer || data.offer.trim() === '') {
      errors.push('Campaign offer is required');
    }

    if (!data.calendar_url || data.calendar_url.trim() === '') {
      errors.push('Calendar URL is required');
    } else {
      const urlValidation = this.validateUrl(data.calendar_url, true);
      if (!urlValidation.isValid) {
        errors.push('Please enter a valid calendar URL');
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}