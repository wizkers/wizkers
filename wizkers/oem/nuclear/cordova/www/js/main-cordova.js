/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * We now use require.js: these are the mappings of our application.
 *
 * This is the version of the require mappings that is used when compiling
 * for Cordova
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

require.config({

    baseUrl: 'js',

    paths: {
        app: 'app',
        tpl: 'tpl',

        // Below we manage our versions explicitely, so that
        // we can upgrade easily
        jquery: 'lib/jquery-2.2.4',
        backbone: 'lib/backbone-1.3.3',
        jquery_mousewheel: 'lib/jquery.mousewheel',
        jquery_xmlrpc: 'lib/jquery.xmlrpc',
        localstorage: 'lib/backbone.localStorage-2.0.0',
        bbindexeddb: 'lib/backbone-indexeddb',
        beehive: 'lib/beehive_picker',
        pouchdb: 'lib/pouchdb-5.0.0',
        backbonepouch: 'lib/backbone-pouch',
        underscore: 'lib/underscore-1.8.3',
        snap: 'lib/snap.svg-0.4.1',
        text: 'lib/text',
        paper: 'lib/paperjs-v0.10.2/dist/paper-core',

        bootstrap: 'lib/bootstrap',
        bootstrapslider: 'lib/bootstrap-slider-2.0.0',
        bootstrapeditable: 'lib/bootstrap-editable',
        bootbox: 'lib/bootbox',
        flot: 'lib/flot-0.8.3/jquery.flot',
        flot_time: 'lib/flot-0.8.3/jquery.flot.time',
        flot_resize: 'lib/flot-0.8.3/jquery.flot.resize',
        flot_selection: 'lib/flot-0.8.3/jquery.flot.selection',
        flot_fillbetween: 'lib/flot-0.8.3/jquery.flot.fillbetween',
        flot_windrose: 'lib/jquery.flot.windrose',
        flot_jumlib: 'lib/jquery.flot.JUMlib',
        flot_crosshair: 'lib/flot-0.8.3/jquery.flot.crosshair',
        flot_navigate: 'lib/flot-0.8.3/jquery.flot.navigate',

        // Analytics wrapper:
        ga_bundle: 'lib/google-analytics-bundle',
        stats: 'app/analytics',

        // WebRTC adapter shim to abstract from
        // navigator implementations
        peerjs: 'lib/peer-0.3.14',
        webrtc_adapter: 'lib/webrtc_adapter',

    },

    /*
     * Mappings to be able to switch our models (in-mem, browser, backend, etc)
     */
    map: {
        '*': {
            'socketio': 'app/chromeSocket',
            'connectionmanager': 'app/connections/connectionmanager',
            'connections/serial': 'app/connections/cordovaSerial',
            'connections/tcp': 'app/connections/chromeTcpSerial',
            'connections/hid': 'app/connections/cordovaHID',
            'connections/btle': 'app/connections/cordovaBTLE',
            'connections/btspp': 'app/connections/cordovaBTSPP',
            'connections/webrtc': 'app/connections/webrtc',
            'serialport': 'app/lib/serialport',
        }
    },

    shim: {
        'backbone': {
            deps: ['underscore', 'jquery'],
            exports: 'Backbone'
        },
        'underscore': {
            exports: '_'
        },
        'backbonepouch': {
            deps: ['pouchdb']
        },
        // Define Bootstrap's main JS, then all plugins which depend on it:
        'bootstrap': {
            deps: ['jquery']
        },
        'bootstrapslider': {
            deps: ['bootstrap']
        },
        'bootstrapeditable': {
            deps: ['bootstrap']
        },
        'utils': {
            exports: 'utils'
        },
        'jquery_xmlrpc': {
            deps: ['jquery']
        },
        // The Flot library, along with our dependencies:
        'flot': {
            deps: ['jquery'],
            exports: '$.plot'
        },
        'flot_time': {
            deps: ['flot']
        },
        'flot_resize': {
            deps: ['flot']
        },
        'flot_selection': {
            deps: ['flot']
        },
        'flot_fillbetween': {
            deps: ['flot']
        },
        'flot_navigate': {
            deps: ['flot']
        },
        'flot_jumlib': {
            deps: ['jquery', 'flot'],
            exports: '$.plot.JUMlib'
        },
        'flot_windrose': {
            deps: ['flot', 'flot_jumlib']
        },
        'flot_crosshair': {
            deps: [ 'flot' ]
        }

    }
});

// We are going to manage a single global variable for VizApp that contains the few things that have to
// be defined application-wise:
var vizapp = {

    // type is a helper to avoid code duplication depending on the
    // run mode of the application. Can be:
    //   - server : use a remote server for device connection & database
    //   - cordova: run as an embedded Cordova application on Android
    //   - others to be defined
    type: 'cordova',

    // State can be "running" or "paused". Only updated in Cordova mode.
    // Can be checked by various tasks to skip display when app paused, and
    // save battery. (see Flotplot)
    state: 'running',

    // Used in a couple of locations, lets us change the app name easily.
    appname: 'Wizkers:Nuclear'

};

var pauseListener = function () {
    console.log('Paused');
    vizapp.state = 'paused';
}

var resumeListener = function () {
    console.log('Resumed');
    vizapp.state = 'running';
}

document.addEventListener("pause", pauseListener, false);
document.addEventListener("resume", resumeListener, false);

var router;

// We cannot launch this before the Cordova framework has initialized:

document.addEventListener('deviceready', go, false);


function go() {
    require(['jquery', 'backbone', 'app/router', 'app/models/settings', 'app/instruments/instrumentmanager', 'app/linkmanager', 'app/outputs/outputmanager', 'app/models/instrument', 'stats'], function ($, Backbone, Router, Settings, InstrumentManager, LinkManager, OutputManager, Instrument, Analytics) {

        // Implement back button navigation as per Android app design guidelines.
        document.addEventListener("backbutton", function (b) {
            // If we are at the home menu level, 'back' will pause the app and attempt
            // to go to the previous Android screen before we started Wizkers
            if (window.location.hash == '') {
                navigator.Backbutton.goBack();
            } else {
            window.history.back();
            }
        }, true)

        // Cordova-specific: we don't want Wizkers to be automatically shut down by the OS
        // when it is in the background (this can happen otherwise)
        cordova.plugins.backgroundMode.setDefaults({
            title: 'Idle',
            text: vizapp.appname + ' is running'
        });
        cordova.plugins.backgroundMode.enable();


        // Initialize our Analytics object to get stats on app usage
        stats = new Analytics();
        // Stats for the Wizkers:Radio app
        stats.init('UA-66729721-6');

        // Get our settings here, and
        // share them afterwards, rather than requesting it
        // everytime...
        settings = new Settings({
            id: 1
        });

        // Create our instrument manager: in charge of creating/deleting
        // instruments as necessary, as well as providing a list of
        // instruments to other parts who need those
        instrumentManager = new InstrumentManager();

        // Create our output manager: in charge of connecting instrument outputs
        // to third party data consumers.
        outputManager = new OutputManager();

        // Create our link manager: it is in charge of talking
        // to the server-side controller interface through a socket.io
        // web socket. It is passed to all views that need it.
        linkManager = new LinkManager();

        settings.fetch({
            success: function () {
                var insId = settings.get('currentInstrument');
                if (insId != null) {
                    router = new Router();
                    router.switchinstrument(insId, false); // second argument prevents router from closing instrument
                    Backbone.history.start();
                } else {
                    router = new Router();
                    Backbone.history.start();
                }
            },
            error: function (model, response, option) {
                // Will happen at startup with "Record not found" in response
                settings.save(null, {
                    success: function () {
                        router = new Router();
                        Backbone.history.start();
                    },
                    error: function () {
                        console.log("Could not create application settings, we're done here...");
                    }
                });
            }
        });
    });
}