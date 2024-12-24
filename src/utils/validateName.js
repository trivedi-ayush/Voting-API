const validNameParty = /^[a-zA-Z\s]+$/;

const validateName = (name, property) => {
  if (!validNameParty.test(name)) {
    return `${property} must not include numbers or special characters.`;
  }
  return null;
};

module.exports = validateName;
