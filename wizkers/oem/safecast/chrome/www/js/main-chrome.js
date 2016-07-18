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
        chromestorage: 'lib/backbone.chromestorage',
        bbindexeddb: 'lib/backbone-indexeddb',
        pouchdb: 'lib/pouchdb-5.0.0',
        backbonepouch: 'lib/backbone-pouch',
        underscore: 'lib/underscore-1.8.3',
        snap: 'lib/snap.svg-0.2.0',
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

    // No Stats so far (Safecast Chrome is not a target until further notice)
    //stats.init('UA-66729721-1');

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