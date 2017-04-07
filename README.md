### Installer NodeJs sur Ubuntu

```bash
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install -y nodejs
```
pour d'autres systèmes : [Installing Node.js](https://nodejs.org/en/download/package-manager/#installing-node-js-via-package-manager)

### Configurer le serveur

```bash
cd server
npm install
```
configuration dans `config.json`

### Démarrer le serveur
```bash
node .
```

C'est tout, `ctrl-c` pour arrêter le serveur


## OSRM

[Dépendances Ubuntu](https://github.com/Project-OSRM/osrm-backend/wiki/Building-on-Ubuntu#ubuntu-1604)

[Compilation et installation](https://github.com/Project-OSRM/osrm-backend/wiki/Building-OSRM#general-build-instructions-from-source)

Pour démarrer avec OSRM il faut d'abord des données Open Street Map
on peut en obtenir sur (https://mapzen.com/data/metro-extracts),
Télécharger les données au format **osm.pbf**

Mon fichier utilisé sera ici nommée **albi_large.osm.pbf** :

Les données de routage vont pouvoir être extraites et normalisée par `osrm-extract`

Nous sommes intéressés par le routage routier uniquement, nous allons donc utliser le profil par défaut voitures `car.lua` :

`osrm-extract albi_large.osm.pbf -p /usr/local/share/osrm/profiles/car.lua`

Si OSRM a besoin de trop de mémoire il est préférable d'allouer un fichier de swap :

```bash
fallocate -l 100G /path/to/swapfile
chmod 600 /path/to/swapfile
mkswap /path/to/swapfile
swapon /path/to/swapfile
```

Le résultat de `osrm-extract` est un fichier **albi_large.osrm** entre autres.

L'étape finale de préparation est l'exécution de `osrm-contract` :

`osrm-contract albi_large.osrm`

Le serveur est fin prêt !

### Lancement du serveur osrm :

`osrm-routed albi_large.osrm`

Le serveur écoute sur le port 5000 par défaut, un test dans le navigateur sur l'ip du serveur et le port 5000 doit retourner du json similaire à

```json
{
  "message":"URL string malformed close to position 1: \"\/\"",
  "code":"InvalidUrl"
}
```
















