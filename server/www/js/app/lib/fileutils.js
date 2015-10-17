/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
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