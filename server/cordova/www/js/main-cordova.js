/** (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
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
        jquery: 'lib/jquery-2.1.4',
        backbone: 'lib/backbone-1.1.2',
        localstorage: 'lib/backbone.localStorage-1.1.14',
        bbindexeddb: 'lib/backbone-indexeddb',
        pouchdb: 'lib/pouchdb-5.0.0',
        backbonepouch: 'lib/backbone-pouch',
        underscore: 'lib/underscore-1.6.0',
        snap: 'lib/snap.svg-0.2.0',
        text: 'lib/text',

        bootstrap: 'lib/bootstrap',
        bootstrapslider: 'lib/bootstrap-slider-2.0.0',
        bootstrapeditable: 'lib/bootstrap-editable',
        bootbox: 'lib/bootbox',
        flot: 'lib/flot-0.8.3/jquery.flot',
        flot_time: 'lib/flot-0.8.3/jquery.flot.time',
        flot_resize: 'lib/flot-0.8.3/jquery.flot.resize',
        flot_selection: 'lib/flot-0.8.3/jquery.flot.selection',
        flot_fillbetween: 'lib/flot-0.8.3/jquery.flot.fillbetween',

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
            'connections_serial': 'app/connections/cordovaSerial',
            'connections_tcp': 'app/connections/chromeTcpSerial',
            'connections_hid': 'app/connections/usbhid',
            'connections_btle': 'app/connections/cordovaBTLE',
            'connections_webrtc': 'app/connections/webrtc',
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

        // The Flot library, along with our dependencies:
        'flot': {
            deps: ['jquery'],
            exports: '$.plot',
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
    appname: 'Wizkers'
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
    require(['jquery', 'backbone', 'app/router', 'app/models/settings', 'app/instruments/instrumentmanager', 'app/linkmanager', 'app/outputs/outputmanager', 'app/models/instrument', 'stats', 'localstorage'], function ($, Backbone, Router, Settings, InstrumentManager, LinkManager, OutputManager, Instrument, Analytics) {

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

        cordova.plugins.backgroundMode.onfailure = function (errorCode) {
            console.log(errorCode);
        };

        cordova.plugins.backgroundMode.enable();


        // Initialize our Analytics object to get stats on app usage
        stats = new Analytics();
        stats.init('UA-66729721-1');

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