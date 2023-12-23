const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const yargs = require('yargs');

const { ports, ssl } = require('./config/config-server');

const argv = yargs.option('httpOnly', {
  alias: 'http',
  type: 'boolean',
  description: 'Run the server without HTTP.',
  default: false,
}).parse();

const checkLoginResponse = (loginDataString) => {
  if (loginDataString.charAt(0) === ']') {
    const loginData = JSON.parse(loginDataString.substring(1));
    return loginData.actionsuccess === true;
  }

  return false;
};

const checkRegisteredResponse = (loginDataString) => {
  if (loginDataString.charAt(0) === ']') {
    const loginData = JSON.parse(loginDataString.substring(1));
    return !('actionerror' in loginData);
  }

  return false;
};

const app = express();
app.use(cors());

app.use(bodyParser.urlencoded({ extended: true }));
app.use('*.php', (request, response) => response.sendStatus(404));
app.get('/lobby-banner', (request, response) => {
  const banners = fs.readdirSync('./banners');
  const banner = banners[Math.floor(Math.random() * banners.length)];

  response.sendFile(path.join(__dirname, 'banners', banner));
});
app.get('*', (request, response, next) => {
  if (request.path.startsWith('/sprites/afd')) {
    const afdPath = path.join(__dirname, 'public', request.path);
    if (!fs.existsSync(afdPath)) {
      return response.redirect(request.path.replace('/sprites/afd', '/sprites/gen5'));
    }
  }

  next();
});
app.use(express.static('./public', { index: 'index.html', fallthrough: true }));
app.get('*', (request, response) => {
  response.sendFile(path.join(__dirname, './public/index.html'));
});

if (argv.httpOnly) {
  const httpServer = http.createServer(app);
  httpServer.listen(ports.http, () => console.log(`Listening on ${ports.http}`));
} else {
  const privateKey  = fs.readFileSync(ssl.privateKeyPath, 'utf8');
  const certificate = fs.readFileSync(ssl.certificatePath, 'utf8');

  const httpRedirectApp = express();
  httpRedirectApp.use('*', (request, response) => {
    response.redirect("https://" + request.headers.host + request.url);
  });

  const httpRedirectServer = http.createServer(httpRedirectApp);
  const httpsServer = https.createServer({ key: privateKey, cert: certificate }, app);

  httpRedirectServer.listen(ports.http, () => console.log(`Http redirect listening on ${ports.http}`));
  httpsServer.listen(ports.https, () => console.log(`Listening on ${ports.https}`));
}
