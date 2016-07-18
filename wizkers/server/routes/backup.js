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
 * Use the 'spawn' module to interact with mongodb for
 * backup/restore operations
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */
var spawn = require('child_process').spawn;
var path = require('path');
var fs = require('fs');
var debug = require('debug')('wizkers:routes:backup');


/**
 * A few utility functions
 */

// http://www.geedew.com/2012/10/24/remove-a-directory-that-is-not-empty-in-nodejs/
var deleteDirectoryRecursive = function(dirpath) {
    if( fs.existsSync(dirpath) ) {
        console.log("deleteDirectoryRecursive starting");
      fs.readdirSync(dirpath).forEach(function(file,index){
        var curPath = dirpath + "/" + file;
        if(fs.statSync(curPath).isDirectory()) { // recurse
          deleteDirectoryRecursive(curPath);
        } else { // delete file
          fs.unlinkSync(curPath);
        }
      });
    fs.rmdirSync(dirpath);
  }
};


exports.generateBackup = function(req, res) {
    console.log('Launching backup');
    // Phase Zero: clean up the tmp directory for any old backup...
    var tmpdir = path.resolve(__dirname, '../www/pics/tmp');
    fs.readdirSync(tmpdir).forEach(function(file,index) {
        if (file.indexOf('backup-') > -1) {
            console.log('Clean up stale backup file: ' + file);
            fs.unlinkSync(tmpdir + '/' + file);
        }
    });

    // Phase I: dump the database
    var args = ['--db', 'vizappdb'],
        options= { cwd: path.resolve(__dirname, '../www/pics/'),
                    env: process.env
                };
    try {
        var mongodump = spawn('mongodump', args, options);
        /*
        mongodump.stdout.on('data', function (data) {
          console.log('stdout: ' + data);
        });
        */
        mongodump.stderr.on('data', function (data) {
          console.log('stderr: ' + data);
        });
        mongodump.on('exit', function (code) {
          console.log('mongodump exited with code ' + code);
          // Phase II: add a tag in the file to validate upon restore
          args = ['valid_database_backup'];
          var touch = spawn('touch', args, options);
          touch.on('exit', function(code) {
              console.log('Touch database backup tag exit ' + code);
              var filename = 'backup-' + Date.now() + '.tar.bz2';
              console.log('Backup file name: ' + filename);
              args = [ 'cvjf', 'tmp/' + filename, 'instruments', 'dump', 'valid_database_backup'];
              // Phase II: create a tarfile in 'tmp' with the whole backup:
              var maketar = spawn('tar', args, options);
              maketar.on('exit', function(code) {
              res.redirect('/pics/tmp/' + filename);
            });
          });
        });
    } catch (err) {
        console.log("Alert: mongodump was not found, or failed");
        res.send("Error: could not do the backup.");
    }


};

exports.restoreBackup = function(req, res) {
    if (req.files) {
        console.log('Restore backup  ' + JSON.stringify(req.files));
        // We use an 'upload' dir on our server to ensure we're on the same FS
        var filename = req.files.file.path;
        // Phase I: check that we have a "valid_train_backup" tag in the
        // tar backup:
        var args = ['tjf', filename, 'valid_database_backup'],
            options= { cwd: path.resolve(__dirname, '../www/pics/'),
                       env: process.env
                     };
        var check;

        try { check = spawn('tar', args, options);
            } catch (error) {
                console.log("Error opening the archive: " + error);
                res.send("Invalid");
                return;
            }


        check.on('exit', function(code) {
            console.log('Backup file check: ' + code);
            if (code != 0) {
                // Could not find the "valid_train_backup" file in the archive; bail out
                res.send("Invalid");
                fs.unlinkSync(req.files.file.path);
                console.log("Invalid backup file, deleting...");
            } else {
                // Phase II: clean up current image directories
                var dirpath = path.resolve(__dirname, '../www/pics/instruments/');
                console.log("Deleting " + dirpath);
                deleteDirectoryRecursive(dirpath);
                // Phase III: Restore images files
                args = ['xjf', filename];
                check = spawn('tar', args, options);
                check.on('exit', function(code) {
                    // Phase IV: restore database
                    args = ['--drop', 'dump' ];
                    check = spawn('mongorestore', args, options);
                    check.on('exit', function(code) {
                        // Phase V: remove backup file
                        fs.unlinkSync(req.files.file.path);
                        res.send(true);
                    });
                });
            }
        });
    } else {
        res.send(false);
    }
};