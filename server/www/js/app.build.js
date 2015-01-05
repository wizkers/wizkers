/** (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * The App build configuration for r.js
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

({
    
    optimize: 'closure',

   
    closure: {
      CompilerOptions: {
        languageIn: Packages.com.google.javascript.jscomp.CompilerOptions.LanguageMode.ECMASCRIPT5
        }
    },
    
    appDir: '..',
    baseUrl: 'js',
    dir: '../../polylog_build/',
    
    modules: [
        {
            name: 'main'
        }
    ],
    
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
            'socketio': '../../node_modules/socket.io/node_modules/socket.io-client/dist/socket.io.min',
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