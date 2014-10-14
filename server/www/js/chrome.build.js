/**
 * The App build configuration for r.js
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
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
            drop_console: true,   // Remove all console.log calls from the build
            sequences: false,
            global_defs: {
                DEBUG: false
            }
        },
        warnings: true,
        mangle: true
    },

    mainConfigFile : "main-chrome.js",
    appDir: '..',
    baseUrl: 'js',
    dir: '../../chrome_build/',
    
    // Combine everytyhing into one single file
    removeCombined: true,
    findNestedDependencies: true,    
    
    modules: [
        {
            name: 'main-chrome'
        }
    ]    
})
