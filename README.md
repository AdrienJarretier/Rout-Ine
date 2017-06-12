# Rout-Ine

Le serveur osrm est démonisé avec supervisor `sudo apt install supervisor`

config :
```bash
sudo nano /etc/supervisor/conf.d/osrm.conf

[program:osrm]
directory=/chemin/absolu/dossier/contenant/albi_large.osrm
command=osrm-routed albi_large.osrm --max-trip-size 1000 --max-table-size 700
user=[utilisateur propriétaire du processus osrm-routed]
```

le processus node exécutant Rout-Ine peut aussi être démonisé avec supervisor

config :
```bash
sudo nano /etc/supervisor/conf.d/rout-ine.conf

[program:rout-ine]
directory=/chemin/absolu/Rout-Ine/server
command=node .
user=[utilisateur propriétaire du processus rout-ine]
```

Il suffit ensuite de redémarrer le service supervisor
```bash
sudo service supervisor restart
```

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

Le fichier `utils.js` qui se trouve dans le dossier client ne doit pas être modifié directement, c'est en fait la version "navigateur" du fichier server/utils.js obtenu avec les modules `browserify` et `watchify`

installation globales de ces modules :

`npm instal -g browserify watchify`

utilisation :

```bash
watchify utils.js -o ../client/statics/utils.js -s utils -v
```

### Installer la base de données

L'application fonctionne avec une base de données MySQL qui doit être créée avec le script [ccas_food_delivery_tours.sql](https://github.com/AdrienJarretier/Rout-Ine/blob/master/ccas_food_delivery_tours.sql)

les paramètres de connexion à la base sont présents dans [config.json](https://github.com/AdrienJarretier/Rout-Ine/blob/master/server/config.json)

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

Je conseille d'enregistrer ce fichier dans un dossier dédié à cette carte

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

`osrm-routed albi_large.osrm --max-trip-size 1000 --max-table-size 700`

L'option `--max-trip-size` spécifie le maximum de coordonnées que le serveur acceptera pour le service `trip`
L'option `--max-table-size` spécifie le maximum de coordonnées que le serveur acceptera pour le service `table`

Le serveur écoute sur le port 5000 par défaut, un test dans le navigateur sur l'ip du serveur et le port 5000 doit retourner du json similaire à

```json
{
  "message":"URL string malformed close to position 1: \"\/\"",
  "code":"InvalidUrl"
}
```
















