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
 * The App build configuration for r.js
 *
 * @author Edouard Lafargue, ed@wizkers.io
 *
 * Still work to do..
 */

({

    optimize: 'uglify2',

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
            sequences: true,
            properties: true,
            dead_code: true,
            conditionals: true,
            booleans: true,
            unused: true,
            loops: true,
            evaluate: true,
            if_return: true,
            join_vars: true,
            drop_console: true, // Remove all console.log calls from the build
            //sequences: false,
            global_defs: {
                DEBUG: false
            }
        },
        warnings: true,
        mangle: true,
    },

    //If using Closure Compiler for script optimization, these config options
    //can be used to configure Closure Compiler. See the documentation for
    //Closure compiler for more information.
    closure: {
        CompilerOptions: {
            'languageIn': 'Packages.com.google.javascript.jscomp.CompilerOptions.LanguageMode.ECMASCRIPT5'
        },
        CompilationLevel: 'SIMPLE_OPTIMIZATIONS',
        loggingLevel: 'WARNING',
    },

    preserveLicenseComments: false,
    mainConfigFile: "main-chrome.js",
    appDir: '..',
    baseUrl: 'js',
    dir: '../../../nwjs/www/',
    writeBuildTxt: false,

    // Combine everytyhing into one single file
    removeCombined: true,
    findNestedDependencies: true,

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
        'paper' : {
            exports: 'paper'
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
    },


    modules: [
        {
            name: 'main-chrome'
        }
    ]
})