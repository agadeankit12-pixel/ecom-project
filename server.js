// server.js
require('dotenv').config();
const { PORT } = require('./src/config');
const app = require('./src/app');

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
