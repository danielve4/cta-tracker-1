const express = require('express');
const train = require('./train');
const bus = require('./bus');
const app = express();

app.use(express.static('public'));

app.set('trust proxy', true);
app.set('port', (process.env.PORT || 8080));

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', "*");
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Cache-Control');
  req.method === 'OPTIONS' ? res.sendStatus(200) : next();
});

app.get('/busroutes', bus.routes);

app.get('/busroutedirections', bus.directions);

app.get('/busroutestops', bus.routeStops);

app.get('/busstoparrivals', bus.stopArrivals);

app.get('/busfollow', bus.follow);

app.get('/trainstoparrivals', train.stopArrivals);

app.get('/trainfollow', train.follow);

app.listen(app.get('port'), '0.0.0.0',() => {
  console.log('Node app is running on port', app.get('port'));
});
