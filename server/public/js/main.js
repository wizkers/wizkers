/**
 * We now use require.js: these are the mappings of our application
 */

require.config({
    
    baseUrl: 'js/lib',
    
    paths: {
        app: '../app',
        tpl: '../tpl',

        // Below we manage our versions explicitely, so that
        // we can upgrade easily
        jquery: 'jquery-1.11.0',
        backbone: 'backbone-1.1.2',
        localstorage: 'backbone.localStorage-1.1.7',
        underscore: 'underscore-1.6.0',
        snap: 'snap.svg-0.2.0',
        
        bootstrap: 'bootstrap',
        bootstrapslider: 'bootstrap-slider-2.0.0',
        bootstrapeditable: 'bootstrap-editable',
        flot: 'flot-0.8.1/jquery.flot',
        flot_time: 'flot-0.8.1/jquery.flot.time',
        flot_resize: 'flot-0.8.1/jquery.flot.resize',
        flot_selection: 'flot-0.8.1/jquery.flot.selection',
        flot_fillbetween: 'flot-0.8.1/jquery.flot.fillbetween',
    },
    
    /*
     * Mappings to be able to switch our models (in-mem, browser, backend, etc)
     */
    map: {
        '*': {
            'socketio': '/socket.io/socket.io.js',
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

var router;

require(['jquery', 'backbone', 'app/router', 'app/models/settings','app/instruments/instrumentmanager', 'app/linkmanager',
         'app/models/instrument'], function($, Backbone, Router, Settings,InstrumentManager, LinkManager, Instrument) {
       // Get our settings here, and
        // share them afterwards, rather than requesting it
        // everytime...
        settings = new Settings({id: 1 });
        // We need to be sure the settings are fetched before moving
        // further, so we add the Ajax option "async" below.
        settings.fetch({async:false});

        // Now create our instrument manager & link manager (todo: have only one object ?)

        // Create our instrument manager: in charge of creating/deleting
        // instruments as necessary, as well as providing a list of
        // instruments to other parts who need those
        instrumentManager = new InstrumentManager();
                       
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
                linkManager.setDriver(instrumentManager.getLinkManager(linkManager));

                router = new Router();
                Backbone.history.start();
            }});
        } else {
	   router = new Router();
	   Backbone.history.start();
	}
});


