const bcrypt = require('bcrypt');
const hashFromDB = "$2b$10$vD2c1XW0XuZVgw9Y4WFbI.9xVwvvosWYpDuK72ncY2IzpdybSDnAe";
const password = "admin123";

const isMatch = bcrypt.compareSync(password, hashFromDB);
console.log("Match?", isMatch); // should print true
console.log(bcrypt.hashSync("admin123", 10));
