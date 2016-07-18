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
 *  Various useful utility functions for writing to files. This is the version
 *  that is compatible with the Apache Cordova framework.
 *
 * Original code (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function (require) {

    "use strict";

    var WIZKERS_DIR = 'wizkers';
    var WIZKERS_LOGS_DIR = 'logs';

    // As per http://www.html5rocks.com/en/tutorials/file/filesystem/
    function createDir(rootDirEntry, folders, cb) {
        // Throw out './' or '/' and move on to prevent something like '/foo/.//bar'.
        if (folders[0] == '.' || folders[0] == '') {
            folders = folders.slice(1);
        }
        rootDirEntry.getDirectory(folders[0], {
            create: true
        }, function (dirEntry) {
            // Recursively add the new subfolder (if we still have another to create).
            if (folders.length > 1) {
                createDir(dirEntry, folders.slice(1), cb);
            } else {
                cb(dirEntry);
            }
        }, function (err) {
            console.log(err);
        });
    };



    var fileUtils = function () {
        var currentFile;

        //////
        // Public methods
        /////
        this.newLogFile = function (filename, callback) {
            var dirpath = [WIZKERS_DIR, WIZKERS_LOGS_DIR];
            resolveLocalFileSystemURL(cordova.file.externalRootDirectory, function (rootDirEntry) {
                createDir(rootDirEntry, dirpath, function (dir) {
                    dir.getFile(filename, {
                        create: true
                    }, function (file) {
                        callback(file);
                    });
                });
            });
        };

        /**
         * Write a single line in a previously open log file
         * @param {[[Type]]} entry [[Description]]
         */
        this.writeLog = function (file, entry) {
            file.createWriter(function (fileWriter) {
                fileWriter.seek(fileWriter.length);
                var blob = new Blob([log], {
                    type: 'text/plain'
                });
                fileWriter.write(blob);
            }, function (e) {
                console.log(e);
            });
        };

        this.FileUploadOptions = function () {
            return new FileUploadOptions();
        }

        /**
         * Send the contents of a file to a remote endpoint.
         * @param {[[Type]]} fileURI [[Description]]
         * @param {[[Type]]} server  [[Description]]
         * @param {[[Type]]} success [[Description]]
         * @param {[[Type]]} failure [[Description]]
         * @param {[[Type]]} option  [[Description]]
         */
        this.sendFile = function (fileURI, server, success, failure, options) {
            var ft = new FileTransfer();
            ft.upload(fileURI, encodeURI(server), success, failure, options);
        }


    }

    return new fileUtils;
});