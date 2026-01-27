require("dotenv").config();
console.log("DP:", process.env.MS_DP);
console.log("Username:", process.env.MS_USERNAME);
console.log("Password:", process.env.MS_PASSWORD ? "****" : "missing");
