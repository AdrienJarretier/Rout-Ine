

const request = require('request');



$config['geocoding']['api']="google";
$config['geocoding']['enable']="1";

require_once 'geo.php';
require_once 'log.php';

function geocode_google($address) {

  $location;

  try {
    $location = get_geolocation($address);
  }
  catch (Exception $e) {
    throw $e;
  }

  $coordinates = [
    'lat' => $location['location_lat'],
    'lng' => $location['location_lon']
  ];

  writeInLog('adresse ['.$address.'] géocodée avec google ('.$coordinates['lat'].', '.$coordinates['lng'].')');

  return $coordinates;
}


function geocode_ban($address) {

  $url = 'http://api-adresse.data.gouv.fr/search/?q=';

  $request = $url.urlencode($address);

  $response = json_decode(file_get_contents($request));

  $i=0;
  $bestScore = 0.0;
  $bestI = 0;

  foreach($response->features as $feature) {

    $score = $feature->properties->score;
    if( $score > $bestScore ) {
      $bestScore = $score;
      $bestI = $i;
    }

    ++$i;
  }

  if($i == 0) {
    throw new Exception('no response from ban');
  }

  $bestFeature = $response->features[$bestI];

  $coordinates = [
    'lat' => $bestFeature->geometry->coordinates[1],
    'lng' => $bestFeature->geometry->coordinates[0]
  ];

  writeInLog('adresse ['.$address.'] géocodée avec ban (score '.$bestScore.'), ('.$coordinates['lat'].', '.$coordinates['lng'].'), autres possibilités : '.($i-1));

  return $coordinates;
}

/**
 * param beneficiary one record of parseCsv.parseBeneficiaries() result
 *
 * returns array with latitude and longitude
 *
 * throws Exception if the address is invalid and couldn't be geocoded by google api
 */
function geocode($beneficiary) {

  $address = $beneficiary["address"] . " " . $beneficiary["town"];

  $MAX_TRIALS = 2;
  $currentTry = 0;
  while($currentTry < $MAX_TRIALS) {
    try {

      $coords;

      switch($currentTry) {
        case 0:
          $coords = geocode_google($address);
        break;

        case 1:
          $coords = geocode_ban($address);
        break;

        default:
        break;
      }

      return $coords;
    }
    catch (Exception $e) {

      ++$currentTry;

      switch($currentTry) {

        case $MAX_TRIALS:
          throw $e;
        break;

        default:
        break;
      }
    }
  }
}
