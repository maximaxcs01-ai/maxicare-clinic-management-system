const crypto = require("node:crypto");

const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const NUMBERS = "23456789";
const SPECIAL = "!@#$%&*?";
const ALL_CHARACTERS = `${UPPERCASE}${LOWERCASE}${NUMBERS}${SPECIAL}`;

const randomCharacter = (characters) =>
  characters[crypto.randomInt(0, characters.length)];

const generateTemporaryPassword = (length = 12) => {
  if (!Number.isInteger(length) || length < 10 || length > 16) {
    throw new RangeError("Temporary password length must be between 10 and 16");
  }

  const characters = [
    randomCharacter(UPPERCASE),
    randomCharacter(LOWERCASE),
    randomCharacter(NUMBERS),
    randomCharacter(SPECIAL),
  ];

  while (characters.length < length) {
    characters.push(randomCharacter(ALL_CHARACTERS));
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(0, index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }

  return characters.join("");
};

module.exports = { generateTemporaryPassword };
