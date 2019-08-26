const config = require('./config.json');
const crypto = require('crypto');
const { Datastore } = require('@google-cloud/datastore');

const datastore = new Datastore();

const badRequestText = 'Bad Request';
const unableToSaveText = 'Unable to save favorites';
const unableToRetrieveText = 'Unable to retrieve favorites';
const notFoundText = 'Not Found';

const validPhone = number => /^[0-9]{10}$/.test(number) ? true : false;
const hashPhone = number => crypto.createHash('sha256').update(number).digest('hex').substr(0, 10);
const getGeneratedKey = hashedPhone => datastore.key([config.favorites.datastoreKey, hashedPhone]);

const saveFavorites = (hashedPhone, favorites) => {
  return datastore.save({
    key: getGeneratedKey(hashedPhone),
    data: {
      favorites: favorites,
      timestamp: new Date(),
    }
  });
};

const getFavorites = hashedPhone => {
  const key = getGeneratedKey(hashedPhone);
  const query = datastore
    .createQuery(config.favorites.datastoreKey)
    .filter('__key__', key);
  return datastore.runQuery(query);
};

exports.save = (req, res) => {
  if (!req.body) res.status(400).send(badRequestText);
  try {
    const phone = (req.body.id + '').trim();
    if (validPhone(phone) && req.body.favorites) {
      const hashedPhone = hashPhone(phone);
      saveFavorites(hashedPhone, req.body.favorites).then(() => {
        res.sendStatus(202);
      }, (error) => {
        console.log(error);
        res.send(500).send(unableToSaveText);
      });
    } else {
      res.status(400).send(badRequestText);
    }
  } catch (error) {
    console.log(error);
    res.status(500).send(unableToSaveText);
  }
};

exports.retrieve = async (req, res) => {
  if (!req.body) res.status(400).send(badRequestText);
  try {
    const phone = (req.body.id + '').trim();
    if (validPhone(phone)) {
      const hashedPhone = hashPhone(phone);
      getFavorites(hashedPhone).then((entity) => {
        if (entity[0].length >= 1 && entity[0][0].favorites) {
          res.status(200)
            .set('Content-Type', 'application/json')
            .send(entity[0][0].favorites)
            .end();
        } else {
          res.status(404).send(notFoundText);
        }
      }, (error) => {
        console.log(error);
        res.status(500).send(unableToRetrieveText);
      });
    } else {
      res.status(400).send(badRequestText);
    }
  } catch (error) {
    console.log(error);
    res.status(500).send(notFoundText);
  }
};
