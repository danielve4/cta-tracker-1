const request = require('request');
const express = require('express');
const train = require('./train');
const app = express();

app.use(express.static('public'));

app.set('port', (process.env.PORT || 5000));

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', "*");
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Cache-Control');
  req.method === 'OPTIONS' ? res.sendStatus(200) : next();
});

app.get('/busroutes', (req, res) => {
  request('http://google.com', function (error, response, body) {
    console.log('error:', error); // Print the error if one occurred and handle it
    console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
    res.send(body);
  });
});

app.get('/busroutedirections', (req, res) => {
});

app.get('/busroutestops', (req, res) => {
});

app.get('/busstoparrivals', (req, res) => {
});

app.get('/busfollow', (req, res) => {
});

app.get('/trainstops', train.stops);

app.get('/trainfollow', train.follow);

app.listen(app.get('port'), () => {
  console.log('Node app is running on port', app.get('port'));
});
