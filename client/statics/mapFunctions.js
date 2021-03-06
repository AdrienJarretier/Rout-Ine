'use strict';

const markersColors = ["orange", "purple", "blue", "green", "red", "black", "darkred", "cadetblue",
  "lightgreen", "pink"
];

function initMap() {

  const MAPBOX_ACCESS_TOKEN =
    'pk.eyJ1IjoibXJmcmVlemUiLCJhIjoiY2owNWg2a2kyMDA2cjMycGZndzA2ZzZneCJ9.-wsVwihnGBO41Z9FvV_UAQ';

  let map = L.map('map').setView([43.93002883039214, 2.1581183602941194], 13);

  L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox.streets',
    accessToken: MAPBOX_ACCESS_TOKEN
  }).addTo(map);

  return map;
}

function addressesMarkers(addresses, color) {



  function markerMaker(address_index) {

    let address_coords = addresses[address_index].geometry.coordinates;

    let lat = address_coords[1];
    let lng = address_coords[0];

    let feature = addresses[address_index];

    let p = feature.properties;

    let marker = L.marker([lat, lng], {
      icon: new L.AwesomeNumberMarkers({
        number: p.waypoint_index,
        markerColor: color
      })
    });

    let popContent = p.label + (p.special != undefined ? ', ' + p.special : '') + ', ' + p.town;

    for (let b of p.beneficiaries) {

      let line = b.name;

      let isAnniversary = false;

      if (b.birthdate != null) {

        let now = new Date(Date.now());
        let birthdate = new Date(b.birthdate);

        isAnniversary = now.getDate() == birthdate.getDate() && now.getMonth() == birthdate.getMonth();

        // l'age de la personne en millisecondes
        let age = now - birthdate;

        let years = age / 31557600000

        line += ', ' + Math.floor(years) + ' ans';
      }

      line += ' - ' + b.address_additional + ' - ';

      popContent = addLine(popContent, line);

      if (isAnniversary) {

        popContent = addLine(popContent, '<img src="cake-with-2-candles-md.png">');
      }

    }

    marker.bindPopup(popContent);

    return marker;
  }


  let markersLayer = L.layerGroup();


  for (let i in addresses) {

    markersLayer.addLayer(markerMaker(i));
  }

  return markersLayer;
}
