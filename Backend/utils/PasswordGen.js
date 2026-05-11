function generateSecurePassword(length = 12) {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*";
  const all = uppercase + lowercase + numbers + special;

  const getRandom = (str) => str[Math.floor(Math.random() * str.length)];

  // Ensure password includes one of each type
  let password = [
    getRandom(uppercase),
    getRandom(lowercase),
    getRandom(numbers),
    getRandom(special),
  ];

  // Fill the rest of the password
  while (password.length < length) {
    password.push(getRandom(all));
  }

  // Shuffle password
  return password.sort(() => 0.5 - Math.random()).join("");
}
module.exports = generateSecurePassword;
