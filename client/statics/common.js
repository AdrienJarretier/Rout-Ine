'use strict';

function addLine(string, line) {
  return string + '<br>' + line;
}

function fillResultsInfo(infosBlockId, bestResult, markersColors) {

  let infosList = $(infosBlockId);

  infosList.append($('<div class="row">').append($('<div class="col-xs-12">')).html("génération " +
    bestResult.genNumber));
  infosList.append($('<div class="row">').append($('<div class="col-xs-12">')).text('id partition : ' +
    bestResult.partitionId));
  infosList.append($('<div class="row">').append($('<div class="col-xs-12">')).text('obtenu en ' + utils.s2hours(
    bestResult.totalTime / 1000, true)));

  let tours = bestResult.trips;

  for (let i in tours) {

    let tour = tours[i];

    let colorColumnSize = 5;

    infosList.append($('<div class="row">')
      .append($('<div class="col-xs-' + colorColumnSize + '">').text(markersColors[i] + ' : ').css('color',
        markersColors[i]))
      .append($('<div class="col-xs-' + (12 - colorColumnSize) + '">').text(utils.s2hours(tour.trip.trips[0]
        .duration, false) + '( ' + (tour.addresses.features.length - 1) + ' )').css('color',
        markersColors[i])));

  }

  infosList.append($('<br>'));

}
