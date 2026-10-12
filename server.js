require("dotenv").config();

const app = require("./api/app");

const port = Number(process.env.PORT) || 3001;

app.listen(port, () => {
  console.log(`Webhook API listening on http://localhost:${port}`);
});
