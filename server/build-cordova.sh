#!/bin/sh

cd www/js
java -Xmx1024m -classpath ../../java/rhino.jar:../../java/compiler.jar org.mozilla.javascript.tools.shell.Main /opt/local/bin/r.js -o cordova.build.js
