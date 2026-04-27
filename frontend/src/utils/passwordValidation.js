/**
 * Password validation utility functions
 */

export const PASSWORD_RULES = {
  MIN_LENGTH: 6,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
};

export const validatePassword = (password) => {
  const issues = [];

  if (password.length < PASSWORD_RULES.MIN_LENGTH) {
    issues.push(`At least ${PASSWORD_RULES.MIN_LENGTH} characters`);
  }

  if (PASSWORD_RULES.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    issues.push('One uppercase letter (A-Z)');
  }

  if (PASSWORD_RULES.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    issues.push('One lowercase letter (a-z)');
  }

  if (PASSWORD_RULES.REQUIRE_NUMBER && !/\d/.test(password)) {
    issues.push('One number (0-9)');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
};

export const getPasswordStrength = (password) => {
  const validation = validatePassword(password);

  if (!password) {
    return { strength: 0, label: 'No password' };
  }

  const checkedRules = [
    password.length >= PASSWORD_RULES.MIN_LENGTH,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
  ].filter(Boolean).length;

  const strength = Math.ceil((checkedRules / 4) * 100);

  let label = 'Weak';
  if (strength >= 75) {
    label = 'Strong';
  } else if (strength >= 50) {
    label = 'Fair';
  }

  return { strength, label };
};
