const config = require('./config.json');

exports.stopArrivals = async (req, res) => {
  const mapId = req.query.stopId;
  const url = `${config.train.baseURL}/ttarrivals.aspx?key=${config.train.APIKey}&mapId=${mapId}&outputType=JSON`;
  await commonRequest(url, res);
};

exports.follow = async (req, res) => {
  const runNumber = req.query.vehicleId;
  const url = `${config.train.baseURL}/ttfollow.aspx?key=${config.train.APIKey}&runnumber=${runNumber}&outputType=JSON`;
  await commonRequest(url, res);
};

async function commonRequest(url, res) {
  res.type('json');
  try {
    const response = await fetch(url);
    const body = await response.text();
    res.send(body);
  } catch (error) {
    console.error('CTA Train API error:', error.message);
    res.status(503).send({ error: 'Unable to reach CTA services.' });
  }
}
