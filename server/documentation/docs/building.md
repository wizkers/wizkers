#Building Wizkers

## Prerequisites

The only prerequisite for building (and running Wizkers in server mode) are NodeJS and npm.

You will need to install a recent 0.10 version of NodeJS – Wizkers is not tested on Node 0.12 yet. You can refer to [this guide](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager#debian-and-ubuntu-based-linux-distributions) for details on how to do this on Linux, in particular.

## Check out the code

Wizkers is hosted on [github](https://github.com/wizkers/wizkers). Create a work directory on your machine and check out the code from Github, and go to the 'release' branch:

```bash
mkdir wizkers; cd wizkers
git clone https://github.com/wizkers/wizkers.git
cd wizkers/server
git checkout release
```

## Build it

Wizkers supports the [Helium](http://www.helium.com/) IoT network for some of its instruments. The NodeJS "nodhelium" module requires installing "libhelium" on your system. If you don't have any idea what Helium is about, you definitely don't need it, and you can edit out the two locations on Wizkers which depend on libhelium:

* server/package.json
* server/connectionmanager.js (line 45)

The next step is to install all dependencies using npm:

```bash
npm install
```

This can take from a couple of minutes to quite some time if you are building on a low power system such as a Beaglebone.

Once all dependencies are installed, Wizkers uses 'gulp' as its build system: if gulp is not installed on your system already, use npm to get it:

```bash
npm install -g gulp
```

You can now build Wizkers in its three supported modes:

```bash
gulp chrome
gulp cordova
gulp android
```

Those three gulp targets will build Wizkers in the `dist` directory

## Finalizing and packaging

Once the base code is built through Gulp, the instructions below will show you how to finalize the build for the various run modes and launch Wizkers:

### Chrome app

After building, the Chrome version of Wizkers will be ready in `dist/chrome` and `dist/chrome-debug`. The `chrome-debug` directory can be immediately loaded into Google Chrome by visiting (chrome://extensions) and loading Wizkers from there.

The `chrome` version requires finalizing the compilation by launching `build-toold/build-chrome.sh` which will optimize the javascript code. The resulting Chrome app in `dist/chrome` will run faster but it won't be possible to debug it easily.

### Cordova (Android app)

The Android app version of Wizker uses the Cordova framework to package Wizkers into a native Android application.


### Server

The server build of Wizkers is available in `dist/server`. Simply go to that directory and launch the server:

```bash
cd dist/server
node server.js
```

