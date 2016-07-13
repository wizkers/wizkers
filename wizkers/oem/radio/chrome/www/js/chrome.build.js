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
 * The App build configuration for r.js
 *
 * @author Edouard Lafargue, ed@wizkers.io
 *
 * Still work to do..
 */

({

    optimize: 'closure',

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
            'languageIn': Packages.com.google.javascript.jscomp.CompilerOptions.LanguageMode.ECMASCRIPT5
        },
        CompilationLevel: 'SIMPLE_OPTIMIZATIONS',
        loggingLevel: 'WARNING',
    },

    preserveLicenseComments: false,
    mainConfigFile: "main-chrome.js",
    appDir: '..',
    baseUrl: 'js',
    dir: '../../../chrome/www/',
    writeBuildTxt: false,

    // Combine everytyhing into one single file
    removeCombined: true,
    findNestedDependencies: true,

    modules: [
        {
            name: 'main-chrome'
        },
        /*
        {
            name: 'app/instruments/elecraft/elecraft',
            exclude: ['main-chrome']
        },
        {
            name: 'app/instruments/elecraft_kx2/elecraft_kx2',
            exclude: ['main-chrome']
        }
        */

    ]
})