/**
 * We now use require.js: these are the mappings of our application
 */

require.config({
    
    baseUrl: 'js',

    // On the Beaglebone, some calls take forever
    waitSeconds: 0,
    
    paths: {
        app: 'app',
        tpl: 'tpl',

        // Below we manage our versions explicitely, so that
        // we can upgrade easily
        jquery: 'lib/jquery-1.11.0',
        backbone: 'lib/backbone-1.1.2',
        localstorage: 'lib/backbone.localStorage-1.1.7',
        underscore: 'lib/underscore-1.6.0',
        snap: 'lib/snap.svg-0.2.0',
	    text: 'lib/text',
        
        // Signal processing libs
        dsp: 'lib/dsp',
        chroma: 'lib/chroma',
        resampler: 'lib/resampler',
        
        bootstrap: 'lib/bootstrap',
        bootstrapslider: 'lib/bootstrap-slider-2.0.0',
        bootstrapeditable: 'lib/bootstrap-editable',
        flot: 'lib/flot-0.8.1/jquery.flot',
        flot_time: 'lib/flot-0.8.1/jquery.flot.time',
        flot_resize: 'lib/flot-0.8.1/jquery.flot.resize',
        flot_selection: 'lib/flot-0.8.1/jquery.flot.selection',
        flot_fillbetween: 'lib/flot-0.8.1/jquery.flot.fillbetween'
    },
    
    /*
     * Mappings to be able to switch our models (in-mem, browser, backend, etc)
     */
    map: {
        '*': {
            'socketio': '/socket.io/socket.io.js'
        }
    },
    
    shim: {
        'backbone': {
            deps: ['underscore', 'jquery' ],
            exports: 'Backbone'
        },
        'underscore': {
            exports: '_'
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
            deps: ['jquery' ],
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
    type: "server"
};

var router;

require(['jquery', 'backbone', 'app/router', 'app/models/settings','app/instruments/instrumentmanager', 'app/linkmanager',
         'app/models/instrument'], function($, Backbone, Router, Settings, InstrumentManager, LinkManager, Instrument) {
       // Get our settings here, and
        // share them afterwards, rather than requesting it
        // everytime...
        settings = new Settings({id: 1 });

         // Create our instrument manager: in charge of creating/deleting
        // instruments as necessary, as well as providing a list of
        // instruments to other parts who need those
        instrumentManager = new InstrumentManager();

        settings.fetch({success: function() {
            
            // Create our link manager: it is in charge of talking
            // to the server-side controller interface through a socket.io
            // web socket. It is passed to all views that need it.
            linkManager =  new LinkManager();

            var insId = settings.get('currentInstrument');
            if (insId != null) {
                var ins = new Instrument.Instrument({_id: insId});
                ins.fetch({success: function(){
                    // We have the instrument, get the correct link manager for it:
                    var type = ins.get('type');
                    console.log('Load link manager driver for type: ' + type );
                    instrumentManager.setInstrument(ins);
                    linkManager.setDriver(instrumentManager.getDriver(linkManager));

                    router = new Router();
                    Backbone.history.start();
                }});
            } else {
           router = new Router();
           Backbone.history.start();
	       }
        },
		error: function() {
		// Probably first run: settings don't exist on the backend
		router = new Router();
		Backbone.history.start();
	}
                       });
});


