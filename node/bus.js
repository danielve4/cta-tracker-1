const config = require('./config.json');

exports.routes = async (req, res) => {
  const url = `${config.bus.baseURL}/getroutes?key=${config.bus.APIKey}&format=json`;
  await commonRequest(url, res);
};

exports.directions = async (req, res) => {
  const route = req.query.route;
  const url = `${config.bus.baseURL}/getdirections?key=${config.bus.APIKey}&rt=${route}&format=json`;
  await commonRequest(url, res);
};

exports.routeStops = async (req, res) => {
  const route = req.query.route;
  const direction = req.query.direction;
  const url = `${config.bus.baseURL}/getstops?key=${config.bus.APIKey}&rt=${route}&dir=${direction}&format=json`;
  await commonRequest(url, res);
};

exports.stopArrivals = async (req, res) => {
  const stopId = req.query.stopId;
  const url = `${config.bus.baseURL}/getpredictions?key=${config.bus.APIKey}&stpid=${stopId}&format=json`;
  await commonRequest(url, res);
};

exports.follow = async (req, res) => {
  const vehicleId = req.query.vehicleId;
  const url = `${config.bus.baseURLv3}/getpredictions?key=${config.bus.APIKey}&vid=${vehicleId}&tmres=s&format=json`;
  await commonRequest(url, res);
};

async function commonRequest(url, res) {
  res.type('json');
  try {
    const response = await fetch(url);
    const data = await response.json();
    res.send(data['bustime-response']);
  } catch (error) {
    console.error('CTA Bus API error:', error.message);
    res.status(503).send({ error: 'Unable to reach CTA services.' });
  }
}
