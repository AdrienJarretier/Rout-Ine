const async = require('async');
const common = require('./common.js');
const request = require('request');


let requestsQ = async.queue(function(task, callback) {

  console.log(task);

  request(task.requestUrl, (error, response, body) => {

    if (error) {

      common.logError(JSON.stringify(error));
      console.log('error:', error); // Print the error if one occurred

    } else {

      let response = JSON.parse(body);
      callback(response);

    }
  });

}, 1);


// $config['geocoding']['api']="google";
// $config['geocoding']['enable']="1";

// require_once 'geo.php';
// require_once 'log.php';

geocode_google('4, Allée Alphonse Daudet 81000 ALBI')
  .then((coordinates) => {

    console.log(coordinates);

  });


function geocode_google(address) {

  return new Promise((resolve, reject) => {

    const requestUrl = "http://maps.googleapis.com/maps/api/geocode/json?sensor=false&address=" + encodeURIComponent(address);

    requestsQ.push({ requestUrl: requestUrl }, function(response) {

      // console.log(JSON.stringify(response.results[0].geometry.location, null, 2));

      if (response['status'] == 'OK') {

        // Use google data only with good status response

        let coordinates = response.results[0].geometry.location;

        common.logInfo('adresse [' + address + '] géocodée avec google, (' + coordinates['lat'] + ', ' + coordinates['lng'] + ')');

        resolve(coordinates);

      } else if (response['status'] == 'OVER_QUERY_LIMIT') {

        reject("STATUS Goole Ko trop de demande");

      } else if (response['status'] == 'ZERO_RESULTS') {

        //  couldn't geocode this address
        reject("aucun résultat");

      } else {

        reject(response['status']);

      }



      // let coordinates = {
      //   'lat': bestFeature.geometry.coordinates[1],
      //   'lng': bestFeature.geometry.coordinates[0]
      // };

      // common.logInfo('adresse [' + address + '] géocodée avec google (score ' + bestScore + '), (' + coordinates['lat'] + ', ' + coordinates['lng'] + ')';

      //   resolve(coordinates);
    });

  });





  // $location;

  // try {
  //   $location = get_geolocation($address);
  // } catch (Exception $e) {
  //   throw $e;
  // }

  // $coordinates = {
  //   'lat': $location['location_lat'],
  //   'lng': $location['location_lon']
  // };

  // writeInLog('adresse ['.$address.
  //   '] géocodée avec google ('.$coordinates['lat'].
  //   ', '.$coordinates['lng'].
  //   ')');

  // return $coordinates;
}





function geocode_ban(address) {

  return new Promise((resolve, reject) => {

    const requestUrl = 'http://api-adresse.data.gouv.fr/search/?q=' + encodeURIComponent(address);

    requestsQ.push({ requestUrl: requestUrl }, function(response) {

      let i = 0;
      let bestScore = 0.0;
      let bestI = 0;

      for (let feature of response.features) {

        let score = feature.properties.score;
        if (score > bestScore) {
          bestScore = score;
          bestI = i;
        }

        ++i;
      }

      if (i == 0) {
        reject('no response from ban');
      }

      let bestFeature = response.features[bestI];

      let coordinates = {
        'lat': bestFeature.geometry.coordinates[1],
        'lng': bestFeature.geometry.coordinates[0]
      };

      common.logInfo('adresse [' + address + '] géocodée avec ban (score ' + bestScore + '), (' + coordinates['lat'] + ', ' + coordinates['lng'] + '), autres possibilités : ' + (i - 1));

      resolve(coordinates);
    });

  });

};


// function geocode(addressObject) {

//   const address = addressObject.label.
//   " ".addressObject.town;

//   const MAX_TRIALS = 2;

//   let currentTry = 0;
//   while (currentTry < MAX_TRIALS) {
//     try {

//       let coords;

//       switch (currentTry) {
//         case 0:
//           coords = geocode_google(address);
//           break;

//         case 1:
//           coords = geocode_ban(address);
//           break;

//         default:
//           break;
//       }

//       return coords;
//     } catch (Exception $e) {

//       ++$currentTry;

//       switch ($currentTry) {

//         case $MAX_TRIALS:
//           throw $e;
//           break;

//         default:
//           break;
//       }
//     }
//   }
// }
