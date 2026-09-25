export const isValidEmail = (email) => {
  const value = String(email || "").trim();

  if (!value || value.length > 254) {
    return false;
  }

  // Accept personal, school, work, and other normal email domains.
  // This checks email structure only; mailbox ownership is verified
  // separately through the account/email verification flow.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
};
