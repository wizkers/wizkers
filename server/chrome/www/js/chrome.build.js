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
 *
 * Still work to do, check out: http://tech.pro/blog/1639/using-rjs-to-optimize-your-requirejs-project
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
            dead_code: true,
            conditionals: true,
            booleans: true,
            unused: true,
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
        mangle: true
    },

    preserveLicenseComments: false,
    mainConfigFile: "main-chrome.js",
    appDir: '..',
    baseUrl: 'js',
    dir: '../../../chrome/www/',

    // Combine everytyhing into one single file
    removeCombined: true,
    findNestedDependencies: true,

    modules: [
        {
            name: 'main-chrome'
        }
    ]
})