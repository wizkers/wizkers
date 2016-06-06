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
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * We now use require.js: these are the mappings of our application.
 *
 * This is the version of the require mappings that is used when compiling
 * for Chrome
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
        backbone: 'lib/backbone-1.2.3',
        jquery_xmlrpc: 'lib/jquery.xmlrpc',
        jquery_mousewheel: 'lib/jquery.mousewheel',
        chromestorage: 'lib/backbone.chromestorage',
        bbindexeddb: 'lib/backbone-indexeddb',
        pouchdb: 'lib/pouchdb-5.0.0',
        backbonepouch: 'lib/backbone-pouch',
        underscore: 'lib/underscore-1.8.3',
        snap: 'lib/snap.svg-0.4.1',
        text: 'lib/text',

        // Signal processing libs
        dsp: 'lib/dsp',
        chroma: 'lib/chroma',
        resampler: 'lib/resampler',

        // Analytics wrapper:
        ga_bundle: 'lib/google-analytics-bundle',
        stats: 'app/analytics',

        // WebRTC adapter shim to abstract from
        // navigator implementations
        peerjs: 'lib/peer-0.3.14',
        webrtc_adapter: 'lib/webrtc_adapter',

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
        
        xmlrpc: 'lib/xmlrpc/xmlrpc'
    },

    /*
     * Mappings to be able to switch our models (in-mem, browser, backend, etc)
     */
    map: {
        '*': {
            'socketio': 'app/chromeSocket',
            'connections_serial': 'app/connections/chromeSerial',
            'connections_tcp': 'app/connections/chromeTcpSerial',
            'connections_hid': 'app/connections/usbhid',
            'connections_btle': 'app/connections/btle',
            'connection_btspp': 'app/connections/cordovaBTSPP',
            'connections_webrtc': 'app/connections/webrtc',
            'serialport': 'app/lib/serialport',
        }
    },

    shim: {
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
        
        'jquery_mousewheel': {
            deps: [ 'jquery']
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
        'flot_jumlib': {
            deps: ['jquery', 'flot'],
            exports: '$.plot.JUMlib'
        },
        'flot_windrose': {
            deps: ['flot', 'flot_jumlib']
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
    type: "chrome",
};

var router;

require(['jquery', 'backbone', 'app/router', 'app/models/settings', 'app/instruments/instrumentmanager', 'app/linkmanager',
         'app/outputs/outputmanager', 'app/models/instrument', 'stats', 'ga_bundle', 'chromestorage'], function ($, Backbone, Router, Settings, InstrumentManager,
    LinkManager, OutputManager, Instrument, Analytics) {

    // Initialize our Analytics object to get stats on app usage
    stats = new Analytics();
    
    // Stats for the Chrome app
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
        }
    });
});