const express = require('express');
const train = require('./train');
const bus = require('./bus');
const favorites = require('./favorites');
const app = express();

app.use(express.static(__dirname + '/public'));
app.set('public', __dirname + '/public');

app.set('trust proxy', true);
app.set('port', (process.env.PORT || 8080));

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Cache-Control');
  req.method === 'OPTIONS' ? res.sendStatus(200) : next();
});

app.use(express.json());

app.get('/busroutes', bus.routes);
app.get('/busroutedirections', bus.directions);
app.get('/busroutestops', bus.routeStops);
app.get('/busstoparrivals', bus.stopArrivals);
app.get('/busfollow', bus.follow);

app.get('/trainstoparrivals', train.stopArrivals);
app.get('/trainfollow', train.follow);

app.post('/savefavorites', favorites.save);
app.post('/myfavorites', favorites.retrieve);

app.get('/*splat', (request, response) => {
  response.sendFile(__dirname + '/public/index.html');
});

app.listen(app.get('port'), '0.0.0.0', () => {
  console.log('Node app is running on port', app.get('port'));
});
