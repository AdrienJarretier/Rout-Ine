class AddressFeature {
  constructor(address) {
    this.type = 'Feature';
    this.geometry = {
      type: 'Point',
      coordinates: [address.lng, address.lat]
    };
    this.properties = {
      label: address.label,
      additional: address.additional,
      town: address.town,
      beneficiaries: [],
      phones: []
    };
    this.id = address.id;
  }

  addBeneficiaries(ben) {

    this.properties.beneficiaries = ben;
  }

  addPhones(phones) {

    for (let phone of phones) {

      this.properties.phones.push(phone.phone_number);
    }
  }

  get coordinates() {
    return this.geometry.coordinates;
  }
}

// exporte la definition de la classe
// nodejs peut alors charger ce fichier comme un module qui construit AddressFeature
module.exports = AddressFeature;
