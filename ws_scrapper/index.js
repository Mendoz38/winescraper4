const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const basicAuth = require('express-basic-auth');

// accès aux variables d'environnement
var config = require('./.env');

const app = express();
app.use(morgan('dev'));
app.use(
  cors({
    origin: ['http://localhost:3000'],
    credentials: true,
  })
);
app.use(express.json());

const port = config.PORT;
const users = config.users;
app.use(
  basicAuth({
    users: users,
    challenge: true,
  })
);

const scraperRoutes = require('./app/scraperRoutes');

//appel des routes
scraperRoutes(app);

app.listen(port, function () {
  console.log(`App listening on port ${port}`);
});
