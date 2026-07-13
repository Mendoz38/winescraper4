const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const basicAuth = require('express-basic-auth');

const app = express();
app.use(morgan('dev'));
app.use(
  cors({
    origin: ['http://localhost:3000', 'https://scrapper.vinsnaturels.fr', 'https://boutique.vinsnaturels.fr'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));

const port = process.env.PORT;
const users = JSON.parse(process.env.USERS);
// app.use(
//   basicAuth({
//     users: users,
//     challenge: true,
//   })
// );

const scraperRoutes = require('./app/scraperRoutes');

//appel des routes
scraperRoutes(app);

app.listen(port, function () {
  console.log(`App listening on port ${port}`);
});
