// index.js
import express from 'express';
import morgan from 'morgan';

const app = express();
const PORT = 3000;

app.use(morgan('dev')); // Logging middleware

app.get('/', (req, res) => {
  res.send('Hello from Express on Bun!');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
