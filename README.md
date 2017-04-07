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
