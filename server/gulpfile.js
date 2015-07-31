var gulp = require('gulp');
var debug = require('gulp-debug');
var tap = require('gulp-tap');
var change = require('gulp-change');
var rename = require('gulp-rename');
var amdOptimize = require('amd-optimize');
var concat = require('gulp-concat');


var fs = require('fs');
var path = require('path');
var _ = require("underscore")._;
var _s = require('underscore.string');



gulp.task('default', function () {
    // Do nothing
});


var paths = {
    // Destination directories
    build: 'build', // Where we compile the templates and build the javascript distribution
    chrome_dist: 'dist/chrome/', // Where we distribute the Chrome app (ready for packaging for Chrome app store)
    // All javascript is minified there.
    chrome_debug: 'dist/chrome-debug/', // Debug build (not minified)
    cordova_dist: 'dist/cordova/',
    server_dist: 'dist/server/',

    // Application paths: (needs to be in arrays)
    templates: ['www/js/tpl/*.html', 'www/js/tpl/**/*.html', 'www/js/tpl/**/**/**.html'],
    css: ['www/css/*', 'www/fonts/*', 'www/img/*', 'www/img/**/*'],
    libs: ['www/js/lib/*.js', 'www/js/lib/**/*.js'],
    jsapp: ['www/js/app/*.js', 'www/js/app/instruments/**/*.png', 
            'www/js/app/outputs/**/*.png',
            'www/js/app/**/*.js', 'www/js/app/**/**/ *.js'],

    // Files specific to each kind of run mode (chrome, cordova, server)
    server_files: ['server'],
    chrome_files: ['chrome'],
    cordova_files: ['cordova']
}

console.log(paths.templates);
/***************
 * Utilities
 */

var compileTemplate = function (contents) {
    try {
        var uTpl = "define(function(require) { ";
        //precompile template
        uTpl += "return " + _.template(contents).source + ";";
        uTpl += "});";
        return uTpl;
    } catch (e) {
        console.error('Could not compile a template for: ' + templates[templ] + " -- " + e.message);
    }
}

/**
 * Returns an array of all the directories below dir (can be an array
 * of muliple directories) with the 'glob' pattern added
 * @param   {Array}  dir  List of directories
 * @param   {String} glob Glob pattern like '/*.js'
 * @returns {Array}  List of all subdirectories with glob pattern
 */
function makeSrc(dir, glob) {
    var dirlist = getFolders(dir);
    return dirlist.map(function (arg) {
        return arg + glob;
    });
}

/**
 * Recursive get folders
 * @param   {String} dir Base path
 * @returns {Array}  list of all subfolders (recursive)
 */
function getFolders(dir) {
    var resp = [];
    for (p in dir) {
        var fl = fs.readdirSync(dir[p])
            .filter(function (file) {
                return fs.statSync(path.join(dir[p], file)).isDirectory();
            }).map(function (d) {
                return dir[p] + '/' + d
            });
        // Concatenate the recursive call into resp:
        resp.push.apply(resp, getFolders(fl));
    }
    return resp.concat(dir);
}

/**
 * Copy folder contents for an array of folders (omits 1st level of source file path)
 * @param   {Array}    folders Folders to copy
 * @param   {String}   dest    Destination location
 * @param   {Number}   base    Where to truncate the destination path
 */
function mapFolders(folders, dest, pattern, base) {
    return folders.map(function (folder) {
        return gulp.src(path.join(folder, pattern))
            .pipe(gulp.dest(path.join(dest, folder.split(path.sep).slice(base).join(path.sep))));
    });
}

/*******************
 *  Tasks
 */


gulp.task('build', ['templates', 'css', 'libs', 'jsapp']);


/**
 * Compile all templates and copy them to the various dist directories
 */
gulp.task('templates', function () {
    return gulp.src(paths.templates, {
            base: '.'
        })
        .pipe(change(compileTemplate))
        // .pipe(debug())
        .pipe(rename(function (path) {
            path.extname = '.js';
        }))
        .pipe(gulp.dest(path.join(paths.build)))
});

/**
 * Copy all CSS files - to all correct locations
 */
gulp.task('css', function () {
    return gulp.src(paths.css, {
            base: '.'
        })
        .pipe(gulp.dest(paths.build))
});

/**
 * Same for the libraries
 */
gulp.task('libs', function () {
    return gulp.src(paths.libs, {
            base: '.'
        })
        .pipe(gulp.dest(paths.build))
});

gulp.task('jsapp', function () {
    return gulp.src(paths.jsapp, {
            base: '.'
        })
        .pipe(gulp.dest(paths.build))

});

gulp.task('jsopt', function () {
    return gulp.src(paths.jsapp.map(function (arg) {
            return paths.chrome_dist + arg;
        }))
        .pipe(amdOptimize('main-chrome', {
                configFile: 'dist/chrome/www/js/main-chrome.js',
                baseUrl: './dist/chrome/www/js'
            }))
        .pipe(concat('index.js'))
        .pipe(gulp.dest(paths.build));
});

/**
 * Build the Chrome app (debug, not minified)
 */
gulp.task('chrome', ['build'], function () {
    var folders = getFolders(paths.chrome_files);

    // Add all the javascript files built in the previous step
    folders = folders.concat(getFolders([paths.build]));

    return mapFolders(folders, paths.chrome_debug, '/*', 1);
});


/**
 * Build the Cordova app
 */
gulp.task('cordova', ['build'], function () {
    var folders = getFolders(paths.cordova_files);

    // Add all the javascript files built in the previous step
    folders = folders.concat(getFolders([paths.build]));

    // Note: we want to copy those to the base of the distribution directory, hence
    // the juggling in the dest, which basically removes the base directory from 'folder'
    return mapFolders(folders, paths.cordova_dist, '/*', 1);
});

/**
 * Build the Server app
 */
gulp.task('server', ['build'], function () {
    var folders = getFolders(paths.server_files);

    // Add all the javascript files built in the previous step
    folders = folders.concat(getFolders([paths.build]));

    // Note: we want to copy those to the base of the distribution directory, hence
    // the juggling in the dest, which basically removes the base directory from 'folder'
    return mapFolders(folders, paths.server_dist, '/*', 1);
});