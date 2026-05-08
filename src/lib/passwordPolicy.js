export const PASSWORD_POLICY_RULES = [
    {
        id: 'length',
        label: 'Minimum of 8 characters',
        test: (password) => password.length >= 8,
    },
    {
        id: 'uppercase',
        label: 'At least one uppercase letter',
        test: (password) => /[A-Z]/.test(password),
    },
    {
        id: 'lowercase',
        label: 'At least one lowercase letter',
        test: (password) => /[a-z]/.test(password),
    },
    {
        id: 'numberOrSpecial',
        label: 'At least one number or special character',
        test: (password) => /[\d\W_]/.test(password),
    },
];

export function getPasswordValidation(password = '') {
    const normalizedPassword = String(password);
    const checks = PASSWORD_POLICY_RULES.map((rule) => ({
        ...rule,
        passed: rule.test(normalizedPassword),
    }));

    return {
        checks,
        isValid: checks.every((rule) => rule.passed),
    };
}

export const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include uppercase, lowercase, and a number or special character.';
