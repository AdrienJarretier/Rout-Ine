class FeatureCollection {
  constructor(featuresArray) {
    this.type = 'FeatureCollection';

    if (!featuresArray)
      this.features = [];
    else
      this.features = featuresArray;
  }

  push(feature) {
    this.features.push(feature);
  }

  get length() {
    return this.features.length;
  }
}

module.exports = FeatureCollection;
