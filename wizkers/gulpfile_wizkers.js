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

console.log("*******************");
console.log("*   WIZKERS       *");
console.log("*******************");


gulp.task('default', function () {
    console.log("*******************");
    console.log("Targets: build chrome cordova server");
    console.log("*******************");
});


var paths = {
    // Destination directories
    build: 'build', // Where we compile the templates and build the javascript distribution
    chrome_dist: 'dist/chrome/', // Where we distribute the Chrome app (ready for packaging for Chrome app store)
    // All javascript is minified there.
    chrome_debug: 'dist/chrome-debug/', // Debug build (not minified)
    cordova_debug: 'dist/cordova-debug/',
    cordova_dist: 'dist/cordova/',
    server_dist: 'dist/server/',

    // Application paths: (need to be in arrays)
    templates: ['www/js/tpl/**/*.html'],
    css: ['www/css/*', 'www/fonts/*', 'www/img/**/*'],
    libs: ['www/js/lib/**/*'],
    jsapp: ['www/js/app/**/*.js', 'www/js/app/**/*.png', 'www/js/app/**/*.svg'],

    // Files specific to each kind of run mode (chrome, cordova, server)
    server_files: ['server/**/*'],
    chrome_files: ['chrome/**/*'],
    cordova_files: ['cordova/**/*']
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


/*******************
 *  Tasks
 */


gulp.task('build', ['css', 'libs', 'jsapp', 'templates']);

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
        .pipe(gulp.dest(path.join(paths.build)));
});

/**
 * Copy all CSS files
 * TODO: Minimize for distribution
 */
gulp.task('css', function () {
    return gulp.src(paths.css, {
            base: '.'
        })
        .pipe(gulp.dest(paths.build));
});

/**
 * Same for the libraries
 */
gulp.task('libs', function () {
    return gulp.src(paths.libs, {
            base: '.'
        })
        .pipe(gulp.dest(paths.build));
});

gulp.task('jsapp', function () {
    return gulp.src(paths.jsapp, {
            base: '.'
        })
        .pipe(gulp.dest(paths.build));
});

/**
 * Copy the build files to the Chrome directory
 */
gulp.task('chrome_copy_build', ['build'], function () {
    return gulp.src([paths.build + '/www/**/*'], {
            base: paths.build
        })
        .pipe(gulp.dest(paths.chrome_debug));
});

/**
 * Build the Chrome app (debug, not minified)
 * This first does a build of the app, then
 * overlays all the files in paths.chrome_files
 */
gulp.task('chrome', ['build', 'chrome_copy_build'], function () {
    return gulp.src(paths.chrome_files, {
            base: 'chrome'
        })
        .pipe(gulp.dest(paths.chrome_dist))
        .pipe(gulp.dest(paths.chrome_debug));
});

/**
 * Copy the build files to the Cordova directory
 */
gulp.task('cordova_copy_build', ['build'], function () {
    return gulp.src([paths.build + '/www/**/*'], {
            base: paths.build
        })
        .pipe(gulp.dest(paths.cordova_debug));
});

/**
 * Build the Cordova app
 */
gulp.task('cordova', ['build', 'cordova_copy_build'], function () {
    return gulp.src(paths.cordova_files, {
            base: 'cordova'
        })
        .pipe(gulp.dest(paths.cordova_dist))
        .pipe(gulp.dest(paths.cordova_debug));
});

/**
 * Build the Server app.
 */
/**
 * Copy the build files to the server directory
 */
gulp.task('server_copy_build', ['build'], function () {
    return gulp.src([paths.build + '/www/**/*'], {
            base: paths.build
        })
        .pipe(gulp.dest(paths.server_dist));
});

gulp.task('server', ['build', 'server_copy_build'], function () {
    return gulp.src(paths.server_files, {
            base: 'server'
        })
        .pipe(gulp.dest(paths.server_dist));
});