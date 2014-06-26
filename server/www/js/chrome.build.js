/**
 * The App build configuration for r.js
 */

({
    
    optimize: 'uglify2',

   
    closure: {
      CompilerOptions: {
        languageIn: Packages.com.google.javascript.jscomp.CompilerOptions.LanguageMode.ECMASCRIPT5
        }
    },
    
    //If using UglifyJS for script optimization, these config options can be
    //used to pass configuration values to UglifyJS.
    //See https://github.com/mishoo/UglifyJS for the possible values.
    uglify: {
        toplevel: true,
        ascii_only: true,
        beautify: false,
        max_line_length: 100,

        //How to pass uglifyjs defined symbols for AST symbol replacement,
        //see "defines" options for ast_mangle in the uglifys docs.
        defines: {
            DEBUG: ['name', 'false']
        },

        //Custom value supported by r.js but done differently
        //in uglifyjs directly:
        //Skip the processor.ast_mangle() part of the uglify call (r.js 2.0.5+)
        no_mangle: false
    },
    
       //If using UglifyJS2 for script optimization, these config options can be
    //used to pass configuration values to UglifyJS2.
    //For possible `output` values see:
    //https://github.com/mishoo/UglifyJS2#beautifier-options
    //For possible `compress` values see:
    //https://github.com/mishoo/UglifyJS2#compressor-options
    uglify2: {
        //Example of a specialized config. If you are fine
        //with the default options, no need to specify
        //any of these properties.
        output: {
            beautify: false
        },
        compress: {
            drop_console: true,   // Remove all console.log calls from the build
            sequences: false,
            global_defs: {
                DEBUG: false
            }
        },
        warnings: true,
        mangle: true
    },

    
    appDir: '..',
    baseUrl: 'js',
    dir: '../../chrome_build/',
    
    modules: [
        {
            name: 'main-chrome'
        }
    ],
    
    paths: {
        app: 'app',
        tpl: 'tpl',

        // Below we manage our versions explicitely, so that
        // we can upgrade easily
        jquery: 'lib/jquery-1.11.0',
        backbone: 'lib/backbone-1.1.2',
        localstorage: 'lib/backbone.chromestorage',
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
            'socketio': 'app/chromeSerialLib',
            'serialport': 'app/lib/serialport',
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
})
