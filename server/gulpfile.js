var gulp = require('gulp');
var debug = require('gulp-debug');
var tap = require('gulp-tap');
var change = require('gulp-change');
var rename = require("gulp-rename");


var fs = require('fs');
var path = require('path');
var _ = require("underscore")._;
var _s = require('underscore.string');



gulp.task('default', function () {
    // Do nothing
});


var templatesPath = ['www/js/tpl'];

var paths = {
    templates: ['www/js/tpl/**/*.html'],
    chrome_dist: 'dist/chrome/',
}

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

gulp.task('templates', function () {
    gulp.src(paths.templates)
        .pipe(debug());
});

gulp.task('t', function () {
    var folders = getFolders(templatesPath);
    console.log(folders);

    var tasks = folders.map(function (folder) {
        return gulp.src(path.join(folder, '/*.html'))
            .pipe(change(compileTemplate))
            .pipe(debug())
            .pipe(rename(function(path) { path.extname = '.js'; }))
            .pipe(gulp.dest(path.join(paths.chrome_dist, folder)));
    });


});