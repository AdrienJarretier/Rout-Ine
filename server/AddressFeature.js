class AddressFeature {
  constructor(address) {

    this.type = 'Feature';
    this.geometry = {
      type: 'Point',
      coordinates: [address.lng, address.lat]
    };
    this.properties = {
      label: address.label,
      town: address.town,
      beneficiaries: [],
      tour: {
        num: address.num,
        index_in_tour: address.index_in_tour
      }
    };

    if (address.special != undefined)
      this.properties.special = address.special;

    this.id = address.id;
  }

  addBeneficiaries(ben) {

    // console.log('** ben **');
    // console.log(ben);

    this.properties.beneficiaries = ben;
  }

  addBeneficiary(ben) {
    this.properties.beneficiaries.push(ben);
  }

  get coordinates() {
    return this.geometry.coordinates;
  }

  setWaypointIndex(w_ind) {
    this.properties.waypoint_index = w_ind;
  }
}

// exporte la definition de la classe
// nodejs peut alors charger ce fichier comme un module qui construit AddressFeature
module.exports = AddressFeature;
