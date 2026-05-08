const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include uppercase, lowercase, and a number or special character.';

export const validatePasswordPolicy = (password) => {
  const normalizedPassword = String(password || '');

  return {
    minLength: normalizedPassword.length >= 8,
    hasUppercase: /[A-Z]/.test(normalizedPassword),
    hasLowercase: /[a-z]/.test(normalizedPassword),
    hasNumberOrSpecial: /[\d\W_]/.test(normalizedPassword),
  };
};

export const isPasswordPolicyValid = (password) => {
  const checks = validatePasswordPolicy(password);
  return Object.values(checks).every(Boolean);
};

export { PASSWORD_POLICY_MESSAGE };
