export type AuthField = "email" | "password" | "form";

export type AuthFieldErrors = Partial<Record<AuthField, string>>;

export type AuthFormValues = {
  email: string;
  password: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAuthForm(
  values: AuthFormValues,
  context: "login" | "signup",
): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const email = values.email.trim();

  if (!email) {
    errors.email = "Enter your email address.";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Enter your password.";
  } else if (context === "signup" && values.password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }

  return errors;
}

function includesAny(text: string, phrases: string[]) {
  return phrases.some((phrase) => text.includes(phrase));
}

export function parseAuthError(
  message: string,
  context: "login" | "signup",
): AuthFieldErrors {
  const lower = message.toLowerCase();

  if (includesAny(lower, ["invalid login credentials", "invalid credentials"])) {
    return {
      form: "Incorrect email or password. Check both and try again.",
    };
  }

  if (includesAny(lower, ["email not confirmed", "confirm your email", "email confirmation"])) {
    return {
      email: "Confirm your email first, then log in again.",
      form: "Your email address is not confirmed yet.",
    };
  }

  if (
    includesAny(lower, [
      "user already registered",
      "already been registered",
      "already exists",
      "email address is already",
    ])
  ) {
    return {
      email: "An account with this email already exists. Try logging in instead.",
    };
  }

  if (includesAny(lower, ["invalid email", "unable to validate email", "valid email"])) {
    return { email: "Enter a valid email address." };
  }

  if (
    includesAny(lower, [
      "password should be at least",
      "password is too short",
      "weak password",
      "at least 6 characters",
    ])
  ) {
    return { password: "Password must be at least 6 characters." };
  }

  if (includesAny(lower, ["rate limit", "too many requests", "email rate limit"])) {
    return {
      form: "Too many attempts. Wait a moment and try again.",
    };
  }

  if (context === "login" && includesAny(lower, ["user not found"])) {
    return { form: "Incorrect email or password. Check both and try again." };
  }

  return { form: message };
}

export function hasFieldErrors(errors: AuthFieldErrors) {
  return Boolean(errors.email || errors.password || errors.form);
}

export function firstErrorField(errors: AuthFieldErrors): AuthField | null {
  if (errors.email) return "email";
  if (errors.password) return "password";
  if (errors.form) return "form";
  return null;
}
